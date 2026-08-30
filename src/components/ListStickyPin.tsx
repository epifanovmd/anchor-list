import React, { memo, useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { isPinnedAtEdge } from "../core";
import {
  formatDebugValues,
  logStickyPin,
  STICKY_OVERLAY_EVENT,
} from "../debug";
import { debugClock, debugFlag, logFromWorklet } from "../debug/debug-worklet";
import { useListSignal } from "../hooks";
import {
  ListItemKeyProvider,
  useListRuntime,
  useListScrollOffset,
  useListStickyPinned,
} from "../model";
import type { IAnchorListStickyConfig } from "../types";
import type { IAnchorListStickyOverlayProps } from "./ListStickyOverlay";
import { resolveOverlayRenderer } from "./sticky-placement";

interface IAnchorListStickyPinProps extends IAnchorListStickyOverlayProps {
  config: IAnchorListStickyConfig;
}

/**
 * Прилипшая копия одной кромки.
 *
 * Видимость решается на UI-потоке тем же предикатом, что прячет копию внутри
 * контента: обе записи считаются в один проход мапперов и не могут разойтись
 * даже на кадр.
 */
export const ListStickyPin = memo<IAnchorListStickyPinProps>(
  ({ config, renderItem, extraData }) => {
    const runtime = useListRuntime();
    const scrollOffset = useListScrollOffset();
    const pinnedIndices = useListStickyPinned();

    const index =
      useListSignal(
        config.edge === "start"
          ? "activeStickyStartIndex"
          : "activeStickyEndIndex",
      ) ?? -1;
    const scrollLength = useListSignal("scrollLength") ?? 0;
    // Геометрия якоря — в координатах элементов, смещение скролла — нативное.
    const contentOrigin = useListSignal("contentOrigin") ?? 0;
    // Раскладка могла поехать под тем же якорем — геометрию нужно перечитать.
    const totalSize = useListSignal("totalSize") ?? 0;

    const geometry = useMemo(
      () => runtime.getStickyGeometry(index),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runtime, index, totalSize],
    );
    const item = useMemo(
      () => runtime.getItemAt(index),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runtime, index, totalSize],
    );
    const itemKey = useMemo(
      () => runtime.getItemKeyAt(index),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runtime, index, totalSize],
    );

    const { edge } = config;
    const edgeOffset = config.offset;
    const stickySize = config.size ?? geometry?.size ?? 0;

    const debug = debugFlag("sticky");
    const clock = debugClock();
    /** Последняя напечатанная видимость копии в слое. */
    const debugVisible = useSharedValue("");

    const style = useAnimatedStyle(() => {
      const shift = edgeOffset?.value ?? 0;
      const visible =
        geometry !== undefined &&
        isPinnedAtEdge({
          edge,
          position: geometry.position,
          size: geometry.size,
          scrollLength,
          scroll: scrollOffset.value,
          contentOrigin,
          edgeOffset: shift,
          limit: geometry.limit,
          stickySize,
        });

      if (debug.value) {
        const values = formatDebugValues({
          visible,
          shift: edge === "start" ? shift : -shift,
          scroll: scrollOffset.value,
          position: geometry?.position,
          limit: geometry?.limit,
        });

        if (values !== debugVisible.value) {
          debugVisible.value = values;
          logFromWorklet({
            clock,
            channel: "sticky",
            event: STICKY_OVERLAY_EVENT,
            key: `#${index}`,
            values,
          });
        }
      }

      return {
        opacity: visible ? 1 : 0,
        transform: [{ translateY: edge === "start" ? shift : -shift }],
      };
    });

    const content = resolveOverlayRenderer(config, renderItem);
    const rendered =
      content !== undefined && geometry !== undefined ? index : -1;

    logStickyPin({
      edge: config.edge,
      active: index,
      rendered,
      hasRenderer: content !== undefined,
      position: geometry?.position,
      size: geometry?.size,
      limit: geometry?.limit,
    });

    // После коммита, а не во время: копия внутри контента прячется по этому
    // значению, и до отрисовки слоя прятаться ей нельзя.
    useEffect(() => {
      const target =
        config.edge === "start" ? pinnedIndices.start : pinnedIndices.end;

      target.value = rendered;

      return () => {
        target.value = -1;
      };
    }, [config.edge, pinnedIndices, rendered]);

    if (content === undefined) return null;

    // Узел смонтирован всегда, даже когда прилипшего якоря нет: новый
    // анимированный узел коммитится с базовым стилем, снятым при первом
    // рендере, и на кадр показал бы копию не там, где она нужна.
    return (
      <Animated.View
        style={[edge === "start" ? styles.start : styles.end, style]}
        pointerEvents={"none"}
      >
        {index >= 0 && geometry !== undefined && itemKey !== undefined ? (
          // Копия в слое — отдельное поддерево, и ключ ей нужен по той же
          // причине, что и строке внутри контента: якорь меняется на ходу, а
          // узел остаётся тем же.
          <ListItemKeyProvider value={itemKey}>
            {content({ item, index, itemKey, type: "", extraData })}
          </ListItemKeyProvider>
        ) : null}
      </Animated.View>
    );
  },
);

ListStickyPin.displayName = "ListStickyPin";

const styles = StyleSheet.create({
  end: { bottom: 0, left: 0, position: "absolute", right: 0 },
  start: { left: 0, position: "absolute", right: 0, top: 0 },
});
