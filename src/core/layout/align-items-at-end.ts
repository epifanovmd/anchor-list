import type { ListMetrics, ListStore } from "../../model";

/** Сколько удерживать прежнюю высоту контента при её уменьшении, мс. */
const HOLD_CONTENT_SIZE_MS = 16;

/** Зависимости распорки, прижимающей короткий контент к концу. */
export interface IAlignItemsAtEndOptions {
  store: ListStore;
  metrics: ListMetrics;
  /** Проп включён: короткий контент прижимается к концу. */
  isEnabled: () => boolean;
  getScrollLength: () => number;
}

/**
 * Распорка, прижимающая короткий контент к концу списка.
 *
 * Зачем нужна: в переписке первые сообщения обязаны стоять внизу экрана, а не
 * висеть под навбаром. Пока контента меньше экрана, разницу добирает распорка.
 *
 * Какую проблему решает: при уменьшении распорки суммарная высота удерживается
 * на кадр. Иначе ScrollView сожмёт контент раньше, чем разложены новые позиции,
 * и скролл дёрнется — новое сообщение приезжает вместе с прыжком.
 */
export class AlignItemsAtEnd {
  private readonly options: IAlignItemsAtEndOptions;

  constructor(options: IAlignItemsAtEndOptions) {
    this.options = options;
  }

  /** Пересчитать распорку под текущие размеры контента и вьюпорта. */
  update(): void {
    const { store, metrics, isEnabled, getScrollLength } = this.options;

    if (!isEnabled()) return;

    const previous = store.peek("alignItemsAtEndPadding") ?? 0;
    const next = Math.max(0, getScrollLength() - metrics.getTotalSize());

    if (next === previous) return;

    if (next < previous) {
      const held = (store.peek("totalSize") ?? 0) + previous;

      store.set("totalSize", held);

      setTimeout(() => {
        store.set("totalSize", metrics.getTotalSize() + next);
      }, HOLD_CONTENT_SIZE_MS);
    }

    store.set("alignItemsAtEndPadding", next);
  }
}
