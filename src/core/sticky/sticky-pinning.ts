import type { IAnchorListStickyConfig } from "../../types";
import type { IStickyState } from "./sticky-anchors";

/** Соседей активного якоря держим смонтированными по обе стороны. */
const NEIGHBOUR_RADIUS = 1;

/**
 * Индексы, которые нужно держать смонтированными вне буфера отрисовки.
 *
 * Зачем нужны: прилипший элемент виден у кромки, когда его группа давно ушла за
 * пределы буфера. Отпустить его контейнер — значит увидеть, как прилипшая шапка
 * исчезает с экрана.
 *
 * Соседи по набору держатся тоже: следующий якорь подъезжает снизу и
 * выталкивает текущий, и делать это ему нужно уже смонтированным — иначе
 * замена активного якоря видна как подмена на месте.
 */
export const getPinnedStickyIndices = (
  configs: IAnchorListStickyConfig[],
  states: IStickyState[],
): number[] => {
  const pinned: number[] = [];

  for (const state of states) {
    if (state.activeIndex === -1) continue;

    const config = configs.find(item => item.edge === state.edge);

    if (!config) continue;

    const arrayIndex = config.indices.indexOf(state.activeIndex);

    for (let offset = -NEIGHBOUR_RADIUS; offset <= NEIGHBOUR_RADIUS; offset++) {
      const index = config.indices[arrayIndex + offset];

      if (index !== undefined && !pinned.includes(index)) pinned.push(index);
    }
  }

  return pinned;
};
