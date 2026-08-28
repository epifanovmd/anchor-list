import type { FC, ReactNode } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

interface IChipRowProps {
  children: ReactNode;
}

/** Ряд кнопок, переносящийся по ширине экрана. */
export const ChipRow: FC<IChipRowProps> = memo(({ children }) => (
  <View style={ss.row}>{children}</View>
));

ChipRow.displayName = "ChipRow";

const ss = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
});
