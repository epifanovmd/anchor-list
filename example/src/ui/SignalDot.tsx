import type { FC } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "./theme";
import { Txt } from "./Txt";

interface ISignalDotProps {
  label: string;
  /** Признак с UI-потока: загорание считается там же, без рендера. */
  value: SharedValue<boolean>;
}

/**
 * Булев признак списка как загорающаяся точка.
 *
 * Читает shared value напрямую: значение меняется на каждом кадре скролла, и
 * через React это был бы рендер на кадр.
 */
export const SignalDot: FC<ISignalDotProps> = memo(({ label, value }) => {
  const { palette } = useTheme();

  const dotStyle = useAnimatedStyle(() => ({
    opacity: value.value ? 1 : 0.25,
    transform: [{ scale: value.value ? 1 : 0.75 }],
  }));

  return (
    <View style={ss.row}>
      <Animated.View
        style={[ss.dot, dotStyle, { backgroundColor: palette.accent }]}
      />
      <Txt role={"caption"} muted>
        {label}
      </Txt>
    </View>
  );
});

SignalDot.displayName = "SignalDot";

const ss = StyleSheet.create({
  dot: { borderRadius: 4, height: 8, width: 8 },
  row: { alignItems: "center", flexDirection: "row", gap: 5 },
});
