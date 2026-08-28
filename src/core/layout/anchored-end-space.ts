import type { ListMetrics, ListStore } from "../../model";
import type { IAnchorListAnchoredEndSpace } from "../../types";

/** Зависимости распорки у конца списка. */
export interface IAnchoredEndSpaceOptions {
  store: ListStore;
  metrics: ListMetrics;
  getConfig: () => IAnchorListAnchoredEndSpace | undefined;
  getScrollLength: () => number;
}

/**
 * Распорка у конца списка.
 *
 * Зачем нужна: резервирует место так, чтобы якорный элемент мог подняться к
 * верхней кромке вьюпорта, даже когда контента под ним не хватает. Так работает
 * переход к цитируемому сообщению у самого конца переписки.
 *
 * Какую проблему решает: входит в отступ конца, поэтому расстояние до кромки
 * для порогов считается без неё — иначе подгрузка срабатывала бы на пустом
 * месте, приняв распорку за непрочитанный контент.
 */
export class AnchoredEndSpace {
  private readonly options: IAnchoredEndSpaceOptions;

  constructor(options: IAnchoredEndSpaceOptions) {
    this.options = options;
  }

  /** Пересчитать размер распорки под текущую раскладку. */
  update(): void {
    const { store, metrics, getConfig, getScrollLength } = this.options;
    const config = getConfig();

    if (!config) return;

    if (config.anchorIndex < 0 || config.anchorIndex >= metrics.getCount()) {
      return;
    }

    const anchorPosition = metrics.getPosition(config.anchorIndex);
    const { anchorOffset = 0, maxSize } = config;
    const contentBelowAnchor = metrics.getTotalSize() - anchorPosition;
    const needed = Math.max(
      0,
      getScrollLength() - contentBelowAnchor - anchorOffset,
    );
    const size = maxSize === undefined ? needed : Math.min(needed, maxSize);

    if (size === (store.peek("anchoredEndSpaceSize") ?? 0)) return;

    store.set("anchoredEndSpaceSize", size);
    config.onSizeChanged?.(size);
  }
}
