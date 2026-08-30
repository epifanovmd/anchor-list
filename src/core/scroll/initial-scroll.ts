import {
  logInitialApply,
  logInitialFinish,
  logInitialReveal,
  logInitialWait,
} from "../../debug";
import type { AnchorListInitialScroll } from "../../types";
import type { IInitialTargetDescription } from "./initial-offset";

/**
 * Допуск попадания в цель, px.
 *
 * Нативное смещение квантовано плотностью экрана — на 3× это трети точки, — и
 * точного равенства не будет никогда. Полточки: больше кванта и меньше того,
 * что заметно глазом.
 */
const ARRIVAL_EPSILON = 0.5;

/** Зависимости начального скролла. */
export interface IInitialScrollOptions {
  getTarget: () => AnchorListInitialScroll | undefined;
  /** Смещение, к которому нужно прийти; undefined — цель ещё не вычислима. */
  resolveOffset: () => number | undefined;
  /** @returns false, если нативный адаптер ещё не подключён. */
  scrollToOffset: (offset: number) => boolean | void;
  /** Все элементы до цели измерены — позиция больше не уедет. */
  isTargetSettled: () => boolean;
  /** Живое нативное смещение — по нему видно, доехала ли прошлая команда. */
  getLiveOffset?: () => number | undefined;
  /** Из чего сложилась цель — печатается диагностикой. */
  describeTarget: () => IInitialTargetDescription;
  onFinished: () => void;
}

/**
 * Начальный скролл.
 *
 * Цель считается по метрикам, но до измерения ячеек размеры оценочные, поэтому
 * после каждого кадра измерений позиция цели уезжает. Скролл повторяется, пока
 * фактическое окно цели вместе с буфером не измерено — иначе список открывается
 * на позиции, посчитанной по оценкам, и заметно доводится уже на глазах у
 * пользователя. Конечное ожидание обеспечивает страховка первого показа по
 * времени, а не число кадров: нативный commit может не успеть за десять rAF.
 *
 * Устаканившейся цели мало: команда могла и не доехать — её перебивает нативная
 * компенсация замеров и обрезает граница контента. Поэтому каждая попытка
 * сверяет живое смещение с тем, что просила прошлая, и повторяет команду, пока
 * список не окажется там, где просили: после показа доводка не возвращается, и
 * поправить позицию будет уже нечем.
 *
 * Пока начальный скролл активен, пороги кромок не проверяются: иначе открытие
 * списка у конца сразу же вызывает подгрузку.
 */
export class InitialScroll {
  private readonly options: IInitialScrollOptions;

  private finished = false;
  private attempts = 0;
  private scheduledFrame: number | undefined;
  /** Смещение, которое просила прошлая попытка. */
  private lastApplied: number | undefined;

  constructor(options: IInitialScrollOptions) {
    this.options = options;
  }

  /** Начальная позиция ещё не доведена. */
  isActive(): boolean {
    return !this.finished;
  }

  /**
   * Цель хотя бы раз применялась.
   *
   * По этому признаку первый показ решает, ждать ли ещё: список, показанный до
   * первой попытки, открыт не там, где просили.
   */
  hasApplied(): boolean {
    return this.attempts > 0;
  }

  /** Попытка применить начальную позицию. Вызывается после раскладки. */
  apply(): void {
    if (this.finished || this.scheduledFrame !== undefined) return;

    // Стартовая позиция не задана: показать список решает вызывающий — по
    // готовности измерений, а не по факту первой раскладки.
    if (!this.options.getTarget()) return;

    const offset = this.options.resolveOffset();

    if (offset === undefined) {
      logInitialWait({
        attempt: this.attempts,
        ...this.options.describeTarget(),
      });

      return;
    }

    const applied = this.options.scrollToOffset(offset);

    if (applied === false) return;

    this.attempts += 1;

    // Проверяется прошлая команда, а не эта: нативный слой применяет смещение
    // не в вызове, и сразу после него живое значение — ещё старое.
    const live = this.options.getLiveOffset?.();
    const arrived = this.hasArrived(live);
    const settled = arrived && this.options.isTargetSettled();

    this.lastApplied = offset;

    logInitialApply({
      attempt: this.attempts,
      offset,
      live,
      arrived,
      settled,
      ...this.options.describeTarget(),
    });

    if (settled) {
      logInitialFinish({
        attempts: this.attempts,
        offset,
        reason: "settled",
      });
      this.finish();

      return;
    }

    // Размеры ещё уточняются — повторяем на следующем кадре.
    this.scheduledFrame = requestAnimationFrame(() => {
      this.scheduledFrame = undefined;
      this.apply();
    });
  }

  /**
   * Список стоит там, куда его звала прошлая попытка.
   *
   * Первая попытка непроверяема — нативному слою нечего было применять; список
   * без живого смещения не проверяется вовсе.
   */
  private hasArrived(live: number | undefined): boolean {
    if (this.options.getLiveOffset === undefined) return true;
    if (live === undefined) return true;
    if (this.lastApplied === undefined) return false;

    return Math.abs(live - this.lastApplied) < ARRIVAL_EPSILON;
  }

  /**
   * Прекратить доводку и показать список.
   *
   * @param cause чем вызван показ — печатается диагностикой: доводка дошла до
   * цели, видимые строки измерены или сработала страховка первого показа.
   * @param rounds сколько кругов прождала страховка.
   */
  finish(cause = "позиция", rounds = 0): void {
    if (this.finished) return;

    this.finished = true;
    this.cancelScheduledFrame();
    logInitialReveal({ attempts: this.attempts, cause, rounds });
    this.options.onFinished();
  }

  /** Снять отложенную доводку при размонтировании списка. */
  dispose(): void {
    this.finished = true;
    this.cancelScheduledFrame();
  }

  private cancelScheduledFrame(): void {
    if (this.scheduledFrame === undefined) return;

    cancelAnimationFrame(this.scheduledFrame);
    this.scheduledFrame = undefined;
  }
}
