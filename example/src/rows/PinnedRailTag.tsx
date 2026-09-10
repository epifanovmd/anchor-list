import type { FC } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { RailRowData } from "../data";
import { GROUP_TAG_WIDTH } from "../data";
import { Txt, useTheme } from "../ui";

interface IPinnedRailTagProps {
  row: RailRowData;
}

/**
 * Прилипшая копия метки для слоя поверх списка.
 *
 * У кромки стоит не карточка, а метка внутри неё, поэтому копию рисует
 * вызывающий, а не список. Отступы **поперёк оси** обязаны повторять слот метки
 * в карточке: в горизонтальном списке это вертикальные, в вертикальном —
 * горизонтальные.
 *
 * Подпись обязана совпадать с той, что рисует `RailGroupTag`: копия подменяет
 * оригинал на кромке, и любое расхождение видно как подмену текста в момент
 * прилипания.
 */
export const PinnedRailTag: FC<IPinnedRailTagProps> = memo(({ row }) => {
  const { palette } = useTheme();

  if (row.type !== "card" || !row.isGroupTail) return null;

  return (
    <View style={ss.slot}>
      <View
        style={[
          ss.tag,
          { backgroundColor: palette.accent, width: GROUP_TAG_WIDTH },
        ]}
      >
        <Txt role={"caption"} style={{ color: palette.accentText }}>
          {`#${row.group}`}
        </Txt>
      </View>
    </View>
  );
});

PinnedRailTag.displayName = "PinnedRailTag";

const ss = StyleSheet.create({
  // `paddingBottom` повторяет `bottom` метки внутри карточки: копия обязана
  // встать ровно туда, откуда исчез оригинал. Высоту слоту даёт слой — он
  // растягивает копию поперёк оси, — поэтому `flex` здесь не нужен.
  slot: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  tag: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    paddingVertical: 4,
  },
});
