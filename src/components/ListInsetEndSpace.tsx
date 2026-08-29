import React, { memo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

interface IAnchorListInsetEndSpaceProps {
  /** Высота распорки — нижний отступ списка. */
  height: SharedValue<number>;
}

/**
 * Распорка нижнего отступа — самое последнее в контенте.
 *
 * Ниже подвала: панель ввода перекрывает список целиком, а не только элементы,
 * и подвал обязан останавливаться над ней так же, как последняя строка.
 *
 * Высота идёт стилем, а не сигналом: она меняется каждый кадр клавиатуры, и
 * перерисовывать ради этого дерево нельзя.
 */
export const ListInsetEndSpace = memo<IAnchorListInsetEndSpaceProps>(
  ({ height }) => {
    const style = useAnimatedStyle(() => ({ height: height.value }));

    return <Animated.View style={style} pointerEvents={"none"} />;
  },
);

ListInsetEndSpace.displayName = "ListInsetEndSpace";
