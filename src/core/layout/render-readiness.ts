import type { ListMetrics } from "../../model";
import type { IAnchorListRange } from "./visible-range";

/** Сколько ждать измерений перед первым показом списка, мс. */
const READY_FALLBACK_MS = 150;

/** Зависимости первого показа списка. */
export interface IRenderReadinessOptions {
  metrics: ListMetrics;
  getRange: () => IAnchorListRange;
  getCount: () => number;
  /** Стартовая позиция задана пропом: показом распоряжается начальный скролл. */
  hasInitialTarget: () => boolean;
  /** Начальный скролл ещё не завершён. */
  isPending: () => boolean;
  /** Показать список. */
  finish: () => void;
}

/**
 * Первый показ списка.
 *
 * Зачем нужна: до измерений позиции оценочные, и строки с непохожей высотой
 * налезают друг на друга. Показывать такой кадр нельзя — он и есть та самая
 * каша при открытии.
 *
 * Какие проблемы решает:
 * - список раскрывается, когда видимые строки измерены, или когда их размеры
 *   объявлены пропом и измерять нечего;
 * - ждать измерений бесконечно тоже нельзя: их может не быть вовсе — пустые
 *   данные, нулевая высота ячейки, — и тогда список не показался бы никогда.
 *   На этот случай есть страховка по времени;
 * - при заданной стартовой позиции показом распоряжается начальный скролл: там
 *   ждать нужно не измерений, а того, что цель перестала уезжать.
 */
export class RenderReadiness {
  private readonly options: IRenderReadinessOptions;

  /** Страховка первого показа, если измерения так и не пришли. */
  private fallbackTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(options: IRenderReadinessOptions) {
    this.options = options;
  }

  /** Показать список, если видимая часть уже измерена. */
  reveal(): void {
    const { hasInitialTarget, isPending, getCount, finish } = this.options;

    if (!isPending() || hasInitialTarget()) return;
    if (getCount() !== 0 && !this.isVisibleRangeMeasured()) return;

    finish();
  }

  /** Завести страховку на случай, когда измерений не будет вовсе. */
  scheduleFallback(): void {
    if (this.fallbackTimeout || !this.options.isPending()) return;

    this.fallbackTimeout = setTimeout(() => {
      this.fallbackTimeout = undefined;
      this.options.finish();
    }, READY_FALLBACK_MS);
  }

  /** Снятие страховки при размонтировании списка. */
  dispose(): void {
    if (this.fallbackTimeout) clearTimeout(this.fallbackTimeout);

    this.fallbackTimeout = undefined;
  }

  private isVisibleRangeMeasured(): boolean {
    const { metrics, getRange } = this.options;
    const range = getRange();

    if (range.end < range.start) return false;

    for (let index = range.start; index <= range.end; index++) {
      const key = metrics.getKey(index);

      if (key === undefined || !metrics.hasMeasured(key)) return false;
    }

    return true;
  }
}
