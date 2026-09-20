import { useAnchorListItemVisibility } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import type { ChatRowData } from "../data";
import { useTheme } from "../ui";
import { ChatRow } from "./ChatRow";

interface IFadingChatRowProps {
  row: ChatRowData;
  /** Гасить строку по мере ухода за кромку; иначе только полоса прогресса. */
  fade: boolean;
}

/**
 * Строка, знающая, насколько она на экране.
 *
 * `useAnchorListItemVisibility` отдаёт долю строки во вьюпорте shared value:
 * прозрачность и масштаб считаются от неё в `useAnimatedStyle` — каждым
 * кадром скролла, без единого рендера. Полоса справа показывает ту же долю
 * числом: по ней видно, что под панелью снизу строка «не видна», хотя и лежит
 * внутри ScrollView, и что прилипший заголовок дня считается от места, где
 * стоит, а не где лежит.
 *
 * Хук вызывается здесь, а не в `renderItem`: внутри компонента, который
 * `renderItem` вернул, — иначе значение привязалось бы к контейнеру.
 */
export const FadingChatRow: FC<IFadingChatRowProps> = memo(({ row, fade }) => {
  const { palette } = useTheme();
  const visibility = useAnchorListItemVisibility();

  const rowStyle = useAnimatedStyle(() =>
    fade
      ? {
          opacity: 0.25 + 0.75 * visibility.value,
          transform: [{ scale: 0.94 + 0.06 * visibility.value }],
        }
      : { opacity: 1, transform: [{ scale: 1 }] },
  );

  const gaugeStyle = useAnimatedStyle(() => ({
    height: `${Math.round(visibility.value * 100)}%`,
  }));

  return (
    <View style={ss.wrap}>
      <Animated.View style={[ss.row, rowStyle]}>
        <ChatRow row={row} />
      </Animated.View>
      <View style={[ss.gaugeTrack, { backgroundColor: palette.pill }]}>
        <Animated.View
          style={[
            ss.gaugeFill,
            gaugeStyle,
            { backgroundColor: palette.accent },
          ]}
        />
      </View>
    </View>
  );
});

FadingChatRow.displayName = "FadingChatRow";

const ss = StyleSheet.create({
  gaugeFill: {
    borderRadius: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  gaugeTrack: {
    borderRadius: 2,
    marginBottom: 4,
    marginRight: 8,
    marginTop: 12,
    overflow: "hidden",
    width: 4,
  },
  row: { flex: 1 },
  wrap: { flexDirection: "row" },
});
