import type {
  AnchorListManagedScrollViewProp,
  AnchorListScrollViewProps,
  IAnchorListOwnProps,
} from "../types";

/**
 * Собственные пропы списка.
 *
 * Запись, а не массив: тип требует перечислить все ключи, и новый проп списка
 * без строки здесь не соберётся — иначе он утёк бы во внутренний `ScrollView`.
 */
const OWN_PROPS: Record<keyof IAnchorListOwnProps<unknown>, true> = {
  data: true,
  renderItem: true,
  keyExtractor: true,
  getItemType: true,
  getFixedItemSize: true,
  estimatedItemSize: true,
  sizeCache: true,
  gap: true,
  getItemGap: true,
  headerGap: true,
  footerGap: true,
  recycleItems: true,
  itemsAreEqual: true,
  extraData: true,
  horizontal: true,
  drawDistance: true,
  scrollThrottleDistance: true,
  ListHeaderComponent: true,
  ListFooterComponent: true,
  ListEmptyComponent: true,
  ItemSeparatorComponent: true,
  alignItemsAtEnd: true,
  anchoredEndSpace: true,
  maintainVisibleContentPosition: true,
  maintainScrollAtEnd: true,
  maintainScrollAtEndThreshold: true,
  initialScroll: true,
  sticky: true,
  snap: true,
  snapToIndices: true,
  insetEnd: true,
  viewabilityPairs: true,
  sharedValues: true,
  state: true,
  onStartReached: true,
  onStartReachedThreshold: true,
  onEndReached: true,
  onEndReachedThreshold: true,
  onLoad: true,
  onLayout: true,
  onContentSizeChange: true,
  onScrollBeginDrag: true,
  onScrollEndDrag: true,
  bounces: true,
  showsScrollIndicator: true,
  keyboardShouldPersistTaps: true,
  decelerationRate: true,
  scrollHandlers: true,
  renderScrollView: true,
  contentTranslate: true,
  style: true,
  contentContainerStyle: true,
  refScrollView: true,
};

/** Пропы `ScrollView`, которыми распоряжается сам список. */
const MANAGED_PROPS: Record<AnchorListManagedScrollViewProp, true> = {
  children: true,
  horizontal: true,
  style: true,
  contentContainerStyle: true,
  onLayout: true,
  onContentSizeChange: true,
  onScroll: true,
  onScrollBeginDrag: true,
  onScrollEndDrag: true,
  onMomentumScrollBegin: true,
  onMomentumScrollEnd: true,
  scrollEventThrottle: true,
  maintainVisibleContentPosition: true,
  snapToOffsets: true,
  snapToInterval: true,
  snapToAlignment: true,
  snapToStart: true,
  snapToEnd: true,
  disableIntervalMomentum: true,
  pagingEnabled: true,
  decelerationRate: true,
  bounces: true,
  keyboardShouldPersistTaps: true,
  showsVerticalScrollIndicator: true,
  showsHorizontalScrollIndicator: true,
  automaticallyAdjustsScrollIndicatorInsets: true,
  scrollIndicatorInsets: true,
  contentOffset: true,
  contentInset: true,
  contentInsetAdjustmentBehavior: true,
  automaticallyAdjustContentInsets: true,
  automaticallyAdjustKeyboardInsets: true,
  stickyHeaderIndices: true,
  stickyHeaderHiddenOnScroll: true,
  StickyHeaderComponent: true,
  invertStickyHeaders: true,
  refreshControl: true,
  removeClippedSubviews: true,
  zoomScale: true,
  minimumZoomScale: true,
  maximumZoomScale: true,
  bouncesZoom: true,
  centerContent: true,
};

/**
 * Пропы `ScrollView`, которые список пропускает насквозь.
 *
 * Зачем нужно: всё, что список не решает сам, — `scrollEnabled`,
 * `nestedScrollEnabled`, `scrollsToTop`, доступность — должно доходить до
 * `ScrollView` без правки библиотеки под каждый проп.
 *
 * Отсекает и собственные пропы списка, и те пропы `ScrollView`, которыми он
 * распоряжается сам: без TypeScript запрещённое типом всё равно доходит до
 * компонента и сдвинуло бы координаты или включило вторую механику поверх
 * своей.
 */
export const omitManagedScrollViewProps = (
  props: object,
): AnchorListScrollViewProps => {
  const passthrough: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key in OWN_PROPS || key in MANAGED_PROPS) continue;

    passthrough[key] = value;
  }

  return passthrough as AnchorListScrollViewProps;
};
