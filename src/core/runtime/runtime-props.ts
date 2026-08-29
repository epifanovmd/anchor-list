import type {
  AnchorListInitialScroll,
  IAnchorListAnchoredEndSpace,
  IAnchorListProps,
  IAnchorListStickyConfig,
  IAnchorListViewabilityPair,
} from "../../types";

/** Запас отрисовки за пределами вьюпорта по умолчанию, px. */
const DEFAULT_DRAW_DISTANCE = 400;
/** Пороги подгрузки задаются в долях длины вьюпорта. */
const DEFAULT_EDGE_THRESHOLD = 0.5;
/** Порог, в пределах которого список считается прижатым к концу. */
const DEFAULT_MAINTAIN_AT_END_THRESHOLD = 0.1;

/**
 * Пропы, влияющие на расчёт раскладки и поведение скролла.
 *
 * Отличаются от публичных {@link IAnchorListProps} тем, что здесь нет ничего
 * необязательного и ничего про отрисовку: значения по умолчанию уже применены,
 * а вложенные объекты развёрнуты в плоские поля. Ядру не нужно знать, что
 * `maintainVisibleContentPosition` бывает `undefined`, — ему нужны два флага.
 */
export interface IAnchorListRuntimeProps<TItem> {
  data: readonly TItem[];
  keyExtractor: (item: TItem, index: number) => string;
  getItemType?: (item: TItem, index: number) => string;
  getFixedItemSize?: (
    item: TItem,
    index: number,
    type: string,
  ) => number | undefined;
  estimatedItemSize: number;
  drawDistance: number;
  recycleItems?: boolean;
  itemsAreEqual?: (prev: TItem, next: TItem, index: number) => boolean;

  /** Доли длины вьюпорта. */
  startReachedThreshold: number;
  endReachedThreshold: number;
  maintainScrollAtEndThreshold: number;
  maintainScrollAtEnd: boolean;
  maintainScrollAtEndAnimated: boolean;

  /** Компенсировать вставку и удаление элементов выше вьюпорта. */
  maintainVisibleContentPositionData: boolean;
  /** Компенсировать изменение размеров уже отрисованных элементов. */
  maintainVisibleContentPositionSize: boolean;
  /** Разрешён ли элемент как якорь восстановления. */
  shouldRestorePosition?: (index: number) => boolean;
  /** Стартовая позиция скролла. */
  initialScroll?: AnchorListInitialScroll;
  /** Распорка у конца, поднимающая якорный элемент к верхней кромке. */
  anchoredEndSpace?: IAnchorListAnchoredEndSpace;
  /** Наборы прилипающих элементов по кромкам. */
  sticky?: IAnchorListStickyConfig[];
  /** Пары «условие видимости — колбэк». */
  viewabilityPairs?: IAnchorListViewabilityPair<TItem>[];
  /** Первая раскладка завершена и начальный скролл применён. */
  onLoad?: () => void;

  onStartReached?: (info: { distanceFromStart: number }) => void;
  onEndReached?: (info: { distanceFromEnd: number }) => void;
}

/**
 * Приведение публичных пропов к виду, понятному расчётному ядру.
 *
 * Зачем нужно: единственное место, где живут значения по умолчанию и разбор
 * необязательных объектов. Ядро потом работает с плоскими полями и не проверяет
 * ничего на `undefined`.
 *
 * Отдельная забота — `shouldRestorePosition`: наружу он объявлен по элементу,
 * а якорю компенсации нужен ответ по индексу. Переходник заодно закрывает
 * случай, когда индекс уже не существует: данные могли смениться между снятием
 * якоря и проверкой.
 */
export const createRuntimeProps = <TItem>(
  props: IAnchorListProps<TItem>,
): IAnchorListRuntimeProps<TItem> => {
  const {
    data,
    keyExtractor,
    getItemType,
    getFixedItemSize,
    estimatedItemSize,
    drawDistance = DEFAULT_DRAW_DISTANCE,
    recycleItems = false,
    itemsAreEqual,
    onStartReachedThreshold = DEFAULT_EDGE_THRESHOLD,
    onEndReachedThreshold = DEFAULT_EDGE_THRESHOLD,
    maintainScrollAtEndThreshold = DEFAULT_MAINTAIN_AT_END_THRESHOLD,
    maintainScrollAtEnd,
    maintainVisibleContentPosition,
    initialScroll,
    anchoredEndSpace,
    sticky,
    viewabilityPairs,
    onLoad,
    onStartReached,
    onEndReached,
  } = props;

  const shouldRestorePosition =
    maintainVisibleContentPosition?.shouldRestorePosition;

  return {
    data,
    keyExtractor,
    getItemType,
    getFixedItemSize,
    estimatedItemSize,
    drawDistance,
    recycleItems,
    itemsAreEqual,
    startReachedThreshold: onStartReachedThreshold,
    endReachedThreshold: onEndReachedThreshold,
    maintainScrollAtEndThreshold,
    maintainScrollAtEnd: !!maintainScrollAtEnd,
    maintainScrollAtEndAnimated: maintainScrollAtEnd?.animated ?? false,
    maintainVisibleContentPositionData:
      maintainVisibleContentPosition?.data ?? false,
    maintainVisibleContentPositionSize:
      maintainVisibleContentPosition?.size ?? false,
    shouldRestorePosition: shouldRestorePosition
      ? (index: number) => {
          const item = data[index];

          return item === undefined
            ? false
            : (shouldRestorePosition(item, index) ?? true);
        }
      : undefined,
    initialScroll,
    anchoredEndSpace,
    // Дженерик элемента ядру не нужен: наборы прилипания разбираются по
    // индексам, а рендер копии уходит наружу как есть.
    sticky: sticky as IAnchorListStickyConfig[] | undefined,
    viewabilityPairs,
    onLoad,
    onStartReached,
    onEndReached,
  };
};
