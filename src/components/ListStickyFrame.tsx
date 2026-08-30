import React, { memo, ReactNode, useMemo } from "react";
import { StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

import { getStickyOffset, isPinnedAtEdge } from "../core";
import {
  formatDebugValues,
  STICKY_FRAME_EVENT,
  STICKY_OFFSET_EVENT,
} from "../debug";
import { debugClock, debugFlag, logFromWorklet } from "../debug/debug-worklet";
import { useListSignal } from "../hooks";
import {
  useListScrollOffset,
  useListSticky,
  useListStickyPinned,
} from "../model";
import type { AnchorListStickyEdge } from "../types";
import {
  isContainerParked,
  resolveStickyPlacement,
  STICKY_Z_INDEX,
} from "./sticky-placement";

/** Геометрия якоря и его содержимое. */
export interface IAnchorListStickyFrameProps {
  edge: AnchorListStickyEdge;
  /** Позиция строки в координатах элементов. */
  position: number;
  size: number;
  scrollLength: number;
  /** Предел смещения: докуда якорь поднимается, не выходя за свою группу. */
  limit: number | undefined;
  itemIndex: number;
  /** Содержимое подрезано по слоту строки. */
  clipped: boolean;
  /**
   * Содержимое ячейки. Смещение и признак «нарисован слоем» приходят сюда
   * shared values: их применяет сама ячейка, без рендера на каждый кадр.
   */
  children: (
    offset: SharedValue<number>,
    pinned: SharedValue<boolean>,
  ) => ReactNode;
}

/**
 * Обёртка ячейки-якоря.
 *
 * Зачем нужна: прилипание — покадровый пересчёт смещения от скролла, и живёт он
 * на UI-потоке. Заводить такой пересчёт на каждую строку списка нельзя, поэтому
 * Reanimated-инфраструктура монтируется только вокруг якорей.
 *
 * Что делает: держит строку на её месте в контенте, а у кромки — сдвигает
 * трансформом. В режиме `container` сдвигается вся строка; в режиме `offset`
 * строка стоит на месте, а смещение уходит в содержимое. Пока якорь у кромки
 * рисует слой поверх списка, копия внутри контента прячется прозрачностью —
 * место для касаний за ней остаётся.
 */
export const ListStickyFrame = memo<IAnchorListStickyFrameProps>(
  ({
    edge,
    position,
    size,
    scrollLength,
    limit,
    itemIndex,
    clipped,
    children,
  }) => {
    const scrollOffset = useListScrollOffset();
    // Позиция строки приходит из раскладки, смещение скролла — нативное:
    // расходятся они на высоту шапки, и переводит одно в другое эта величина.
    const contentOrigin = useListSignal("contentOrigin") ?? 0;
    const debug = debugFlag("sticky");
    const clock = debugClock();
    /** Последнее напечатанное состояние: worklet печатает только переходы. */
    const debugState = useSharedValue("");
    const stickyConfigs = useListSticky();
    const pinnedIndices = useListStickyPinned();
    const { mode, edgeOffset, stickySize, hasOverlay } = resolveStickyPlacement(
      stickyConfigs,
      edge,
      size,
    );

    const offset = useDerivedValue(() => {
      if (isContainerParked(position)) {
        if (debug.value && debugState.value !== "уведён") {
          debugState.value = "уведён";
          logFromWorklet({
            clock,
            channel: "sticky",
            event: STICKY_OFFSET_EVENT,
            key: `#${itemIndex}`,
            values: formatDebugValues({
              state: "уведён",
              shift: 0,
              position,
              edgePos: undefined,
              limit,
            }),
          });
        }

        return 0;
      }

      const shift = getStickyOffset({
        edge,
        position,
        size,
        scrollLength,
        scroll: scrollOffset.value,
        contentOrigin,
        edgeOffset: edgeOffset?.value ?? 0,
        limit,
        stickySize,
      });

      if (debug.value) {
        // Состояний три, и на экране они выглядят по-разному: якорь ещё едет с
        // контентом, стоит у кромки, или его выталкивает следующий. Считаются
        // они от разных кромок, поэтому и формула у каждой своя.
        const shiftOfEdge = edgeOffset?.value ?? 0;
        const viewportTop = scrollOffset.value - contentOrigin;
        const edgePosition =
          edge === "start"
            ? viewportTop + shiftOfEdge
            : viewportTop + scrollLength - shiftOfEdge;

        const free =
          edge === "start"
            ? edgePosition <= position
            : edgePosition >= position + size;
        const pushed =
          limit !== undefined &&
          (edge === "start"
            ? edgePosition > limit
            : edgePosition <= limit + stickySize);

        const state = free ? "едет" : pushed ? "вытеснен" : "стоит";
        const values = formatDebugValues({
          state,
          shift,
          position,
          edgePos: edgePosition,
          limit,
        });

        if (values !== debugState.value) {
          debugState.value = values;
          logFromWorklet({
            clock,
            channel: "sticky",
            event: STICKY_OFFSET_EVENT,
            key: `#${itemIndex}`,
            values,
          });
        }
      }

      return shift;
    });

    /** Последняя напечатанная видимость копии внутри контента. */
    const debugHidden = useSharedValue("");

    const pinnedByOverlay = useDerivedValue(() => {
      const hidden =
        hasOverlay &&
        !isContainerParked(position) &&
        (edge === "start"
          ? pinnedIndices.start.value
          : pinnedIndices.end.value) === itemIndex &&
        isPinnedAtEdge({
          edge,
          position,
          size,
          scrollLength,
          scroll: scrollOffset.value,
          contentOrigin,
          edgeOffset: edgeOffset?.value ?? 0,
          limit,
          stickySize,
        });

      if (debug.value) {
        const rendered =
          edge === "start"
            ? pinnedIndices.start.value
            : pinnedIndices.end.value;
        // Экранная координата: по ней видно, есть ли между копиями разрыв.
        const values = formatDebugValues({
          hidden,
          layer: rendered,
          screen: contentOrigin + position + offset.value - scrollOffset.value,
          position,
          limit,
        });

        if (values !== debugHidden.value) {
          debugHidden.value = values;
          logFromWorklet({
            clock,
            channel: "sticky",
            event: STICKY_FRAME_EVENT,
            key: `#${itemIndex}`,
            values,
          });
        }
      }

      return hidden;
    });

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: mode === "container" && pinnedByOverlay.value ? 0 : 1,
      transform: [{ translateY: mode === "container" ? offset.value : 0 }],
    }));
    const style = useMemo(
      () => [
        styles.container,
        { top: position },
        clipped ? { height: size, overflow: "hidden" as const } : null,
        { zIndex: STICKY_Z_INDEX[edge] },
      ],
      [position, size, clipped, edge],
    );

    return (
      <Animated.View style={[style, animatedStyle]}>
        {children(offset, pinnedByOverlay)}
      </Animated.View>
    );
  },
);

ListStickyFrame.displayName = "ListStickyFrame";

const styles = StyleSheet.create({
  container: {
    left: 0,
    position: "absolute",
    right: 0,
  },
});
