import type { FC } from "react";
import { memo } from "react";
import type { TextInputProps } from "react-native";
import { StyleSheet, TextInput } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedProps } from "react-native-reanimated";

import { useTheme } from "./theme";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface ILiveNumberProps {
  /** Величина с UI-потока. */
  value: SharedValue<number>;
  /** Знаков после запятой. */
  digits?: number;
  /** Приписка слева: подпись величины. */
  prefix?: string;
  /** Приписка справа: единицы измерения. */
  suffix?: string;
}

/**
 * Число, обновляемое на UI-потоке.
 *
 * Зачем так: текст в React обновляется только рендером, а величина меняется на
 * каждом кадре скролла — это рендер на кадр. Прописать текст в уже
 * смонтированный узел можно через `animatedProps` нередактируемого `TextInput`:
 * цифры бегут в такт скроллу, а React об этом не знает.
 */
export const LiveNumber: FC<ILiveNumberProps> = memo(
  ({ value, digits = 2, prefix = "", suffix = "" }) => {
    const { palette } = useTheme();

    const animatedProps = useAnimatedProps(() => {
      const text = `${prefix}${value.value.toFixed(digits)}${suffix}`;

      // `defaultValue` — для первого кадра: он ставится до того, как маппер
      // впервые запишет `text`.
      return { text, defaultValue: text } as Partial<TextInputProps>;
    });

    return (
      <AnimatedTextInput
        editable={false}
        // Значение приходит из `animatedProps`; React сюда не пишет.
        value={undefined}
        underlineColorAndroid={"transparent"}
        animatedProps={animatedProps}
        style={[ss.text, { color: palette.text }]}
      />
    );
  },
);

LiveNumber.displayName = "LiveNumber";

const ss = StyleSheet.create({
  text: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    lineHeight: 16,
    margin: 0,
    padding: 0,
    textAlign: "right",
  },
});
