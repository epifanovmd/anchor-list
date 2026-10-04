import type { ListMetrics } from "../../model";
import type { AnchorListSnapAlign } from "../../types";
import { getItemScrollOffset } from "./item-offset";

/** Где во вьюпорте встаёт строка: доля, как у `viewPosition` в `scrollToIndex`. */
const VIEW_POSITION: Record<AnchorListSnapAlign, number> = {
  start: 0,
  center: 0.5,
  end: 1,
};

/** Раскладка и настройки, из которых считаются точки снапа. */
export interface ISnapOffsetsParams {
  metrics: ListMetrics;
  /** Строки-точки по возрастанию индекса; undefined — каждая строка. */
  indices: number[] | undefined;
  /** Начало элементов в координатах контента — высота шапки. */
  contentOrigin: number;
  scrollLength: number;
  /** Предел скролла: точка дальше него недостижима. */
  maxScroll: number;
  align: AnchorListSnapAlign;
  /** Сдвиг точки вверх, px: под навбар поверх списка и т. п. */
  offset: number;
}

/**
 * Смещения скролла, к которым притягивается инерция.
 *
 * Зачем нужно: снап делает нативный `ScrollView` — только так он работает в
 * инерции с физикой платформы, — а ему нужны смещения контента. Строки же
 * известны индексами и меняют высоту по мере измерения.
 *
 * Формула та же, что у `scrollToIndex` ({@link getItemScrollOffset}): снап и
 * программный переход ставят строку в одно и то же место. Точки за пределом
 * скролла сливаются в него — у конца контента строки уже не могут встать
 * туда, куда просят, и нативному слою не нужны десятки одинаковых точек.
 */
export const computeSnapOffsets = ({
  metrics,
  indices,
  contentOrigin,
  scrollLength,
  maxScroll,
  align,
  offset,
}: ISnapOffsetsParams): number[] => {
  const count = metrics.getCount();
  const viewPosition = VIEW_POSITION[align];
  const offsets: number[] = [];

  const add = (index: number) => {
    if (index < 0 || index >= count) return;

    const value = Math.min(
      Math.max(0, maxScroll),
      getItemScrollOffset({
        position: metrics.getPosition(index),
        size: metrics.getSize(index),
        scrollLength,
        viewPosition,
        viewOffset: offset,
        origin: contentOrigin,
      }),
    );
    const rounded = Math.round(value * 100) / 100;

    if (offsets[offsets.length - 1] !== rounded) offsets.push(rounded);
  };

  if (indices) {
    for (const index of indices) add(index);
  } else {
    for (let index = 0; index < count; index++) add(index);
  }

  return offsets;
};

/** Одинаковые ли наборы точек — по значениям: стор сравнивает по ссылке. */
export const haveSameSnapOffsets = (
  first: number[] | undefined,
  second: number[] | undefined,
): boolean => {
  if (first === second) return true;
  if (!first || !second || first.length !== second.length) return false;

  return first.every((value, index) => value === second[index]);
};
