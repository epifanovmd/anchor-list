import React, { ComponentType, memo, useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useListSignals } from "../hooks";
import { useListHorizontal } from "../model";
import type { IAnchorListRenderItemProps } from "../types";
import { getAxisLengthStyle, getAxisTranslate } from "./axis";
import { ListItemContainer } from "./ListItemContainer";

interface IAnchorListContainersProps {
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => React.ReactNode;
  extraData: unknown;
  ItemSeparatorComponent?: ComponentType<unknown> | null;
  /** Сдвиг к концу оси, прижимающий короткий контент к концу списка. */
  alignOffset: SharedValue<number>;
}

const SIGNALS = ["numContainers", "totalSize", "readyToRender"] as const;

/**
 * Слой контейнеров.
 *
 * Задаёт длину контента вдоль оси по суммарному размеру элементов — контейнеры
 * внутри позиционированы абсолютно и на неё не влияют. До первого готового
 * кадра слой прозрачен: иначе виден скачок с оценочных размеров на измеренные.
 *
 * Короткий контент прижимает к концу трансформ, а не отступ в раскладке: длина
 * контента от него не меняется, поэтому список остаётся непрокручиваемым, пока
 * контент помещается на экран. Считается сдвиг на UI-потоке — он едет вместе с
 * клавиатурой.
 */
export const ListContainers = memo<IAnchorListContainersProps>(
  ({ renderItem, extraData, ItemSeparatorComponent, alignOffset }) => {
    const [numContainers = 0, totalSize = 0, readyToRender = false] =
      useListSignals(SIGNALS);
    const horizontal = useListHorizontal();

    const containers = useMemo(() => {
      const ids: number[] = [];

      for (let id = 0; id < numContainers; id++) ids.push(id);

      return ids;
    }, [numContainers]);

    const style = useMemo(
      () => [
        getAxisLengthStyle(totalSize, horizontal),
        { opacity: readyToRender ? 1 : 0 },
      ],
      [totalSize, readyToRender, horizontal],
    );

    const alignStyle = useAnimatedStyle(() => ({
      transform: getAxisTranslate(alignOffset.value, horizontal),
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
