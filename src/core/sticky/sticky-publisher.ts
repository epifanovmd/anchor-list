import { logStickyActive } from "../../debug";
import type { ListStore } from "../../model";
import type { StickyAnchors } from "./sticky-anchors";

/** Зависимости публикации активных якорей. */
export interface IStickyPublisherOptions {
  store: ListStore;
  anchors: StickyAnchors;
}

/**
 * Публикация активных якорей в сигналы.
 *
 * Зачем нужна: индекс прилипшего элемента нужен не только самому контейнеру —
 * его читает внешний код через `sharedValues`, чтобы, например, подсветить
 * текущую дату в переписке.
 *
 * Какую проблему решает: возвращает индексы, которые обязаны остаться
 * смонтированными. Прилипший элемент виден у кромки, когда его группа давно за
 * пределами буфера отрисовки, и обычный диапазон его бы отпустил.
 *
 * @returns индексы, удерживаемые вне буфера отрисовки.
 */
export class StickyPublisher {
  private readonly options: IStickyPublisherOptions;

  constructor(options: IStickyPublisherOptions) {
    this.options = options;
  }

  resolve(scroll: number, scrollLength: number): number[] {
    const { store, anchors } = this.options;

    if (!anchors.hasAnchors()) {
      store.set("activeStickyStartIndex", -1);
      store.set("activeStickyEndIndex", -1);

      return [];
    }

    const states = anchors.resolve(scroll, scrollLength);

    for (const state of states) {
      const signal =
        state.edge === "start"
          ? "activeStickyStartIndex"
          : "activeStickyEndIndex";

      store.set(signal, state.activeIndex);

      logStickyActive({
        edge: state.edge,
        index: state.activeIndex,
        limit: state.limit,
        scroll: Math.round(scroll),
        viewport: Math.round(scrollLength),
      });
    }

    return anchors.getPinnedIndices(states);
  }
}
