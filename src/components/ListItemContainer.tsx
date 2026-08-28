import React, { ComponentType, memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useListSignals } from "../hooks";
import { POSITION_OUT_OF_VIEW, useListRuntime } from "../model";
import type { IAnchorListRenderItemProps } from "../types";
import { getContainerSignalNames } from "./container-signals";
import type { IAnchorListItemContentProps } from "./ListItemContent";
import { ListItemContent } from "./ListItemContent";
import { ListStickyFrame } from "./ListStickyFrame";

interface IAnchorListItemContainerProps {
  /** Номер контейнера: им адресуются все его сигналы. */
  id: number;
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => React.ReactNode;
  extraData: unknown;
  ItemSeparatorComponent?: ComponentType<unknown> | null;
}

/**
 * Контейнер — единица монтирования списка.
 *
 * Зачем нужен: строк в данных тысячи, а смонтированных контейнеров — по числу
 * тех, что помещаются в диапазон отрисовки. Контейнер переживает смену элемента:
 * ядро меняет его сигналы, и перерисовывается только он один.
 *
 * Всё, что он знает о своём содержимом, приходит адресными сигналами
 * ({@link getContainerSignalNames}), поэтому скролл, двигающий одну строку, не
 * задевает остальные.
 *
 * Прилипающий элемент оборачивается в {@link ListStickyFrame}, обычный — в
 * простую `View`: Reanimated-инфраструктура стоит мапперов на каждый кадр, и
 * заводить её для всех строк нельзя.
 */
export const ListItemContainer = memo<IAnchorListItemContainerProps>(
  ({ id, renderItem, extraData, ItemSeparatorComponent }) => {
    const runtime = useListRuntime();
    const signalNames = useMemo(() => getContainerSignalNames(id), [id]);
    const [
      position,
      itemKey,
      itemIndex,
      itemData,
      itemType,
      itemSize,
      stickyEdge,
      stickyLimit,
      clipped,
      scrollLength,
    ] = useListSignals(signalNames);

    const resolvedPosition = position ?? POSITION_OUT_OF_VIEW;
    const resolvedSize = itemSize ?? 0;
    const resolvedScrollLength = scrollLength ?? 0;

    if (itemKey === undefined || itemIndex === undefined) return null;

    const resolvedItemType = itemType ?? "";
    const contentProps: IAnchorListItemContentProps = {
      id,
      itemKey,
      itemIndex,
      itemData,
      itemType: resolvedItemType,
      renderItem,
      extraData,
      ItemSeparatorComponent,
    };
    const contentKey = runtime.shouldRecycleItems()
      ? resolvedItemType
      : itemKey;

    if (stickyEdge) {
      return (
        <ListStickyFrame
          edge={stickyEdge}
          position={resolvedPosition}
          size={resolvedSize}
          scrollLength={resolvedScrollLength}
          limit={stickyLimit}
          itemIndex={itemIndex}
          clipped={clipped ?? false}
        >
          {(offset, pinned) => (
            <ListItemContent
              key={contentKey}
              {...contentProps}
              stickyOffset={offset}
              stickyPinned={pinned}
            />
          )}
        </ListStickyFrame>
      );
    }

    const style = [
      styles.container,
      { top: resolvedPosition },
      clipped ? { height: resolvedSize, overflow: "hidden" as const } : null,
    ];

    return (
      <View style={style}>
        <ListItemContent key={contentKey} {...contentProps} />
      </View>
    );
  },
);

ListItemContainer.displayName = "ListItemContainer";

const styles = StyleSheet.create({
  container: {
    left: 0,
    position: "absolute",
    right: 0,
  },
});
