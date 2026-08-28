import type { ListMetrics } from "../../model";
import type {
  AnchorListStickyEdge,
  IAnchorListStickyConfig,
} from "../../types";

/**
 * Является ли элемент якорем и на какой кромке.
 *
 * Нужно привязке контейнеров: якорь рисуется поверх соседей и подрезке по
 * вьюпорту не подлежит — он за своими границами и живёт.
 */
export const getStickyEdgeOf = (
  configs: IAnchorListStickyConfig[],
  index: number,
): AnchorListStickyEdge | null => {
  for (const config of configs) {
    if (config.indices.includes(index)) return config.edge;
  }

  return null;
};

/**
 * Предел смещения якоря.
 *
 * Зачем нужен: без предела все якоря набора липнут к кромке наравне и
 * накладываются друг на друга. Предел — это точка, где текущий якорь обязан
 * уступить место соседнему.
 *
 * Считается для каждого якоря, а не только для активного, и зависит только от
 * геометрии соседей, но не от позиции скролла: иначе значение менялось бы на
 * каждом кадре прокрутки и дёргало worklet прилипания.
 *
 * У начальной кромки предел — точка, куда текущий якорь выталкивает подъезжающий
 * снизу следующий. У конечной — верх собственной группы: объект не должен
 * всплывать выше своих сообщений.
 */
export const getStickyLimitOf = (
  configs: IAnchorListStickyConfig[],
  metrics: ListMetrics,
  index: number,
): number | undefined => {
  for (const config of configs) {
    const arrayIndex = config.indices.indexOf(index);

    if (arrayIndex === -1) continue;

    if (config.edge === "start") {
      const nextIndex = config.indices[arrayIndex + 1];

      // Следующий якорь подъезжает снизу и выталкивает текущий за кромку.
      return nextIndex === undefined
        ? undefined
        : metrics.getPosition(nextIndex) - metrics.getSize(index);
    }

    // Начало группы, если оно объявлено явно.
    const groupStart = config.groupStarts?.[arrayIndex];

    if (groupStart !== undefined) {
      return metrics.getPosition(groupStart) + (config.limitInset ?? 0);
    }

    const previousIndex = config.indices[arrayIndex - 1];

    // Иначе — строка сразу за предыдущим якорем.
    return metrics.getPosition(
      previousIndex === undefined ? 0 : previousIndex + 1,
    );
  }

  return undefined;
};
