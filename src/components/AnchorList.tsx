import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  I18nManager,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { createRuntimeProps, ListRuntime } from "../core";
import {
  useEdgeSharedValues,
  useInsetEnd,
  useListScrollHandler,
  useListSharedValues,
} from "../hooks";
import { ListContextProvider, ListStore } from "../model";
import type {
  IAnchorListProps,
  IAnchorListRef,
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "../types";
import {
  getAxisContentStyle,
  getAxisGapStyle,
  getAxisPosition,
  getAxisSize,
  getAxisTranslate,
} from "./axis";
import {
  getContentContainerStyle,
  getEmptySlotStyle,
  renderListSlot,
  resolveSlotGaps,
} from "./list-slots";
import { ListAnchoredEndSpace } from "./ListAnchoredEndSpace";
import { ListContainers } from "./ListContainers";
import { ListInsetEndSpace } from "./ListInsetEndSpace";
import { ListScrollAdjust } from "./ListScrollAdjust";
import { ListStickyOverlay } from "./ListStickyOverlay";
import { getScrollIndicatorInsets } from "./scroll-indicator";
import { omitManagedScrollViewProps } from "./scroll-view-props";
import { withEdgeInset } from "./sticky-placement";

/**
 * Как часто нативный слой шлёт события скролла, мс.
 *
 * Единица, а не шестнадцать: событиями `onScroll` смещение попадает на
 * UI-поток, и другого пути у него нет. От их частоты зависит всё, что обязано
 * совпадать со скроллом кадр в кадр — смещение наружу, расстояния до кромок,
 * прилипание. Прикрывать здесь — значит терять кадры на 120 Гц, где событий
 * приходит больше шестидесяти в секунду.
 *
 * Работы в JS это не добавляет: переход туда закрыт своим порогом по
 * расстоянию (`scrollThrottleDistance`), а проходы внутри кадра сливаются. Пока
 * шлюз был один на оба потока, шестнадцать были компромиссом; с раздельными
 * шлюзами компромисс не нужен.
 */
const SCROLL_EVENT_THROTTLE = 1;
/**
 * Как свайп по списку закрывает клавиатуру, если `keyboardDismissMode` не задан.
 *
 * `interactive` iOS ведёт покадрово вместе с пальцем, и нижний отступ приходит
 * тем же кадром — контент едет за клавиатурой без рывка. На Android такого
 * режима нет, там ближайшее — закрыть по началу жеста.
 */
const KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? "interactive" : "on-drag";

/**
 * Предупреждение о неподдержанном сочетании; печатается один раз на процесс.
 *
 * Зачем нужно: под RTL нативный слой отсчитывает смещение горизонтального
 * скролла от правой кромки, а нативное удержание позиции на Android этого не
 * учитывает — компенсация уезжает в противоположную сторону. Со стороны списка
 * это не чинится, и молчать об этом хуже, чем сказать: симптом выглядит как
 * случайные прыжки контента, и искать его будут где угодно, только не здесь.
 */
let rtlWarned = false;

/**
 * То же для `gap` в `contentContainerStyle`.
 *
 * Зачем нужно: flexbox кладёт его между узлами контента — шапкой, слоем строк,
 * распорками и подвалом, — и строки уезжают от шапки на величину, которой
 * список не видит: начало координат строк он берёт по концу шапки. Диапазон,
 * прилипание и переход к строке промахиваются ровно на неё. Зазор между
 * строками и вокруг шапки задаётся пропами `gap`, `headerGap`, `footerGap`.
 */
let contentGapWarned = false;

/**
 * Виртуализированный список.
 *
 * Диапазон отрисовки, позиции и привязка контейнеров считаются в `ListRuntime`
 * вне React: рендер вызывается только там, где контейнер сменил элемент или
 * позицию. Сам компонент — тонкая оболочка: он монтирует `ScrollView`, отдаёт
 * ядру размеры и события и раздаёт дереву контекст.
 */
const AnchorListInner = <TItem,>(
  props: IAnchorListProps<TItem>,
  ref: React.Ref<IAnchorListRef>,
) => {
  const {
    data,
    renderItem,
    extraData,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    ItemSeparatorComponent,
    gap,
    headerGap,
    footerGap,
    horizontal = false,
    style,
    contentContainerStyle,
    maintainVisibleContentPosition,
    sticky,
    snap,
    scrollThrottleDistance,
    insetEnd,
    sharedValues,
    state,
    refScrollView,
    onLayout,
    onContentSizeChange,
    onScrollBeginDrag,
    onScrollEndDrag,
    bounces = false,
    showsScrollIndicator = true,
    keyboardShouldPersistTaps,
    decelerationRate,
    scrollHandlers,
    renderScrollView,
    contentTranslate,
  } = props;

  const innerScrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollRef = refScrollView ?? innerScrollRef;
  const scrollOffset = useSharedValue(0);
  const edgeContentSize = useSharedValue(0);
  const edgeScrollLength = useSharedValue(0);
  const edgeEndSpace = useSharedValue(0);
  const edgeTotalSize = useSharedValue(0);
  const edgeContentOrigin = useSharedValue(0);
  const edgeFooterSize = useSharedValue(0);
  // Фаза жеста. Своя, а не та, что просят наружу: раскладка нижнего отступа
  // обязана уступать жесту и без чужой подписки.
  const isDragging = useSharedValue(false);
  const isMomentum = useSharedValue(false);
  // Список показан. Зеркало сигнала, а не подписка в React: по нему нижний
  // отступ решает, его ли сейчас дело двигать смещение, — а решает он это в
  // том же кадре, в котором идёт клавиатура.
  const isRevealed = useSharedValue(false);
  // Якоря, которые слой прилипших копий уже нарисовал: -1 — копии нет.
  const pinnedStartIndex = useSharedValue(-1);
  const pinnedEndIndex = useSharedValue(-1);

  useEffect(() => {
    if (!__DEV__ || rtlWarned || !horizontal || !I18nManager.isRTL) return;

    rtlWarned = true;
    console.warn(
      "AnchorList: horizontal + RTL не поддерживается. Под RTL нативный слой " +
        "отсчитывает смещение от правой кромки, а нативное удержание позиции " +
        "этого не учитывает и компенсирует в обратную сторону. " +
        "См. docs/limitations.md.",
    );
  }, [horizontal]);

  useEffect(() => {
    if (!__DEV__ || contentGapWarned) return;

    const flat = StyleSheet.flatten(contentContainerStyle);

    if (!flat?.gap && !flat?.rowGap && !flat?.columnGap) return;

    contentGapWarned = true;
    console.warn(
      "AnchorList: gap в contentContainerStyle не поддерживается — список не " +
        "видит его в раскладке, и строки смещаются относительно расчёта. " +
        "Используйте пропы gap, headerGap и footerGap. См. docs/props.md.",
    );
  }, [contentContainerStyle]);

  const insetEndLayout = useInsetEnd({
    insetEnd,
    alignItemsAtEnd: props.alignItemsAtEnd ?? false,
    totalSize: edgeTotalSize,
    contentOrigin: edgeContentOrigin,
    footerSize: edgeFooterSize,
    anchoredEndSpaceSize: edgeEndSpace,
    scrollLength: edgeScrollLength,
    contentSize: edgeContentSize,
    scrollRef,
    horizontal,
    scrollOffset,
    isDragging,
    isMomentum,
    revealed: isRevealed,
  });

  /**
   * Наборы прилипания с подставленным отступом конечной кромки.
   *
   * Дженерик элемента внутрь не идёт: контейнеры и слой одинаково работают с
   * любым элементом, а тип восстанавливается у вызывающего.
   */
  const stickyConfigs = useMemo(
    () =>
      withEdgeInset(sticky as IAnchorListStickyConfig[] | undefined, insetEnd),
    [sticky, insetEnd],
  );

  const [store] = useState(() => new ListStore());
  // Ядру уходят те же наборы, что и дереву: разойдясь, они посчитали бы
  // активный якорь и его смещение от разных кромок.
  const runtimeProps = createRuntimeProps({ ...props, sticky: stickyConfigs });
  const [runtime] = useState(() => new ListRuntime<TItem>(store, runtimeProps));

  // Пропы применяются после коммита, а не в теле рендера: пересчёт пишет
  // сигналы, а те обновляют состояние контейнеров — во время рендера React
  // такие обновления откладывает, и новые элементы остаются неотрисованными.
  useLayoutEffect(() => {
    runtime.setProps(runtimeProps);
  });

  useEffect(() => {
    runtime.setAdapter({
      scrollToEnd: animated => scrollRef.current?.scrollToEnd({ animated }),
      scrollToOffset: (offset, animated) =>
        scrollRef.current?.scrollTo(
          horizontal ? { x: offset, animated } : { y: offset, animated },
        ),
      // Резинка у начала — не позиция: расчёт видит кромку, а не перелёт.
      getOffset: () => Math.max(0, scrollOffset.value),
    });

    return () => {
      runtime.setAdapter(undefined);
      runtime.dispose();
    };
  }, [runtime, scrollRef, scrollOffset, horizontal]);

  useImperativeHandle(
    ref,
    (): IAnchorListRef => ({
      scrollToIndex: params => runtime.scrollToIndex(params),
      scrollToKey: params => runtime.scrollToKey(params),
      scrollToOffset: ({ offset, animated }) =>
        runtime.scrollToOffset(offset, animated),
      scrollToEnd: params => runtime.scrollToEnd(params?.animated),
      highlightKey: (key, options) => runtime.highlightKey(key, options),
      clearHighlight: () => runtime.clearHighlight(),
      getPositionAtIndex: index => runtime.getPositionAtIndex(index),
      getSizeAtIndex: index => runtime.getSizeAtIndex(index),
      getPositionByKey: key => runtime.getPositionByKey(key),
      getIndexByKey: key => runtime.getIndexByKey(key),
      getScrollAnchor: () => runtime.getScrollAnchor(),
      getVisibleRange: () => runtime.getRange(),
      getScrollOffset: () => runtime.getScroll(),
      getContentSize: () => runtime.getContentSize(),
      getScrollLength: () => runtime.getScrollLength(),
      getVelocity: () => runtime.getVelocity(),
    }),
    [runtime],
  );

  /**
   * Геометрия для worklet-расчётов в ячейках — те же shared values, что
   * держат расчёт кромок: источник на всех один.
   */
  const layoutValues = useMemo(
    () => ({
      scrollLength: edgeScrollLength,
      contentOrigin: edgeContentOrigin,
      insetEnd,
      alignOffset: insetEndLayout.alignOffset,
    }),
    [edgeScrollLength, edgeContentOrigin, insetEnd, insetEndLayout.alignOffset],
  );

  const contextValue = useMemo(
    () => ({
      store,
      runtime,
      scrollOffset,
      layout: layoutValues,
      sticky: stickyConfigs,
      stickyPinned: { start: pinnedStartIndex, end: pinnedEndIndex },
      horizontal,
    }),
    [
      store,
      runtime,
      scrollOffset,
      layoutValues,
      stickyConfigs,
      pinnedStartIndex,
      pinnedEndIndex,
      horizontal,
    ],
  );

  useListSharedValues(store, scrollOffset, sharedValues);

  /**
   * Геометрия контента на UI-потоке.
   *
   * Отдельные значения, а не подписка в React: от них зависит покадровый расчёт
   * кромок, и приходить они обязаны туда же, где он идёт. Меняются на
   * раскладке, так что зеркала из стора здесь достаточно.
   */
  const edgeGeometry = useMemo(
    () => ({
      contentSize: edgeContentSize,
      scrollLength: edgeScrollLength,
      anchoredEndSpaceSize: edgeEndSpace,
      totalSize: edgeTotalSize,
      contentOrigin: edgeContentOrigin,
      footerSize: edgeFooterSize,
      readyToRender: isRevealed,
    }),
    [
      edgeContentSize,
      edgeScrollLength,
      edgeEndSpace,
      edgeTotalSize,
      edgeContentOrigin,
      edgeFooterSize,
      isRevealed,
    ],
  );

  useListSharedValues(store, scrollOffset, edgeGeometry);
  useEdgeSharedValues(scrollOffset, sharedValues, edgeGeometry, {
    startThreshold: runtimeProps.startReachedThreshold,
    endThreshold: runtimeProps.endReachedThreshold,
    maintainScrollAtEndThreshold: runtimeProps.maintainScrollAtEndThreshold,
  });

  // Подписки снаружи могли завестись раньше списка — стор им отдаётся здесь.
  useEffect(() => state?.attach(store), [state, store]);

  /**
   * Список показан: доводка стартовой позиции кончилась.
   *
   * Сигнал из стора, а не состояние React: его ставит ядро в момент показа, и
   * ждать лишнего рендера здесь нельзя.
   */
  const revealed = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => store.listen("readyToRender", onChange),
      [store],
    ),
    () => store.peek("readyToRender") ?? false,
  );

  // Компенсацию делает сам ScrollView: программный скролл посреди жеста гасит
  // и жест, и инерцию.
  //
  // Пока идёт доводка стартовой позиции, компенсация выключена. Она держит
  // видимое на месте, когда контент над ним растёт, — а доводка в это же время
  // считает абсолютную цель по тем же самым замерам. Оба сдвига складываются:
  // список встаёт на доли точки ниже просимого, снимок позиции запоминает
  // промах, и следующее открытие берёт его за цель. Абсолютным смещением до
  // показа распоряжается кто-то один.
  const nativeMaintainVisibleContentPosition = useMemo(
    () =>
      revealed &&
      (maintainVisibleContentPosition?.data ||
        maintainVisibleContentPosition?.size)
        ? { minIndexForVisible: 0 }
        : undefined,
    [maintainVisibleContentPosition, revealed],
  );

  // Всё, чем список не распоряжается сам, — как есть во внутренний ScrollView.
  const scrollViewProps = omitManagedScrollViewProps(props);

  // Точки снапа считает ядро и уточняет по замерам: компонент от замеров не
  // перерисовывается, поэтому подписка — на сам сигнал.
  const snapOffsets = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => store.listen("snapOffsets", onChange),
      [store],
    ),
    () => store.peek("snapOffsets"),
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      runtime.setContentSize(getAxisSize(width, height, horizontal));
      onContentSizeChange?.(width, height);
    },
    [runtime, onContentSizeChange, horizontal],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;

      runtime.setScrollLength(getAxisSize(width, height, horizontal));
      runtime.setScrollSize(width, height);
      onLayout?.(event);
    },
    [runtime, onLayout, horizontal],
  );

  // Позиция шапки нужна не меньше её размера: над ней лежит отступ
  // контейнера контента, и строки начинаются с её конца, а не с её высоты.
  const handleHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;

      runtime.setHeaderSize(
        getAxisSize(width, height, horizontal),
        getAxisPosition(x, y, horizontal),
      );
    },
    [runtime, horizontal],
  );

  const handleFooterLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;

      runtime.setFooterSize(getAxisSize(width, height, horizontal));
    },
    [runtime, horizontal],
  );

  const updateScroll = useCallback(
    (offset: number, time: number) => runtime.setScroll(offset, time),
    [runtime],
  );

  const handleScrollBeginDrag = useCallback(() => {
    runtime.onGestureBegin();
    onScrollBeginDrag?.();
  }, [runtime, onScrollBeginDrag]);

  const handleScrollEndDrag = useCallback(() => {
    runtime.onGestureEnd();
    onScrollEndDrag?.();
  }, [runtime, onScrollEndDrag]);

  const handleMomentumScrollEnd = useCallback(
    () => runtime.onGestureEnd(),
    [runtime],
  );

  // Индикатор скролла живёт в координатах ScrollView и о распорке отступа не
  // знает: без инсета он доходит до кромки экрана, а контент — только до панели
  // ввода.
  const scrollIndicatorProps = useAnimatedProps(() => ({
    scrollIndicatorInsets: getScrollIndicatorInsets(
      insetEnd?.value ?? 0,
      horizontal,
    ),
  }));

  const scrollHandler = useListScrollHandler({
    scrollOffset,
    publishedScrollOffset: sharedValues?.scrollOffset,
    isDragging,
    publishedIsDragging: sharedValues?.isDragging,
    isMomentum,
    publishedIsMomentum: sharedValues?.isMomentum,
    onScroll: updateScroll,
    horizontal,
    scrollThrottleDistance,
    onBeginDrag: handleScrollBeginDrag,
    onEndDrag: handleScrollEndDrag,
    onMomentumEnd: handleMomentumScrollEnd,
    externalHandlers: scrollHandlers,
  });

  const renderItemUntyped = renderItem as (
    props: IAnchorListRenderItemProps<unknown>,
  ) => React.ReactNode;

  const header = renderListSlot(ListHeaderComponent);
  const footer = renderListSlot(ListFooterComponent);
  const empty = data.length === 0 ? renderListSlot(ListEmptyComponent) : null;
  const showsEmpty = empty !== null;
  const slotGaps = resolveSlotGaps({
    gap,
    headerGap,
    footerGap,
    hasHeader: header !== null,
    hasFooter: footer !== null,
    hasItems: data.length > 0,
  });
  const headerStyle = useMemo(
    () => [
      getAxisContentStyle(horizontal),
      getAxisGapStyle(slotGaps.header, "end", horizontal),
    ],
    [horizontal, slotGaps.header],
  );
  const footerStyle = useMemo(
    () => [
      getAxisContentStyle(horizontal),
      getAxisGapStyle(slotGaps.footer, "start", horizontal),
    ],
    [horizontal, slotGaps.footer],
  );
  const contentStyle = useMemo(
    () => getContentContainerStyle(contentContainerStyle, showsEmpty),
    [contentContainerStyle, showsEmpty],
  );

  // Вызывается всегда — хуки не ветвятся; без пропа слой не создаётся.
  const translateStyle = useAnimatedStyle(() => ({
    transform: getAxisTranslate(contentTranslate?.value ?? 0, horizontal),
  }));

  const scrollView = (
    <Animated.ScrollView
      {...scrollViewProps}
      ref={scrollRef}
      horizontal={horizontal}
      style={styles.scroll}
      contentContainerStyle={contentStyle}
      onLayout={handleLayout}
      onScroll={scrollHandler}
      onContentSizeChange={handleContentSizeChange}
      maintainVisibleContentPosition={nativeMaintainVisibleContentPosition}
      snapToOffsets={snapOffsets}
      snapToStart={snap?.snapToStart}
      snapToEnd={snap?.snapToEnd}
      disableIntervalMomentum={snap?.oneAtATime}
      decelerationRate={decelerationRate}
      animatedProps={insetEnd ? scrollIndicatorProps : undefined}
      keyboardDismissMode={
        scrollViewProps.keyboardDismissMode ?? KEYBOARD_DISMISS_MODE
      }
      // iOS сам добавляет safe area к инсетам индикатора, а она уже входит
      // в отступ — авто-подстройка давала бы двойной.
      automaticallyAdjustsScrollIndicatorInsets={!insetEnd}
      scrollEventThrottle={SCROLL_EVENT_THROTTLE}
      bounces={bounces}
      showsVerticalScrollIndicator={!horizontal && showsScrollIndicator}
      showsHorizontalScrollIndicator={horizontal && showsScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {/* Первым ребёнком: за ним следит нативное удержание позиции. */}
      <ListScrollAdjust />

      {/* Обёртка раскладывается вдоль оси по той же причине, что и слот
          строки: иначе поперечный размер до содержимого не доходит, и
          шапка горизонтального списка не занимает высоту ленты. */}
      <View style={headerStyle} onLayout={handleHeaderLayout}>
        {header}
      </View>

      {showsEmpty ? (
        <View style={getEmptySlotStyle(horizontal)}>{empty}</View>
      ) : null}

      {data.length > 0 ? (
        <ListContainers
          renderItem={renderItemUntyped}
          extraData={extraData}
          ItemSeparatorComponent={ItemSeparatorComponent}
          alignOffset={insetEndLayout.alignOffset}
        />
      ) : null}

      <ListAnchoredEndSpace />

      <View style={footerStyle} onLayout={handleFooterLayout}>
        {footer}
      </View>

      {insetEnd ? <ListInsetEndSpace size={insetEndLayout.spacer} /> : null}
    </Animated.ScrollView>
  );

  const layers = (
    <>
      {renderScrollView ? renderScrollView(scrollView) : scrollView}

      <ListStickyOverlay renderItem={renderItemUntyped} extraData={extraData} />
    </>
  );

  return (
    <ListContextProvider value={contextValue}>
      {/* Обёртка нужна слою прилипших копий: он живёт снаружи ScrollView, в
          координатах вьюпорта, и потому не едет вместе с контентом. Внешний
          сдвиг поэтому ставится на общий слой, а не на сам скролл. */}
      <View style={style}>
        {contentTranslate ? (
          <Animated.View style={[styles.scroll, translateStyle]}>
            {layers}
          </Animated.View>
        ) : (
          layers
        )}
      </View>
    </ListContextProvider>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
});

/**
 * Виртуализированный список.
 *
 * `forwardRef` теряет дженерик, поэтому тип восстанавливается приведением —
 * иначе элемент списка выводился бы как `unknown` на каждом использовании.
 */
export const AnchorList = forwardRef(AnchorListInner) as <TItem>(
  props: IAnchorListProps<TItem> & { ref?: React.Ref<IAnchorListRef> },
) => React.ReactElement;
