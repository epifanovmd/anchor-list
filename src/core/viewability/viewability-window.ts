import type { ListMetrics } from "../../model";
import type { IAnchorListViewabilityConfig } from "../../types";

/** Условия одного пересчёта видимости. */
export interface IViewabilityContext {
  scroll: number;
  scrollLength: number;
  startBuffered: number;
  endBuffered: number;
}

/**
 * Ключи элементов, проходящих порог видимости.
 *
 * Зачем нужно: «элемент виден» — не одно условие, а два разных, и выбор между
 * ними зависит от размера ячейки.
 *
 * `itemVisiblePercentThreshold` меряет долю самого элемента и годится для
 * обычных строк. Для крупной ячейки, не помещающейся в экран целиком, он
 * недостижим в принципе — там работает `viewAreaCoveragePercentThreshold`,
 * доля занятого ею вьюпорта. Заданный порог покрытия имеет приоритет.
 *
 * Обход идёт только по буферизованному диапазону: за его пределами элементы не
 * смонтированы, и видимыми быть не могут по определению.
 */
export const collectViewableKeys = (
  metrics: ListMetrics,
  { scroll, scrollLength, startBuffered, endBuffered }: IViewabilityContext,
  {
    itemVisiblePercentThreshold,
    viewAreaCoveragePercentThreshold,
  }: IAnchorListViewabilityConfig,
): Set<string> => {
  const viewable = new Set<string>();

  for (let index = startBuffered; index <= endBuffered; index++) {
    const key = metrics.getKey(index);

    if (key === undefined) continue;

    const position = metrics.getPosition(index);
    const size = metrics.getSize(index);
    const visible =
      Math.min(position + size, scroll + scrollLength) -
      Math.max(position, scroll);

    if (visible <= 0) continue;

    const byItem = size > 0 ? (visible / size) * 100 : 0;
    const byViewport = scrollLength > 0 ? (visible / scrollLength) * 100 : 0;

    const isViewable =
      viewAreaCoveragePercentThreshold !== undefined
        ? byViewport >= viewAreaCoveragePercentThreshold
        : byItem >= (itemVisiblePercentThreshold ?? 0);

    if (isViewable) viewable.add(key);
  }

  return viewable;
};
