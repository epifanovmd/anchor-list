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
 * вызывающий, а не список. Вертикальные отступы повторяют слот метки в
 * карточке — иначе копия встанет не на то место, откуда исчез оригинал. В
 * вертикальном списке ту же роль играют горизонтальные: сторону задаёт ось.
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
