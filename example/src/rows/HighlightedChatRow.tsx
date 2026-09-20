import { useAnchorListItemHighlight } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { memo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";

import type { ChatRowData } from "../data";
import { useTheme } from "../ui";
import { ChatRow } from "./ChatRow";

/** Как выглядит подсветка: фон, рамка или лёгкий «пульс» масштабом. */
export type HighlightStyle = "background" | "outline" | "pulse";

interface IHighlightedChatRowProps {
  row: ChatRowData;
  variant: HighlightStyle;
}

/**
 * Строка, умеющая подсвечиваться после перехода к ней.
 *
 * Список отдаёт строке только момент и длительности —
 * `useAnchorListItemHighlight().progress` идёт от 0 к 1 и обратно на
 * UI-потоке, — а как это выглядит, решает сама строка. Три варианта здесь —
 * ровно чтобы показать, что стиль не зашит в список.
 *
 * Хук вызывается внутри компонента, который `renderItem` вернул, — иначе
 * подсветка привязалась бы к контейнеру и досталась чужой строке.
 */
export const HighlightedChatRow: FC<IHighlightedChatRowProps> = memo(
  ({ row, variant }) => {
    const { palette } = useTheme();
    const { progress } = useAnchorListItemHighlight();

    // Подложка, а не рамка на самой строке: объявленный размер строки границу
    // не включает, и рамка на обёртке сдвинула бы всё ниже на её толщину.
    const backdropStyle = useAnimatedStyle(() => ({
      backgroundColor:
        variant === "background"
          ? interpolateColor(
              progress.value,
              [0, 1],
              ["transparent", palette.accent + "55"],
            )
          : "transparent",
      borderColor:
        variant === "outline"
          ? interpolateColor(
              progress.value,
              [0, 1],
              ["transparent", palette.accent],
            )
          : "transparent",
    }));

    const pulseStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: variant === "pulse" ? 1 + 0.04 * progress.value : 1 },
      ],
    }));

    return (
      <Animated.View style={pulseStyle}>
        <Animated.View
          pointerEvents={"none"}
          style={[ss.backdrop, backdropStyle]}
        />
        <ChatRow row={row} />
      </Animated.View>
    );
  },
);

HighlightedChatRow.displayName = "HighlightedChatRow";

const ss = StyleSheet.create({
  backdrop: {
    borderRadius: 14,
    borderWidth: 2,
    bottom: 0,
    left: 6,
    position: "absolute",
    right: 6,
    top: 0,
  },
});
