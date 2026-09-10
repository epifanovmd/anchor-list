import type { FC } from "react";
import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import type { RailRowData } from "../data";
import { CARD_GAP, MONTH_MARKER_WIDTH, RAIL_SPINNER_WIDTH } from "../data";
import { Txt, useTheme } from "../ui";
import { RailGroupTag } from "./RailGroupTag";

interface IRailCardProps {
  row: RailRowData;
  /** Рисовать ли метку у хвоста группы — включает стенд прилипания. */
  withTag?: boolean;
  /** Смещение прилипания от списка: применяется только к метке. */
  stickyOffset?: SharedValue<number>;
  /** Метка сейчас нарисована слоем поверх списка. */
  stickyPinned?: SharedValue<boolean>;
}

/**
 * Элемент горизонтальной ленты: карточка, метка месяца или спиннер.
 *
 * Размеры заданы только по ширине. Высоту элементу даёт слот списка — он
 * растянут поперёк оси на весь вьюпорт, — и задавать её здесь значит спорить с
 * раскладкой: карточка встала бы не на всю ленту, а по своей высоте.
 */
export const RailCard: FC<IRailCardProps> = memo(
  ({ row, withTag = false, stickyOffset, stickyPinned }) => {
    const { palette } = useTheme();

    if (row.type === "spinner") {
      return (
        <View style={[ss.spinner, { width: RAIL_SPINNER_WIDTH }]}>
          <ActivityIndicator />
          <Txt role={"caption"} muted style={ss.spinnerText}>
            {row.edge === "start" ? "Слева…" : "Справа…"}
          </Txt>
        </View>
      );
    }

    if (row.type === "month") {
      return (
        <View style={[ss.month, { width: MONTH_MARKER_WIDTH }]}>
          <View style={[ss.monthPill, { backgroundColor: palette.pill }]}>
            <Txt role={"caption"}>{row.month}</Txt>
          </View>
        </View>
      );
    }

    return (
      <View style={[ss.card, { width: row.width }]}>
        <View style={[ss.body, { backgroundColor: palette.bubble }]}>
          <Txt role={"caption"} muted>
            {row.month}
          </Txt>
          <Txt role={"body"}>{row.title}</Txt>
          <Txt role={"caption"} muted>
            {`${row.width} px`}
          </Txt>
        </View>

        {withTag && row.isGroupTail ? (
          <RailGroupTag
            month={row.month}
            stickyOffset={stickyOffset}
            stickyPinned={stickyPinned}
          />
        ) : null}
      </View>
    );
  },
);

RailCard.displayName = "RailCard";

const ss = StyleSheet.create({
  body: { borderRadius: 12, flex: 1, justifyContent: "center", padding: 10 },
  // Зазор между карточками — отступ слева: правый край карточки совпадает с
  // правым краем слота, поэтому метка садится ровно на него.
  card: { paddingLeft: CARD_GAP, paddingVertical: 12 },
  month: { alignItems: "center", justifyContent: "center" },
  monthPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  spinner: { alignItems: "center", justifyContent: "center" },
  spinnerText: { marginTop: 8 },
});
