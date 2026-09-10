import React, { memo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useListHorizontal } from "../model";
import { getAxisLengthStyle } from "./axis";

interface IAnchorListInsetEndSpaceProps {
  /** Длина распорки вдоль оси — отступ у конечной кромки списка. */
  size: SharedValue<number>;
}

/**
 * Распорка нижнего отступа — самое последнее в контенте.
 *
 * Ниже подвала: панель ввода перекрывает список целиком, а не только элементы,
 * и подвал обязан останавливаться над ней так же, как последняя строка.
 *
 * Длина идёт стилем, а не сигналом: она меняется каждый кадр клавиатуры, и
 * перерисовывать ради этого дерево нельзя.
 */
export const ListInsetEndSpace = memo<IAnchorListInsetEndSpaceProps>(
  ({ size }) => {
    const horizontal = useListHorizontal();
    const style = useAnimatedStyle(() =>
      getAxisLengthStyle(size.value, horizontal),
    );

    return <Animated.View style={style} pointerEvents={"none"} />;
  },
);

ListInsetEndSpace.displayName = "ListInsetEndSpace";
