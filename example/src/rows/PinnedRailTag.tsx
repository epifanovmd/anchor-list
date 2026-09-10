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
 * `flex: 1` здесь обязателен. Слой прижимает копию к кромке оси и растягивает
 * поперёк — то есть на всю высоту ленты; без него слот сжался бы по метке и
 * встал бы у верхнего края, а оригинал внутри карточки сидит у нижнего. На
 * стыке это выглядит как прыжок метки вверх в момент прилипания.
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
          {row.month.slice(0, 3)}
        </Txt>
      </View>
    </View>
  );
});

PinnedRailTag.displayName = "PinnedRailTag";

const ss = StyleSheet.create({
  // `paddingBottom` повторяет `bottom` метки внутри карточки: копия обязана
  // встать ровно туда, откуда исчез оригинал.
  slot: {
    alignItems: "flex-end",
    flex: 1,
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
