import type { FC, ReactNode } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "./theme";
import { Txt } from "./Txt";

interface IMeterBarProps {
  label: string;
  /** Величина с UI-потока. */
  value: SharedValue<number>;
  /** Значение, при котором полоса заполнена целиком. */
  max: SharedValue<number> | number;
  /**
   * Откуда растёт полоса.
   *
   * `start` — слева направо, для величин от нуля вверх. `center` — от середины
   * в обе стороны, для знаковых: так видно и модуль скорости, и направление.
   */
  origin?: "start" | "center";
  /**
   * Что показать справа от подписи — обычно {@link LiveNumber} с той же
   * величиной: полоса даёт порядок, число даёт точность.
   */
  readout?: ReactNode;
}

/**
 * Величина списка как полоса, считаемая на UI-потоке.
 *
 * Ширина пересчитывается в такт скроллу и не проходит через React: ради этого
 * `sharedValues` и существуют.
 */
export const MeterBar: FC<IMeterBarProps> = memo(
  ({ label, value, max, origin = "start", readout }) => {
    const { palette } = useTheme();

    const fillStyle = useAnimatedStyle(() => {
      const limit = typeof max === "number" ? max : max.value;
      const ratio = limit > 0 ? value.value / limit : 0;

      if (origin === "start") {
        return {
          left: 0,
          width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
        };
      }

      const half = Math.min(50, Math.abs(ratio) * 50);

      return {
        left: ratio < 0 ? `${50 - half}%` : "50%",
        width: `${half}%`,
      };
    });

    return (
      <View style={ss.block}>
        <View style={ss.head}>
          <Txt role={"caption"} muted style={ss.label}>
            {label}
          </Txt>
          {readout}
        </View>
        <View style={[ss.track, { backgroundColor: palette.pill }]}>
          <Animated.View
            style={[ss.fill, fillStyle, { backgroundColor: palette.accent }]}
          />
        </View>
      </View>
    );
  },
);

MeterBar.displayName = "MeterBar";

const ss = StyleSheet.create({
  block: { gap: 3 },
  fill: { borderRadius: 3, bottom: 0, position: "absolute", top: 0 },
  head: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  label: { flexShrink: 1 },
  track: { borderRadius: 3, height: 6, overflow: "hidden" },
});
