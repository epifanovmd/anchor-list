import type { FC } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { ChatRowData } from "../data";
import { AVATAR_SIZE } from "../data";
import { Avatar } from "../ui";

interface IPinnedAvatarProps {
  row: ChatRowData;
}

/**
 * Прилипшая копия аватара для слоя поверх списка.
 *
 * У кромки стоит не строка, а аватар внутри неё, поэтому копию рисует вызывающий,
 * а не список. Горизонтальные отступы повторяют слот аватара в строке — иначе
 * копия встанет не на то место, откуда исчез оригинал.
 */
export const PinnedAvatar: FC<IPinnedAvatarProps> = memo(({ row }) => {
  if (row.type !== "message" || !row.isGroupTail) return null;

  return (
    <View style={ss.slot}>
      <Avatar name={row.author} size={AVATAR_SIZE} />
    </View>
  );
});

PinnedAvatar.displayName = "PinnedAvatar";

const ss = StyleSheet.create({
  slot: { paddingLeft: 12, width: 56 },
});
