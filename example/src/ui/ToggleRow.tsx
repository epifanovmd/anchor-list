import type { FC } from "react";
import { memo } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { Txt } from "./Txt";

interface IToggleRowProps {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Переключатель проверяемого поведения. */
export const ToggleRow: FC<IToggleRowProps> = memo(
  ({ title, value, onChange }) => (
    <View style={ss.row}>
      <Txt role={"caption"} style={ss.title}>
        {title}
      </Txt>
      <Switch value={value} onValueChange={onChange} />
    </View>
  ),
);

ToggleRow.displayName = "ToggleRow";

const ss = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 32,
  },
  title: { flex: 1, paddingRight: 12 },
});
