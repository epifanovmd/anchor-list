import { useAnchorListItemHighlight } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { memo } from "react";
import { interpolateColor, useAnimatedStyle } from "react-native-reanimated";

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
 * Подсвечивается пузырь, а не слот строки. Слот — это вся строка вместе с
 * зазором над пузырём и полями по бокам: список измеряет, прилипает и считает
 * видимость по нему. Эффект на слоте показал бы его границы, а не сообщения.
 *
 * Хук вызывается внутри компонента, который `renderItem` вернул, — иначе
 * подсветка привязалась бы к контейнеру и досталась чужой строке.
 */
export const HighlightedChatRow: FC<IHighlightedChatRowProps> = memo(
  ({ row, variant }) => {
    const { palette } = useTheme();
    const { progress } = useAnchorListItemHighlight();

    const bubbleStyle = useAnimatedStyle(() => {
      if (variant === "outline") {
        return {
          borderColor: interpolateColor(
            progress.value,
            [0, 1],
            [palette.bubble, palette.accent],
          ),
          borderWidth: 2,
        };
      }

      if (variant === "pulse") {
        return { transform: [{ scale: 1 + 0.03 * progress.value }] };
      }

      return {
        backgroundColor: interpolateColor(
          progress.value,
          [0, 1],
          [palette.bubble, palette.accent],
        ),
      };
    });

    return <ChatRow row={row} bubbleStyle={bubbleStyle} />;
  },
);

HighlightedChatRow.displayName = "HighlightedChatRow";
