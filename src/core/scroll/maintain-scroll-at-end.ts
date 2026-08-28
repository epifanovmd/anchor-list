import type { ListStore } from "../../model";
import type { ScrollAdapterRef } from "./scroll-adapter";

/** Сколько ждать завершения анимированного прилипания, мс. */
const ANIMATED_SETTLE_MS = 500;

/**
 * Насколько смещение может измениться само по себе, px.
 *
 * Отличает «пользователь увёл список» от округлений раскладки: палец за кадр
 * сдвигает список на единицы пикселей, а рост контента снизу смещение не меняет
 * вовсе.
 */
const USER_MOVE_EPSILON = 1;

/** Настройки автоприлипания к концу списка. */
export interface IMaintainScrollAtEndOptions {
  store: ListStore;
  adapter: ScrollAdapterRef;
  /** Прилипание выключено, пока проп не задан. */
  enabled: boolean;
  animated: boolean;
}

/**
 * Прилипание к концу списка при добавлении контента.
 *
 * Зачем нужно: в переписке новое сообщение обязано оказаться на экране само,
 * без скролла руками.
 *
 * Какие проблемы решает:
 * - скролл откладывается на следующий кадр: к этому моменту новый контент уже
 *   разложен, и конец списка посчитан по фактическим размерам, а не по оценкам;
 * - на этом кадре условие перепроверяется — если пользователь успел отвести
 *   список от конца, прилипание отменяется, чтобы не выдёргивать ленту у него
 *   из-под пальца;
 * - пока идёт одно прилипание, повторные запросы копятся в один отложенный:
 *   пачка сообщений не должна давать пачку конкурирующих скроллов.
 */
export class MaintainScrollAtEnd {
  private options: IMaintainScrollAtEndOptions;

  private phase: "idle" | "pending" | "active" = "idle";
  private queued = false;
  /** Смещение на момент запроса — по нему видно, тронул ли список пользователь. */
  private offsetAtRequest = 0;

  constructor(options: IMaintainScrollAtEndOptions) {
    this.options = options;
  }

  /** Новые настройки: список пересоздаёт их на каждом рендере. */
  setOptions(options: IMaintainScrollAtEndOptions): void {
    this.options = options;
  }

  /** Идёт программное прилипание — пороги кромок в это время не проверяются. */
  isActive(): boolean {
    return this.phase !== "idle";
  }

  /**
   * Пользователь взял список в руки — прилипание отменяется.
   *
   * Зачем отдельный сигнал: пока идёт анимированная доводка, смещение двигает
   * она сама, и по нему жест не отличить. А выдёргивать ленту из-под пальца
   * нельзя ни при каких обстоятельствах.
   */
  cancel(): void {
    this.phase = "idle";
    this.queued = false;
  }

  /**
   * Запросить прилипание.
   *
   * @param atEnd был ли список у конца **до** изменения, из-за которого вызван.
   *   Читать флаг здесь нельзя: добавленная снизу строка сама уводит список от
   *   конца, и флаг, снятый после неё, отвечает уже на другой вопрос — «у конца
   *   ли мы теперь», а не «был ли пользователь там, когда контент вырос».
   *   Строка выше порога гасила бы ровно то прилипание, ради которого её и
   *   добавили.
   * @returns true, если прилипание будет выполнено.
   */
  run(
    atEnd = this.options.store.peek("isWithinMaintainScrollAtEndThreshold") ??
      false,
  ): boolean {
    const { enabled } = this.options;

    if (!enabled || !atEnd) {
      this.queued = false;

      return false;
    }

    if (this.phase !== "idle") {
      this.queued = true;

      return true;
    }

    this.queued = false;
    this.phase = "pending";
    this.offsetAtRequest = this.options.adapter()?.getOffset?.() ?? 0;

    requestAnimationFrame(() => this.commit());

    return true;
  }

  private commit(): void {
    const { adapter, animated } = this.options;
    const offset = adapter()?.getOffset?.() ?? this.offsetAtRequest;

    // За кадр пользователь мог увести список от конца — прилипание отменяется.
    // Сравнивается именно смещение, а не флаг «у конца»: тот к этому моменту
    // уже погашен самой добавленной строкой, и по нему «пользователь ушёл» и
    // «внизу добавилось» неразличимы. Смещение же меняет только пользователь.
    if (Math.abs(offset - this.offsetAtRequest) > USER_MOVE_EPSILON) {
      this.phase = "idle";
      this.queued = false;

      return;
    }

    this.phase = "active";
    adapter()?.scrollToEnd(animated);

    const settle = () => {
      if (this.phase !== "active") return;

      this.phase = "idle";
      // Доводка закончилась — дальше отсчёт «тронул ли пользователь» идёт от
      // нового смещения, а не от того, что было до неё.
      this.offsetAtRequest = adapter()?.getOffset?.() ?? this.offsetAtRequest;

      // Пока шла доводка, контент мог вырасти ещё: очередь помнит, что
      // пользователь был у конца, и повторной проверки флага ей не нужно.
      if (this.queued) this.run(true);
    };

    if (animated) {
      setTimeout(settle, ANIMATED_SETTLE_MS);
    } else {
      settle();
    }
  }
}
