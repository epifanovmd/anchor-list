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
import { LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
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
import { renderListSlot } from "./list-slots";
import { ListAnchoredEndSpace } from "./ListAnchoredEndSpace";
import { ListContainers } from "./ListContainers";
import { ListInsetEndSpace } from "./ListInsetEndSpace";
import { ListScrollAdjust } from "./ListScrollAdjust";
import { ListStickyOverlay } from "./ListStickyOverlay";
import { getScrollIndicatorInsets } from "./scroll-indicator";
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
 * Как свайп по списку закрывает клавиатуру.
 *
 * `interactive` iOS ведёт покадрово вместе с пальцем, и нижний отступ приходит
 * тем же кадром — контент едет за клавиатурой без рывка. На Android такого
 * режима нет, там ближайшее — закрыть по началу жеста.
 */
const KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? "interactive" : "on-drag";

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
    style,
    contentContainerStyle,
    maintainVisibleContentPosition,
    sticky,
    snapToIndices,
    scrollThrottleDistance,
    insetEnd,
    sharedValues,
    state,
    refScrollView,
    onLayout,
    onContentSizeChange,
    onScrollBeginDrag,
    onScrollEndDrag,
  } = props;

  const innerScrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollRef = refScrollView ?? innerScrollRef;
  const scrollOffset = useSharedValue(0);
  const edgeContentSize = useSharedValue(0);
  const edgeScrollLength = useSharedValue(0);
  const edgeEndSpace = useSharedValue(0);
  const edgeTotalSize = useSharedValue(0);
  const edgeHeaderSize = useSharedValue(0);
  const edgeFooterSize = useSharedValue(0);
  // Фаза жеста. Своя, а не та, что просят наружу: раскладка нижнего отступа
  // обязана уступать жесту и без чужой подписки.
  const isDragging = useSharedValue(false);
  const isMomentum = useSharedValue(false);
  // Якоря, которые слой прилипших копий уже нарисовал: -1 — копии нет.
  const pinnedStartIndex = useSharedValue(-1);
  const pinnedEndIndex = useSharedValue(-1);

  const insetEndLayout = useInsetEnd({
    insetEnd,
    alignItemsAtEnd: props.alignItemsAtEnd ?? false,
    totalSize: edgeTotalSize,
    headerSize: edgeHeaderSize,
    footerSize: edgeFooterSize,
    anchoredEndSpaceSize: edgeEndSpace,
    scrollLength: edgeScrollLength,
    contentSize: edgeContentSize,
    scrollRef,
    scrollOffset,
    isDragging,
    isMomentum,
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
        scrollRef.current?.scrollTo({ y: offset, animated }),
      getOffset: () => scrollOffset.value,
    });

    return () => {
      runtime.setAdapter(undefined);
      runtime.dispose();
    };
  }, [runtime, scrollRef, scrollOffset]);

  useImperativeHandle(
    ref,
    (): IAnchorListRef => ({
      scrollToIndex: params => runtime.scrollToIndex(params),
      scrollToKey: params => runtime.scrollToKey(params),
      scrollToOffset: ({ offset, animated }) =>
        runtime.scrollToOffset(offset, animated),
      scrollToEnd: params => runtime.scrollToEnd(params?.animated),
      getPositionAtIndex: index => runtime.getPositionAtIndex(index),
      getSizeAtIndex: index => runtime.getSizeAtIndex(index),
      getPositionByKey: key => runtime.getPositionByKey(key),
      getIndexByKey: key => runtime.getIndexByKey(key),
      getVisibleRange: () => runtime.getRange(),
      getScrollOffset: () => runtime.getScroll(),
      getContentSize: () => runtime.getContentSize(),
      getScrollLength: () => runtime.getScrollLength(),
      getVelocity: () => runtime.getVelocity(),
    }),
    [runtime],
  );

  const contextValue = useMemo(
    () => ({
      store,
      runtime,
      scrollOffset,
      sticky: stickyConfigs,
      stickyPinned: { start: pinnedStartIndex, end: pinnedEndIndex },
    }),
    [
      store,
      runtime,
      scrollOffset,
      stickyConfigs,
      pinnedStartIndex,
      pinnedEndIndex,
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
      headerSize: edgeHeaderSize,
      footerSize: edgeFooterSize,
    }),
    [
      edgeContentSize,
      edgeScrollLength,
      edgeEndSpace,
      edgeTotalSize,
      edgeHeaderSize,
      edgeFooterSize,
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

  // Позиции уточняются измерениями. Пересчитываем на каждом рендере списка:
  // мемоизация только по массиву индексов оставляла прежние оценочные offsets
  // даже после смены данных или любой другой перерисовки владельца.
  const snapToOffsets = snapToIndices?.map(
    index => runtime.getPositionAtIndex(index) ?? 0,
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      runtime.setContentSize(height);
      onContentSizeChange?.(width, height);
    },
    [runtime, onContentSizeChange],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;

      runtime.setScrollLength(height);
      runtime.setScrollSize(width, height);
      onLayout?.(event);
    },
    [runtime, onLayout],
  );

  const handleHeaderLayout = useCallback(
    (event: LayoutChangeEvent) =>
      runtime.setHeaderSize(event.nativeEvent.layout.height),
    [runtime],
  );

  const handleFooterLayout = useCallback(
    (event: LayoutChangeEvent) =>
      runtime.setFooterSize(event.nativeEvent.layout.height),
    [runtime],
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
    scrollIndicatorInsets: getScrollIndicatorInsets(insetEnd?.value ?? 0),
  }));

  const scrollHandler = useListScrollHandler({
    scrollOffset,
    publishedScrollOffset: sharedValues?.scrollOffset,
    isDragging,
    publishedIsDragging: sharedValues?.isDragging,
    isMomentum,
    publishedIsMomentum: sharedValues?.isMomentum,
    onScroll: updateScroll,
    scrollThrottleDistance,
    onBeginDrag: handleScrollBeginDrag,
    onEndDrag: handleScrollEndDrag,
    onMomentumEnd: handleMomentumScrollEnd,
  });

  const renderItemUntyped = renderItem as (
    props: IAnchorListRenderItemProps<unknown>,
  ) => React.ReactNode;

  return (
    <ListContextProvider value={contextValue}>
      {/* Обёртка нужна слою прилипших копий: он живёт снаружи ScrollView, в
          координатах вьюпорта, и потому не едет вместе с контентом. */}
      <View style={style}>
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={contentContainerStyle}
          onLayout={handleLayout}
          onScroll={scrollHandler}
          onContentSizeChange={handleContentSizeChange}
          maintainVisibleContentPosition={nativeMaintainVisibleContentPosition}
          snapToOffsets={snapToOffsets}
          animatedProps={insetEnd ? scrollIndicatorProps : undefined}
          keyboardDismissMode={KEYBOARD_DISMISS_MODE}
          // iOS сам добавляет safe area к инсетам индикатора, а она уже входит
          // в отступ — авто-подстройка давала бы двойной.
          automaticallyAdjustsScrollIndicatorInsets={!insetEnd}
          scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          bounces={false}
        >
          {/* Первым ребёнком: за ним следит нативное удержание позиции. */}
          <ListScrollAdjust />

          <View onLayout={handleHeaderLayout}>
            {renderListSlot(ListHeaderComponent)}
          </View>

          {data.length === 0 ? (
            renderListSlot(ListEmptyComponent)
          ) : (
            <ListContainers
              renderItem={renderItemUntyped}
              extraData={extraData}
              ItemSeparatorComponent={ItemSeparatorComponent}
              alignOffset={insetEndLayout.alignOffset}
            />
          )}

          <ListAnchoredEndSpace />

          <View onLayout={handleFooterLayout}>
            {renderListSlot(ListFooterComponent)}
          </View>

          {insetEnd ? (
            <ListInsetEndSpace height={insetEndLayout.spacer} />
          ) : null}
        </Animated.ScrollView>

        <ListStickyOverlay
          renderItem={renderItemUntyped}
          extraData={extraData}
        />
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
