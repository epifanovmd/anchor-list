import React, { ComponentType, memo, useMemo } from "react";
import { View } from "react-native";

import { useListSignals } from "../hooks";
import type { IAnchorListRenderItemProps } from "../types";
import { ListItemContainer } from "./ListItemContainer";

interface IAnchorListContainersProps {
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => React.ReactNode;
  extraData: unknown;
  ItemSeparatorComponent?: ComponentType<unknown> | null;
}

const SIGNALS = [
  "numContainers",
  "totalSize",
  "readyToRender",
  "alignItemsAtEndPadding",
] as const;

/**
 * Слой контейнеров.
 *
 * Задаёт высоту контента по суммарному размеру элементов — контейнеры внутри
 * позиционированы абсолютно и на высоту не влияют. Короткий контент прижимает
 * к концу отступ сверху: его размер считает `AlignItemsAtEnd`. До первого
 * готового кадра слой прозрачен: иначе виден скачок с оценочных размеров на
 * измеренные.
 */
export const ListContainers = memo<IAnchorListContainersProps>(
  ({ renderItem, extraData, ItemSeparatorComponent }) => {
    const [
      numContainers = 0,
      totalSize = 0,
      readyToRender = false,
      alignPadding = 0,
    ] = useListSignals(SIGNALS);

    const containers = useMemo(() => {
      const ids: number[] = [];

      for (let id = 0; id < numContainers; id++) ids.push(id);

      return ids;
    }, [numContainers]);

    const style = useMemo(
      () => ({
        height: totalSize,
        // Распорка отдаётся отступом снаружи, а не внутренним `padding`: Yoga
        // отсчитывает абсолютного ребёнка с заданным `top` от границы
        // родителя, и внутренний отступ контейнеры не сдвинул бы — короткий
        // контент так и остался бы под навбаром.
        marginTop: alignPadding,
        opacity: readyToRender ? 1 : 0,
      }),
      [totalSize, readyToRender, alignPadding],
    );

    return (
      <View style={style}>
        {containers.map(id => (
          <ListItemContainer
            key={id}
            id={id}
            renderItem={renderItem}
            extraData={extraData}
            ItemSeparatorComponent={ItemSeparatorComponent}
          />
        ))}
      </View>
    );
  },
);

ListContainers.displayName = "ListContainers";
