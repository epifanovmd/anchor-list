import type { ListMetrics } from "../../model";

/** Якорь: элемент и его позиция до изменения раскладки. */
export interface IAnchor {
  key: string;
  index: number;
  position: number;
}

/** Раскладка, по которой снимаются якоря. */
export interface IAnchorPickParams {
  metrics: ListMetrics;
  scroll: number;
  scrollLength: number;
  /** Разрешён ли элемент как якорь восстановления. */
  shouldRestorePosition?: (index: number) => boolean;
}

/** Что нашёл выбор якорей на текущем экране. */
export interface IAnchorPick {
  /** Кандидаты сверху вниз: опорой станет первый переживший изменение. */
  anchors: IAnchor[];
  /** Первый элемент, начинающийся не выше кромки вьюпорта. */
  firstIndex: number;
  viewportEnd: number;
}

/**
 * Сколько запасных якорей снимать.
 *
 * Первая видимая строка вполне может не пережить то самое изменение, ради
 * которого якорь и снимался: строка загрузки наверху исчезает ровно тогда,
 * когда приходит подгруженная порция. Без запасных компенсация в этот момент
 * не выполнялась бы вовсе.
 */
const ANCHOR_CANDIDATES = 4;

/**
 * Выбор опорных элементов перед изменением раскладки.
 *
 * Зачем нужен: удержание позиции держит на месте не «экран», а конкретную
 * строку. Выбрать её нужно до изменения — по старой раскладке.
 *
 * Какие проблемы решает:
 * - берёт несколько кандидатов, а не один: первая видимая строка может исчезнуть
 *   в том же обновлении, которое и потребовало компенсации;
 * - предпочитает строки, целиком лежащие ниже кромки вьюпорта. Строка, торчащая
 *   над кромкой, видна лишь частью и своим размером тянет за собой всё, что под
 *   ней: изменись такая строка — и удержанным окажется её верх, а весь видимый
 *   контент уедет. Такие берутся, только когда других во вьюпорте нет вовсе;
 * - пропускает неизмеренные: у них позиция оценочная, доводить по ней нечего.
 */
export const pickAnchors = ({
  metrics,
  scroll,
  scrollLength,
  shouldRestorePosition,
}: IAnchorPickParams): IAnchorPick => {
  const count = metrics.getCount();
  const viewportEnd = scroll + scrollLength;
  const firstIndex = count === 0 ? 0 : metrics.findIndexAtOffset(scroll);

  if (count === 0) return { anchors: [], firstIndex, viewportEnd };

  const anchors: IAnchor[] = [];
  /** Строки, чей верх выше кромки вьюпорта — запасной вариант. */
  const partial: IAnchor[] = [];

  for (let index = firstIndex; index < count; index++) {
    const key = metrics.getKey(index);

    if (key === undefined) break;

    const position = metrics.getPosition(index);

    // Элемент целиком выше вьюпорта — его сдвиг пользователь не увидит.
    if (position + metrics.getSize(index) <= scroll) continue;

    // Вьюпорт кончился: дальше искать нечего.
    if (position > viewportEnd) break;

    // У неизмеренного элемента позиция оценочная: доводить по ней нечего.
    if (!metrics.hasMeasured(key)) continue;
    if (shouldRestorePosition && !shouldRestorePosition(index)) continue;

    if (position < scroll) {
      partial.push({ key, index, position });
      continue;
    }

    anchors.push({ key, index, position });

    if (anchors.length >= ANCHOR_CANDIDATES) break;
  }

  return {
    anchors: anchors.length === 0 ? partial : anchors,
    firstIndex,
    viewportEnd,
  };
};

/**
 * Первый якорь, переживший изменение, и его новая позиция.
 *
 * Строка могла исчезнуть из данных — тогда её позиция ничего не значит, и
 * опорой становится следующая из снятых.
 */
export const resolveAnchor = (
  anchors: IAnchor[],
  metrics: ListMetrics,
): { anchor: IAnchor; position: number; candidate: number } | undefined => {
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index]!;
    const position = metrics.getPositionByKey(anchor.key);

    if (position !== undefined) return { anchor, position, candidate: index };
  }

  return undefined;
};
