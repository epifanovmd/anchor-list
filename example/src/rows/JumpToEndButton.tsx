import type { FC } from "react";
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { Txt, useTheme } from "../ui";

const SIZE = 40;
/** Зазор между кнопкой и верхней кромкой панели ввода. */
const GAP = 12;
const FADE_MS = 250;

interface IJumpToEndButtonProps {
  /**
   * Нижний отступ контента. Тот же, что отдан списку, — иначе кнопка и контент
   * кончаются на разных линиях.
   */
  bottomInset: SharedValue<number>;
  /** Список у нижнего края — тогда кнопка не нужна. */
  isAtEnd: SharedValue<boolean>;
  onPress: () => void;
}

/**
 * Кнопка возврата к концу списка.
 *
 * Позиция и видимость считаются на UI-потоке: `isAtEnd` приходит из
 * `sharedValues` списка, отступ — из той же величины, что получает контент.
 * Через React не проходит ничего, поэтому кнопка едет вместе с клавиатурой в
 * один кадр с ней, а не догоняет её через рендер.
 *
 * Двигается трансформом, а не `bottom`: тот пересчитывал бы раскладку на каждом
 * кадре анимации.
 */
export const JumpToEndButton: FC<IJumpToEndButtonProps> = memo(
  ({ bottomInset, isAtEnd, onPress }) => {
    const { palette } = useTheme();

    const containerStyle = useAnimatedStyle(() => ({
      opacity: withTiming(isAtEnd.value ? 0 : 1, { duration: FADE_MS }),
      transform: [{ translateY: -(bottomInset.value + GAP) }],
      // Видимость считается на UI-потоке, поэтому pointerEvents задаётся стилем,
      // а не пропом: React не должен перехватывать тапы скрытой кнопки.
      pointerEvents: isAtEnd.value ? "none" : "auto",
    }));

    return (
      <Animated.View style={[ss.container, containerStyle]}>
        <Pressable
          onPress={onPress}
          style={[
            ss.button,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Txt role={"body"} style={{ color: palette.accent }}>
            {"↓"}
          </Txt>
        </Pressable>
      </Animated.View>
    );
  },
);

JumpToEndButton.displayName = "JumpToEndButton";

const ss = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    height: SIZE,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    width: SIZE,
  },
  container: { bottom: 0, position: "absolute", right: 12, width: SIZE },
});
