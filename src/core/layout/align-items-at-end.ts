import type { ListMetrics, ListStore } from "../../model";

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
 * Какую проблему решает: высоту элементов ({@link ListMetrics.getTotalSize})
 * распорка не трогает — она добирается снаружи слоя контейнеров. Слой задаёт
 * свою высоту тем же сигналом `totalSize`, и подмешанная в него распорка
 * сделала бы слой выше содержимого: последняя строка встала бы не у нижней
 * кромки, а выше неё ровно на распорку.
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

    store.set("alignItemsAtEndPadding", next);
  }
}
