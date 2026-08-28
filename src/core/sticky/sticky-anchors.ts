import type { ListMetrics } from "../../model";
import type {
  AnchorListStickyEdge,
  IAnchorListStickyConfig,
} from "../../types";
import { getPinnedStickyIndices } from "./sticky-pinning";

/** Зависимости расчёта прилипающих якорей. */
export interface IStickyAnchorsOptions {
  metrics: ListMetrics;
}

/** Активный якорь кромки и границы его хода. */
export interface IStickyState {
  edge: AnchorListStickyEdge;
  /** Индекс прилипшего элемента; -1 — на этой кромке никто не прилип. */
  activeIndex: number;
  /**
   * Предел смещения: для начальной кромки — куда якорь выталкивает следующий,
   * для конечной — верх собственной группы, выше которого подниматься нельзя.
   */
  limit: number | undefined;
}

const EMPTY_CONFIGS: IAnchorListStickyConfig[] = [];

/**
 * Выбор активных прилипающих элементов.
 *
 * Зачем нужен: на каждой кромке прилипшим может быть ровно один элемент — тот,
 * что её пересекает. Для начальной кромки это последний элемент, ушедший за неё
 * вверх; для конечной — первый, чей низ оказался ниже неё.
 *
 * Какую проблему решает: отделяет выбор якоря (JS, на пересчёте раскладки) от
 * его смещения (worklet, на каждом кадре скролла). Активный якорь меняется
 * редко — на границах групп, — а смещение считается непрерывно, и считать их
 * вместе значило бы гонять пересчёт диапазона на каждом кадре.
 */
export class StickyAnchors {
  private readonly options: IStickyAnchorsOptions;
  private configs: IAnchorListStickyConfig[] = [];
  private readonly edgeByIndex = new Map<number, AnchorListStickyEdge>();
  private readonly configByIndex = new Map<
    number,
    { config: IAnchorListStickyConfig; order: number }
  >();

  constructor(options: IStickyAnchorsOptions) {
    this.options = options;
  }

  /** Новые наборы якорей; индексы адресуют текущие данные. */
  setConfigs(configs: IAnchorListStickyConfig[] | undefined): void {
    const next = configs ?? EMPTY_CONFIGS;

    if (this.configs === next) return;

    this.configs = next;
    this.edgeByIndex.clear();
    this.configByIndex.clear();

    for (const config of next) {
      for (let order = 0; order < config.indices.length; order++) {
        const index = config.indices[order]!;

        // При пересечении наборов сохраняется прежняя семантика: побеждает
        // первый набор в конфигурации.
        if (!this.edgeByIndex.has(index))
          this.edgeByIndex.set(index, config.edge);
        if (!this.configByIndex.has(index)) {
          this.configByIndex.set(index, { config, order });
        }
      }
    }
  }

  /** Есть ли вообще прилипающие элементы. */
  hasAnchors(): boolean {
    return this.configs.some(config => config.indices.length > 0);
  }

  /** Является ли элемент якорем, и на какой кромке. */
  getEdgeOf(index: number): AnchorListStickyEdge | null {
    return this.edgeByIndex.get(index) ?? null;
  }

  /** Предел смещения якоря; см. {@link getStickyLimitOf}. */
  getLimitOf(index: number): number | undefined {
    const entry = this.configByIndex.get(index);

    if (!entry) return undefined;

    const { metrics } = this.options;
    const { config, order } = entry;

    if (config.edge === "start") {
      const nextIndex = config.indices[order + 1];

      return nextIndex === undefined
        ? undefined
        : metrics.getPosition(nextIndex) - metrics.getSize(index);
    }

    const groupStart = config.groupStarts?.[order];

    if (groupStart !== undefined) {
      return metrics.getPosition(groupStart) + (config.limitInset ?? 0);
    }

    const previousIndex = config.indices[order - 1];

    return metrics.getPosition(
      previousIndex === undefined ? 0 : previousIndex + 1,
    );
  }

  /**
   * Активные якоря на текущей позиции скролла.
   *
   * `edgeOffset` — отступ кромки: сверху навбар, снизу панель ввода. Здесь
   * берётся его последнее значение с UI-потока, точное положение доводится
   * в worklet.
   */
  resolve(scroll: number, scrollLength: number): IStickyState[] {
    return this.configs.map(config =>
      config.edge === "start"
        ? this.resolveStart(config, scroll)
        : this.resolveEnd(config, scroll, scrollLength),
    );
  }

  /** Последний якорь, ушедший за начальную кромку. */
  private resolveStart(
    config: IAnchorListStickyConfig,
    scroll: number,
  ): IStickyState {
    const { metrics } = this.options;
    const { indices } = config;
    const edgePosition = scroll + (config.offset?.value ?? 0);

    let low = 0;
    let high = indices.length - 1;
    let found = -1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = indices[middle]!;

      if (metrics.getPosition(candidate) <= edgePosition) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (found !== -1) {
      const activeIndex = indices[found]!;

      return {
        edge: "start",
        activeIndex,
        limit: this.getLimitOf(activeIndex),
      };
    }

    return { edge: "start", activeIndex: -1, limit: undefined };
  }

  /** Первый якорь, чей низ оказался ниже конечной кромки. */
  private resolveEnd(
    config: IAnchorListStickyConfig,
    scroll: number,
    scrollLength: number,
  ): IStickyState {
    const { metrics } = this.options;
    const { indices } = config;
    const edgePosition = scroll + scrollLength - (config.offset?.value ?? 0);

    let low = 0;
    let high = indices.length - 1;
    let found = -1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = indices[middle]!;
      const bottom =
        metrics.getPosition(candidate) + metrics.getSize(candidate);

      if (bottom > edgePosition) {
        found = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }

    if (found !== -1) {
      const activeIndex = indices[found]!;

      return { edge: "end", activeIndex, limit: this.getLimitOf(activeIndex) };
    }

    return { edge: "end", activeIndex: -1, limit: undefined };
  }

  /** Индексы, которые нужно держать смонтированными вне буфера отрисовки. */
  getPinnedIndices(states: IStickyState[]): number[] {
    return getPinnedStickyIndices(this.configs, states);
  }
}
