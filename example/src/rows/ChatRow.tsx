import type { FC } from "react";
import { memo } from "react";
import type { ViewStyle } from "react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { AnimatedStyle, SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";

import type { ChatRowData } from "../data";
import { AVATAR_SIZE, DAY_ROW_HEIGHT, SPINNER_ROW_HEIGHT } from "../data";
import { Txt, useTheme } from "../ui";
import { GroupAvatar } from "./GroupAvatar";

interface IChatRowProps {
  row: ChatRowData;
  /** Рисовать ли аватар у хвоста группы — включает стенд прилипания. */
  withAvatar?: boolean;
  /** Смещение прилипания от списка: применяется только к аватару. */
  stickyOffset?: SharedValue<number>;
  /** Аватар сейчас нарисован слоем поверх списка. */
  stickyPinned?: SharedValue<boolean>;
  /**
   * Стиль пузыря — сюда приходят эффекты строки: подсветка, затухание.
   *
   * Именно пузыря, а не строки: строка — это слот с зазором сверху и полями
   * по бокам, и эффект на ней показал бы границы слота, а не сообщения.
   */
  bubbleStyle?: AnimatedStyle<ViewStyle>;
}

/** Строка примера: сообщение, разделитель даты или спиннер подгрузки. */
export const ChatRow: FC<IChatRowProps> = memo(
  ({ row, withAvatar = false, stickyOffset, stickyPinned, bubbleStyle }) => {
    const { palette } = useTheme();

    if (row.type === "spinner") {
      return (
        <View style={[ss.spinner, { height: SPINNER_ROW_HEIGHT }]}>
          <ActivityIndicator />
          <Txt role={"caption"} muted style={ss.spinnerText}>
            {row.edge === "start" ? "Грузим старые…" : "Грузим новые…"}
          </Txt>
        </View>
      );
    }

    if (row.type === "day") {
      return (
        <View style={[ss.dayRow, { height: DAY_ROW_HEIGHT }]}>
          <View style={[ss.dayPill, { backgroundColor: palette.pill }]}>
            <Txt role={"caption"}>{row.day}</Txt>
          </View>
        </View>
      );
    }

    return (
      <View style={[ss.message, { height: row.height }]}>
        {withAvatar ? (
          <View style={ss.avatarSlot}>
            {row.isGroupTail ? (
              <GroupAvatar
                name={row.author}
                size={AVATAR_SIZE}
                stickyOffset={stickyOffset}
                stickyPinned={stickyPinned}
              />
            ) : null}
          </View>
        ) : null}

        <Animated.View
          style={[ss.bubble, { backgroundColor: palette.bubble }, bubbleStyle]}
        >
          <Txt role={"caption"} muted>
            {`${row.author} · ${row.day}`}
          </Txt>
          <Txt role={"body"}>{row.text}</Txt>
        </Animated.View>
      </View>
    );
  },
);

ChatRow.displayName = "ChatRow";

const ss = StyleSheet.create({
  // Аватар садится на низ строки, а низ строки — это низ пузыря: зазор до
  // соседа лежит снаружи слота, его задаёт список пропом `gap`.
  avatarSlot: { justifyContent: "flex-end", width: 44 },
  // Без вертикальных отступов: строка равна пузырю, и всё, что список считает
  // по строке — размер, границы группы, видимость, подсветку, — он считает по
  // пузырю.
  bubble: {
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    padding: 10,
  },
  dayPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  dayRow: { alignItems: "center", justifyContent: "center" },
  message: { flexDirection: "row", paddingHorizontal: 12 },
  spinner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  spinnerText: { marginLeft: 8 },
});
