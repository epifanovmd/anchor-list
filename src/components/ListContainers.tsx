import React, { ComponentType, memo, useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useListSignals } from "../hooks";
import type { IAnchorListRenderItemProps } from "../types";
import { ListItemContainer } from "./ListItemContainer";

interface IAnchorListContainersProps {
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => React.ReactNode;
  extraData: unknown;
  ItemSeparatorComponent?: ComponentType<unknown> | null;
  /** Сдвиг вниз, прижимающий короткий контент к концу списка. */
  alignOffset: SharedValue<number>;
}

const SIGNALS = ["numContainers", "totalSize", "readyToRender"] as const;

/**
 * Слой контейнеров.
 *
 * Задаёт высоту контента по суммарному размеру элементов — контейнеры внутри
 * позиционированы абсолютно и на высоту не влияют. До первого готового кадра
 * слой прозрачен: иначе виден скачок с оценочных размеров на измеренные.
 *
 * Короткий контент прижимает к концу трансформ, а не отступ в раскладке: высота
 * контента от него не меняется, поэтому список остаётся непрокручиваемым, пока
 * контент помещается на экран. Считается сдвиг на UI-потоке — он едет вместе с
 * клавиатурой.
 */
export const ListContainers = memo<IAnchorListContainersProps>(
  ({ renderItem, extraData, ItemSeparatorComponent, alignOffset }) => {
    const [numContainers = 0, totalSize = 0, readyToRender = false] =
      useListSignals(SIGNALS);

    const containers = useMemo(() => {
      const ids: number[] = [];

      for (let id = 0; id < numContainers; id++) ids.push(id);

      return ids;
    }, [numContainers]);

    const style = useMemo(
      () => ({ height: totalSize, opacity: readyToRender ? 1 : 0 }),
      [totalSize, readyToRender],
    );

    const alignStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: alignOffset.value }],
    }));

    return (
      <Animated.View style={[style, alignStyle]}>
        {containers.map(id => (
          <ListItemContainer
            key={id}
            id={id}
            renderItem={renderItem}
            extraData={extraData}
            ItemSeparatorComponent={ItemSeparatorComponent}
          />
        ))}
      </Animated.View>
    );
  },
);

ListContainers.displayName = "ListContainers";
