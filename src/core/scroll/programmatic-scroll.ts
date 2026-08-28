import type { ScrollAdapterRef } from "./scroll-adapter";

/** Сколько ждать завершения анимированного программного скролла, мс. */
const PROGRAMMATIC_SCROLL_SETTLE_MS = 500;

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
 * Какую проблему решает: помечает такое движение как своё. Пороги подгрузки
 * проверяются только на движение пользователя — иначе программный переезд к
 * концу списка немедленно запускает подгрузку. Анимированный скролл идёт
 * кадрами уже после вызова, поэтому пометка снимается по таймеру, а не сразу.
 */
export class ProgrammaticScroll {
  private readonly options: IProgrammaticScrollOptions;

  private active = false;
  private settleTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(options: IProgrammaticScrollOptions) {
    this.options = options;
  }

  /** Идёт программный скролл: пороги кромок в это время не проверяются. */
  isActive(): boolean {
    return this.active;
  }

  /** Скролл к смещению в координатах контента. */
  toOffset(offset: number, animated: boolean): void {
    this.active = true;
    this.options.adapter()?.scrollToOffset(offset, animated);
    this.settle(animated);
  }

  /** Скролл к концу контента. */
  toEnd(animated: boolean): void {
    this.active = true;
    this.options.adapter()?.scrollToEnd(animated);
    this.settle(animated);
  }

  /**
   * Мгновенный скролл заканчивается вместе с вызовом; анимированный идёт
   * кадрами, и его окончания приходится ждать по времени — событий, по которым
   * его можно было бы поймать точно, нативный слой не даёт.
   */
  private settle(animated: boolean): void {
    this.clearTimeout();

    if (!animated) {
      this.active = false;

      return;
    }

    this.settleTimeout = setTimeout(() => {
      this.settleTimeout = undefined;
      this.active = false;
    }, PROGRAMMATIC_SCROLL_SETTLE_MS);
  }

  /** Снятие таймера при размонтировании списка. */
  dispose(): void {
    this.clearTimeout();
    this.active = false;
  }

  private clearTimeout(): void {
    if (this.settleTimeout) clearTimeout(this.settleTimeout);

    this.settleTimeout = undefined;
  }
}
