import { anchorListInitialScrollDebug } from "../../debug/initial-scroll-debug";
import type { AnchorListInitialScroll } from "../../types";

/** Зависимости начального скролла. */
export interface IInitialScrollOptions {
  getTarget: () => AnchorListInitialScroll | undefined;
  /** Смещение, к которому нужно прийти; undefined — цель ещё не вычислима. */
  resolveOffset: () => number | undefined;
  /** @returns false, если нативный адаптер ещё не подключён. */
  scrollToOffset: (offset: number) => boolean | void;
  /** Все элементы до цели измерены — позиция больше не уедет. */
  isTargetSettled: () => boolean;
  /** Из чего сложилась цель — печатается диагностикой. */
  describeTarget?: () => Record<string, unknown>;
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
 * Пока начальный скролл активен, пороги кромок не проверяются: иначе открытие
 * списка у конца сразу же вызывает подгрузку.
 */
export class InitialScroll {
  private readonly options: IInitialScrollOptions;

  private finished = false;
  private attempts = 0;
  private scheduledFrame: number | undefined;

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
      anchorListInitialScrollDebug.log("wait", {
        attempt: this.attempts,
        ...this.options.describeTarget?.(),
      });

      return;
    }

    const applied = this.options.scrollToOffset(offset);

    if (applied === false) return;

    this.attempts += 1;

    const settled = this.options.isTargetSettled();

    anchorListInitialScrollDebug.log("apply", {
      attempt: this.attempts,
      offset,
      settled,
      ...this.options.describeTarget?.(),
    });

    if (settled) {
      anchorListInitialScrollDebug.log("finish", {
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

  /** Прекратить доводку и показать список. */
  finish(): void {
    if (this.finished) return;

    this.finished = true;
    this.cancelScheduledFrame();
    anchorListInitialScrollDebug.log("reveal", { attempts: this.attempts });
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
