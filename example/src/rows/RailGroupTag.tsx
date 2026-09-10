import type { FC } from "react";
import { memo } from "react";
import { StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { GROUP_TAG_WIDTH } from "../data";
import { Txt, useTheme } from "../ui";

interface IRailGroupTagProps {
  group: number;
  /** Смещение прилипания от списка: применяется только к метке. */
  stickyOffset?: SharedValue<number>;
  /** Метка сейчас нарисована слоем поверх списка — свою нужно спрятать. */
  stickyPinned?: SharedValue<boolean>;
}

/**
 * Метка группы, прилипающая к правой кромке.
 *
 * Зеркало `GroupAvatar` из чата: там смещение уходит в `translateY`, здесь — в
 * `translateX`. Механика списка одна и та же, разной её делает только ось, а
 * ось выбирает тот, кто рисует ячейку.
 *
 * Пока метка стоит у самой кромки, её рисует слой поверх списка, а этот
 * экземпляр прячется: `opacity` в ноль, но узел остаётся на месте — иначе
 * поехала бы раскладка карточки.
 */
export const RailGroupTag: FC<IRailGroupTagProps> = memo(
  ({ group, stickyOffset, stickyPinned }) => {
    const { palette } = useTheme();

    const style = useAnimatedStyle(() => ({
      opacity: stickyPinned?.value ? 0 : 1,
      transform: [{ translateX: stickyOffset?.value ?? 0 }],
    }));

    return (
      <Animated.View
        style={[
          ss.tag,
          { backgroundColor: palette.accent, width: GROUP_TAG_WIDTH },
          style,
        ]}
      >
        <Txt role={"caption"} style={{ color: palette.accentText }}>
          {`#${group}`}
        </Txt>
      </Animated.View>
    );
  },
);

RailGroupTag.displayName = "RailGroupTag";

const ss = StyleSheet.create({
  // Метка прижата к правому нижнему углу карточки: список ограничивает её ход
  // краями группы, и видимый край обязан совпадать с тем, по которому считает
  // список.
  tag: {
    alignItems: "center",
    borderRadius: 10,
    bottom: 12,
    justifyContent: "center",
    paddingVertical: 4,
    position: "absolute",
    right: 0,
  },
});
