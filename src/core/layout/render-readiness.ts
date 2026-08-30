import type { ListMetrics } from "../../model";
import type { IAnchorListRange } from "./visible-range";

/** Сколько ждать измерений перед первым показом списка, мс. */
const READY_FALLBACK_MS = 150;

/**
 * Сколько кругов страховка ждёт, прежде чем показать список как есть.
 *
 * Ждать приходится замера контента — без него стартовую позицию не применить —
 * и замеров строк, пока те меняют раскладку. И то и другое приходит первыми
 * кадрами; десять кругов — заведомо больше, чем нужно, и всё же конечно: не
 * придут замеры вовсе — список всё равно показывается.
 */
const MAX_FALLBACK_ROUNDS = 10;

/** Зависимости первого показа списка. */
export interface IRenderReadinessOptions {
  metrics: ListMetrics;
  getRange: () => IAnchorListRange;
  getCount: () => number;
  /** Стартовая позиция задана пропом: показом распоряжается начальный скролл. */
  hasInitialTarget: () => boolean;
  /** Счётчик изменений раскладки: растёт от каждого применённого замера. */
  getLayoutRevision: () => number;
  /** Начальный скролл ещё не завершён. */
  isPending: () => boolean;
  /**
   * Показать список.
   *
   * @param cause чем вызван показ: измерениями видимых строк или страховкой.
   * @param rounds сколько кругов прождала страховка — печатается диагностикой.
   */
  finish: (cause: string, rounds: number) => void;
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

  /** Сколько кругов страховка уже прождала. */
  private fallbackRounds = 0;

  /** Раскладка на момент завода круга: по ней видно, узнал ли список новое. */
  private fallbackRevision = 0;

  constructor(options: IRenderReadinessOptions) {
    this.options = options;
  }

  /** Показать список, если видимая часть уже измерена. */
  reveal(): void {
    const { hasInitialTarget, isPending, getCount, finish } = this.options;

    if (!isPending() || hasInitialTarget()) return;
    if (getCount() !== 0 && !this.isVisibleRangeMeasured()) return;

    finish("замеры", this.fallbackRounds);
  }

  /** Завести страховку на случай, когда измерений не будет вовсе. */
  scheduleFallback(): void {
    if (this.fallbackTimeout || !this.options.isPending()) return;

    this.fallbackRevision = this.options.getLayoutRevision();

    this.fallbackTimeout = setTimeout(() => {
      this.fallbackTimeout = undefined;

      // Список ещё узнаёт размеры: за круг замеры снова меняли раскладку.
      const learning =
        this.options.getLayoutRevision() !== this.fallbackRevision;

      // Ждать есть чего в двух случаях. Стартовая позиция ещё доводится: команда
      // могла уже уйти, но целевые контейнеры всё ещё ждут нативный commit и
      // измерение. Либо замеры вообще ещё идут: показанный сейчас кадр
      // переложится на глазах.
      const waiting = this.options.hasInitialTarget() || learning;

      if (waiting && this.fallbackRounds < MAX_FALLBACK_ROUNDS) {
        this.fallbackRounds += 1;
        this.scheduleFallback();

        return;
      }

      this.options.finish("страховка", this.fallbackRounds);
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
