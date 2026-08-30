import {
  logMvcpCapture,
  logMvcpMiss,
  logMvcpNoAnchor,
  logMvcpShift,
  mvcpDebug,
  signed,
} from "../../debug";
import type { ListMetrics, ListStore } from "../../model";
import { listPerf } from "../../perf";
import type { ScrollAdapterRef } from "../scroll";
import type { IAnchor } from "./anchor-picker";
import { pickAnchors, resolveAnchor } from "./anchor-picker";
import { ScrollAdjust } from "./scroll-adjust";
import { ShiftQueue } from "./shift-queue";
import { MIN_SHIFT, solveShift } from "./shift-solver";

/** Зависимости удержания видимой позиции. */
export interface IMvcpOptions {
  store: ListStore;
  metrics: ListMetrics;
  adapter: ScrollAdapterRef;
  /** Смещение скролла, каким его считает список. */
  getScroll: () => number;
  getScrollLength: () => number;
  /**
   * Полная высота контента ScrollView — в тех же координатах, что и
   * {@link IMvcpOptions.getScroll}: из неё считается граница скролла, и
   * разъехавшись, они дали бы компенсацию, промахивающуюся у края контента.
   */
  getContentSize: () => number;
  /** Разрешён ли элемент как якорь восстановления. */
  shouldRestorePosition?: (index: number) => boolean;
}

/**
 * Удержание видимой позиции при изменениях выше вьюпорта.
 *
 * Зачем нужно: вставка или удаление выше вьюпорта сдвигает весь контент под
 * собой. Без компенсации подгрузка истории уводит переписку вниз на высоту
 * добавленного, а уточнение размера строки за кадром дёргает всё, что ниже.
 *
 * Как работает: перед изменением снимается якорь — {@link pickAnchors} —
 * запоминается элемент и его позиция. После пересчёта разница позиций якоря и
 * есть то, на сколько уехал контент под ним, и ровно на столько нужно подвинуть
 * скролл.
 *
 * Мерить нужно именно разницу позиций, а не расстояние якоря до кромки
 * вьюпорта. Между снятием якоря и пересчётом проходит кадр, и за этот кадр
 * пользователь успевает проскроллить: расстояние до кромки меняется вместе со
 * скроллом, и его собственное движение попало бы в компенсацию вторым разом.
 * Разница позиций от скролла не зависит вовсе.
 *
 * Сам сдвиг здесь не выполняется — см. {@link ScrollAdjust}: компенсация только
 * пишет новое положение распорки в тот же синхронный проход, что и позиции
 * контейнеров, а `contentOffset` правит нативный слой в той же транзакции.
 */
export class MaintainVisibleContentPosition {
  private readonly options: IMvcpOptions;

  private readonly adjust: ScrollAdjust;
  private readonly queue = new ShiftQueue();

  /** Якоря сверху вниз: опорой станет первый переживший изменение. */
  private anchors: IAnchor[] = [];
  /** Якорь снят и ждёт восстановления. */
  private armed = false;
  /** Недоведённая доля точки — дожимается следующим проходом. */
  private residual = 0;

  constructor(options: IMvcpOptions) {
    this.options = options;
    this.adjust = new ScrollAdjust(options.store);
  }

  /** Идёт компенсация: пороги кромок в это время проверять нельзя. */
  isSettling(): boolean {
    return this.queue.isSettling();
  }

  /**
   * Якорь снят и ждёт восстановления.
   *
   * Нужен тому, кто решает, идти ли проходу через компенсацию: снятый якорь —
   * единственный признак, что она вообще была запрошена. Само решение
   * принимается раньше, в момент снятия.
   */
  isArmed(): boolean {
    return this.armed;
  }

  /**
   * Снять якорь перед изменением раскладки.
   *
   * Повторный вызов до восстановления игнорируется: если в одну пачку попали и
   * измерение ячейки, и смена данных, базой должна остаться раскладка до первого
   * из этих изменений.
   */
  capture(_reason: string): void {
    if (this.armed) return;

    listPerf.count("mvcpCapture");
    this.armed = true;
    this.anchors = [];

    const { metrics, getScroll, getScrollLength, shouldRestorePosition } =
      this.options;
    const scroll = getScroll();

    if (metrics.getCount() === 0) return;

    const { anchors } = pickAnchors({
      metrics,
      scroll,
      scrollLength: getScrollLength(),
      shouldRestorePosition,
    });

    this.anchors = anchors;

    if (mvcpDebug.enabled) {
      const anchor = anchors[0];

      logMvcpCapture({
        reason: _reason,
        anchor: anchor?.index,
        position: anchor?.position,
        offset: anchor === undefined ? undefined : anchor.position - scroll,
        candidates: anchors.length,
      });
    }
  }

  /**
   * На сколько уехал якорь по текущей раскладке.
   *
   * Якорь не расходуется — значение нужно тем, кому раскладку ещё предстоит
   * уточнить: пересчёт диапазона по предсказанному смещению не должен
   * промахнуться ровно на величину будущего сдвига.
   */
  peekShift(): number {
    if (!this.armed) return 0;

    const resolved = resolveAnchor(this.anchors, this.options.metrics);

    return resolved ? resolved.position - resolved.anchor.position : 0;
  }

  /**
   * Компенсировать сдвиг якоря.
   *
   * @returns смещение, каким список должен считать скролл.
   */
  restore(_reason: string): number {
    const scroll = this.options.getScroll();

    if (!this.armed) return scroll;

    this.armed = false;

    const captured = this.anchors;
    const resolved = resolveAnchor(captured, this.options.metrics);

    this.anchors = [];

    listPerf.count(_reason === "данные" ? "mvcpByData" : "mvcpBySize");

    if (captured.length === 0) {
      listPerf.count("mvcpNoAnchor");
      logMvcpNoAnchor({
        reason: _reason,
        cause: "не снят",
        candidates: 0,
      });

      return scroll;
    }

    // Ни один из снятых якорей не пережил изменение: восстанавливать не по
    // чему, накопленный остаток сбрасывается.
    if (!resolved) {
      listPerf.count("mvcpNoAnchor");
      this.residual = 0;
      logMvcpNoAnchor({
        reason: _reason,
        cause: "не пережил",
        candidates: captured.length,
      });

      return scroll;
    }

    const { anchor, position, candidate } = resolved;

    // Первая видимая строка не пережила изменение: опорой стала запасная. Так
    // и задумано, но именно здесь компенсация опирается на другую строку.
    if (candidate > 0) listPerf.count("mvcpFallbackAnchor");

    return this.applyShift(anchor, position, scroll, _reason, candidate);
  }

  /** Расчёт и применение сдвига по выжившему якорю. */
  private applyShift(
    anchor: IAnchor,
    position: number,
    scroll: number,
    reason: string,
    candidate: number,
  ): number {
    const { getScrollLength, getContentSize } = this.options;
    const scrollLength = getScrollLength();
    const contentSize = getContentSize();
    const moved = position - anchor.position;

    const solution = solveShift({
      scroll,
      moved,
      residual: this.residual,
      contentSize,
      scrollLength,
    });

    this.residual = solution.residual;

    if (listPerf.enabled && solution.lost !== 0) {
      // Сдвиг обрезан границей контента: на экране это прыжок «не до конца».
      listPerf.count("mvcpClamped");
      listPerf.sample("mvcpLostPx", Math.abs(solution.lost));
    }

    if (Math.abs(solution.applied) < MIN_SHIFT) {
      this.reportMiss(anchor, position, scroll, solution.settled);
      this.reportShift(reason, anchor, candidate, moved, 0, solution.lost);

      return solution.settled;
    }

    this.adjust.add(solution.applied);

    this.queue.push(solution.applied, solution.settled);

    const next = solution.settled + solution.applied;

    this.reportMiss(anchor, position, scroll, next);
    this.reportShift(
      reason,
      anchor,
      candidate,
      moved,
      solution.applied,
      solution.lost,
    );

    return next;
  }

  /**
   * Что компенсация сделала на этом проходе — для диагностики.
   *
   * `moved` — на сколько уехал якорь, `applied` — сколько из этого доехало до
   * смещения. Расхождение между ними и есть та величина, на которую дёрнется
   * картинка.
   */
  private reportShift(
    reason: string,
    anchor: IAnchor,
    candidate: number,
    moved: number,
    applied: number,
    lost: number,
  ): void {
    logMvcpShift({
      anchor: anchor.index,
      reason,
      candidate,
      moved: signed(moved),
      applied: signed(applied),
      lost,
      residual: this.residual,
    });
  }

  /**
   * Осталась ли опорная строка на своём месте экрана.
   *
   * Проверяется то самое, ради чего компенсация и существует: расстояние от
   * якоря до верхней кромки до изменения и после. Расхождение здесь означает,
   * что ошиблась сама компенсация; его отсутствие при видимом прыжке — что
   * держали не ту строку или сдвиг не доехал до нативного слоя.
   */
  private reportMiss(
    anchor: IAnchor,
    position: number,
    scroll: number,
    next: number,
  ): void {
    if (!listPerf.enabled && !mvcpDebug.enabled) return;

    const before = anchor.position - scroll;
    const after = position - next;
    const error = Math.abs(after - before);

    listPerf.sample("mvcpErrorPx", error);

    if (error >= 1) listPerf.count("mvcpMissed");

    // Расстояние опорной строки до верхней кромки до изменения и после. Оно и
    // есть то, что видно глазом: разошлось — строка уехала под пальцем.
    if (error >= 1) {
      logMvcpMiss({
        anchor: anchor.index,
        before,
        after,
        error,
      });
    }
  }

  /** Событие скролла отправлено до применения сдвига — его нужно отбросить. */
  isStaleScroll(offset: number): boolean {
    return this.queue.isStale(offset);
  }

  /** Сброс состояния: применённая компенсация остаётся, ожидания снимаются. */
  reset(): void {
    this.armed = false;
    this.anchors = [];
    this.residual = 0;
    this.queue.clear();
  }
}
