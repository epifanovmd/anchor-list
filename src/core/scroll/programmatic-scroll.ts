import { logScrollProgram } from "../../debug";
import type { ScrollAdapterRef } from "./scroll-adapter";

/** Сколько ждать завершения анимированного программного скролла, мс. */
const PROGRAMMATIC_SCROLL_SETTLE_MS = 500;
/** Сколько ждать затишья замеров перед единственной доводкой к концу, мс. */
const END_CORRECTION_DEBOUNCE_MS = 50;

/** Зависимости программного скролла. */
export interface IProgrammaticScrollOptions {
  adapter: ScrollAdapterRef;
}

/**
 * Программный скролл списка.
 *
 * Зачем нужен: `scrollToIndex`, `scrollToOffset` и `scrollToEnd` двигают
 * позицию сами, без участия пользователя.
 *
 * Какую проблему решает: помечает такое движение как своё. На пометку смотрят
 * пороги подгрузки — иначе переезд к концу списка немедленно запускает
 * подгрузку — и расчёт скорости: прыжок на тысячи точек за одно событие даёт
 * скорость, какой палец не даёт, а по ней список решает, раздувать ли запас
 * отрисовки и компенсировать ли замеры.
 *
 * Для фиксированного смещения пометка живёт до события, которое переезд вызвал:
 * событие приходит следующим кадром, и снять её вызовом значит отдать этот
 * прыжок пользователю. Цель «конец» живёт до затишья: первый переезд монтирует
 * последние строки, их замеры могут увеличить контент, и тогда список должен
 * повторно довести нативный скролл до уже уточнённой границы.
 */
export class ProgrammaticScroll {
  private readonly options: IProgrammaticScrollOptions;

  private active = false;
  /** Мгновенный переезд ждёт события, которое сам и вызвал. */
  private awaitingEvent = false;
  /** Команда должна оставаться у конца, пока высота контента уточняется. */
  private targetingEnd = false;
  /** Повторная доводка сохраняет семантику исходной команды. */
  private endAnimated = false;
  private settleTimeout: ReturnType<typeof setTimeout> | undefined;
  private endCorrectionTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(options: IProgrammaticScrollOptions) {
    this.options = options;
  }

  /** Идёт программный скролл: пороги кромок в это время не проверяются. */
  isActive(): boolean {
    return this.active;
  }

  /** Скролл всё ещё доводится до уточняющегося конца контента. */
  isTargetingEnd(): boolean {
    return this.targetingEnd;
  }

  /**
   * Событие скролла пришло: не пора ли снимать пометку.
   *
   * Мгновенный переезд кончается не вызовом, а событием, которое он вызвал:
   * событие приходит следующим кадром, и сними пометку раньше — прыжок на
   * тысячи точек посчитается движением пользователя со всеми последствиями.
   */
  onScrollEvent(): void {
    if (!this.awaitingEvent) return;

    this.awaitingEvent = false;
    this.active = false;
    this.targetingEnd = false;
    this.endAnimated = false;
    this.clearTimeout();
  }

  /** Скролл к смещению в координатах контента. */
  toOffset(offset: number, animated: boolean): boolean {
    const adapter = this.options.adapter();

    this.clearEndCorrection();

    if (!adapter) {
      this.cancel();

      return false;
    }

    this.targetingEnd = false;
    this.endAnimated = false;
    this.active = true;
    logScrollProgram({
      target: offset,
      from: adapter.getOffset?.(),
      animated,
      reason: "вызов",
    });
    adapter.scrollToOffset(offset, animated);
    this.settle(animated);

    return true;
  }

  /** Скролл к концу контента. */
  toEnd(animated: boolean): boolean {
    const adapter = this.options.adapter();

    this.clearEndCorrection();

    if (!adapter) {
      this.cancel();

      return false;
    }

    this.targetingEnd = true;
    this.endAnimated = animated;
    this.active = true;
    logScrollProgram({
      target: "конец",
      from: adapter.getOffset?.(),
      animated,
      reason: "вызов",
    });
    adapter.scrollToEnd(animated);
    this.settle(animated);

    return true;
  }

  /** Повторная доводка после того, как нативный контент изменил высоту. */
  reapplyEnd(): boolean {
    if (!this.targetingEnd) return false;

    const adapter = this.options.adapter();

    this.clearEndCorrection();

    if (!adapter) {
      this.cancel();

      return false;
    }

    this.active = true;
    logScrollProgram({
      target: "конец",
      from: adapter.getOffset?.(),
      animated: this.endAnimated,
      reason: "доводка конца",
    });
    adapter.scrollToEnd(this.endAnimated);
    this.settle(this.endAnimated);

    return true;
  }

  /**
   * Планирует одну доводку после серии изменений нативной высоты.
   *
   * Строки сообщают размеры не атомарно: немедленный scrollToEnd на каждый
   * замер превращает один переезд в видимую лестницу. Короткое затишье склеивает
   * всю волну измерений и оставляет только её итоговую границу.
   */
  scheduleEndCorrection(): boolean {
    if (!this.targetingEnd) return false;

    this.clearTimeout();
    this.clearEndCorrection();
    this.active = true;
    this.endCorrectionTimeout = setTimeout(() => {
      this.endCorrectionTimeout = undefined;
      this.reapplyEnd();
    }, END_CORRECTION_DEBOUNCE_MS);

    return true;
  }

  /**
   * Мгновенный скролл к смещению ждёт своего события; цель конца и
   * анимированный переезд живут до таймера — нативный слой не даёт события,
   * которое во всех случаях точно означает их окончание.
   */
  private settle(animated: boolean): void {
    this.clearTimeout();
    // У конца первое событие ещё не означает завершение: после него контент
    // может вырасти из-за замеров только что смонтированных строк.
    this.awaitingEvent = !animated && !this.targetingEnd;

    // Таймер нужен обоим: анимированному — как единственный способ узнать
    // окончание, мгновенному — как страховка. Своё событие может и не прийти:
    // запрошенное смещение совпало с текущим или его обрезала граница контента.
    this.settleTimeout = setTimeout(() => {
      this.settleTimeout = undefined;
      this.awaitingEvent = false;
      this.active = false;
      this.targetingEnd = false;
      this.endAnimated = false;
    }, PROGRAMMATIC_SCROLL_SETTLE_MS);
  }

  /** Пользовательский жест или размонтирование отменяет программную цель. */
  cancel(): void {
    this.clearTimeout();
    this.clearEndCorrection();
    this.awaitingEvent = false;
    this.active = false;
    this.targetingEnd = false;
    this.endAnimated = false;
  }

  /** Снятие таймера при размонтировании списка. */
  dispose(): void {
    this.cancel();
  }

  private clearTimeout(): void {
    if (this.settleTimeout) clearTimeout(this.settleTimeout);

    this.settleTimeout = undefined;
  }

  private clearEndCorrection(): void {
    if (this.endCorrectionTimeout) clearTimeout(this.endCorrectionTimeout);

    this.endCorrectionTimeout = undefined;
  }
}
