import type { FC } from "react";
import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import type { ChatRowData } from "../data";
import {
  AVATAR_SIZE,
  DAY_ROW_HEIGHT,
  MESSAGE_GAP,
  SPINNER_ROW_HEIGHT,
} from "../data";
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
}

/** Строка примера: сообщение, разделитель даты или спиннер подгрузки. */
export const ChatRow: FC<IChatRowProps> = memo(
  ({ row, withAvatar = false, stickyOffset, stickyPinned }) => {
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

        <View style={[ss.bubble, { backgroundColor: palette.bubble }]}>
          <Txt role={"caption"} muted>
            {`${row.author} · ${row.day}`}
          </Txt>
          <Txt role={"body"}>{row.text}</Txt>
        </View>
      </View>
    );
  },
);

ChatRow.displayName = "ChatRow";

const ss = StyleSheet.create({
  // Слот повторяет вертикальные границы пузыря: тот же отступ сверху, низ по
  // низу строки. Так видимые края группы совпадают с теми, по которым список
  // ограничивает ход аватара.
  avatarSlot: { justifyContent: "flex-end", marginTop: MESSAGE_GAP, width: 44 },
  // Зазор между сообщениями — отступ сверху пузыря: низ пузыря совпадает с
  // низом строки, поэтому аватар садится ровно на него.
  bubble: {
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    marginTop: MESSAGE_GAP,
    padding: 10,
  },
  dayPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  dayRow: { alignItems: "center", justifyContent: "center" },
  // Без вертикальных отступов: список считает границы группы по краям строк, и
  // любой зазор здесь разводит их с видимыми краями сообщений.
  message: { flexDirection: "row", paddingHorizontal: 12 },
  spinner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  spinnerText: { marginLeft: 8 },
});
