import type { AnchorListInitialScroll } from "../../types";

/** Зависимости начального скролла. */
export interface IInitialScrollOptions {
  target: AnchorListInitialScroll | undefined;
  /** Смещение, к которому нужно прийти; undefined — цель ещё не вычислима. */
  resolveOffset: () => number | undefined;
  scrollToOffset: (offset: number) => void;
  /** Все элементы до цели измерены — позиция больше не уедет. */
  isTargetSettled: () => boolean;
  onFinished: () => void;
}

/** Сколько кадров пытаться уточнить позицию до сдачи. */
const MAX_ATTEMPTS = 10;

/**
 * Начальный скролл.
 *
 * Цель считается по метрикам, но до измерения ячеек размеры оценочные, поэтому
 * после каждого кадра измерений позиция цели уезжает. Скролл повторяется, пока
 * все элементы до цели не измерены — иначе список открывается на позиции,
 * посчитанной по оценкам, и заметно доводится уже на глазах у пользователя.
 *
 * Пока начальный скролл активен, пороги кромок не проверяются: иначе открытие
 * списка у конца сразу же вызывает подгрузку.
 */
export class InitialScroll {
  private readonly options: IInitialScrollOptions;

  private finished = false;
  private attempts = 0;
  private scheduled = false;

  constructor(options: IInitialScrollOptions) {
    this.options = options;
  }

  /** Начальная позиция ещё не доведена. */
  isActive(): boolean {
    return !this.finished;
  }

  /** Попытка применить начальную позицию. Вызывается после раскладки. */
  apply(): void {
    if (this.finished || this.scheduled) return;

    // Стартовая позиция не задана: показать список решает вызывающий — по
    // готовности измерений, а не по факту первой раскладки.
    if (!this.options.target) return;

    const offset = this.options.resolveOffset();

    if (offset === undefined) return;

    this.options.scrollToOffset(offset);
    this.attempts += 1;

    if (this.options.isTargetSettled() || this.attempts >= MAX_ATTEMPTS) {
      this.finish();

      return;
    }

    // Размеры ещё уточняются — повторяем на следующем кадре.
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.apply();
    });
  }

  /** Прекратить доводку и показать список. */
  finish(): void {
    if (this.finished) return;

    this.finished = true;
    this.options.onFinished();
  }
}
