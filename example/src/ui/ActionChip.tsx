import type { FC } from "react";
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "./theme";
import { Txt } from "./Txt";

interface IActionChipProps {
  title: string;
  onPress: () => void;
}

/** Кнопка разового действия. */
export const ActionChip: FC<IActionChipProps> = memo(({ title, onPress }) => {
  const { palette } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[ss.chip, { backgroundColor: palette.pill }]}
    >
      <Txt role={"caption"}>{title}</Txt>
    </Pressable>
  );
});

ActionChip.displayName = "ActionChip";

const ss = StyleSheet.create({
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
