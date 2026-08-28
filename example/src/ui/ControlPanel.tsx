import type { FC, ReactNode } from "react";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "./theme";

interface IControlPanelProps {
  children: ReactNode;
}

/**
 * Панель управления стендом.
 *
 * Лежит над списком, а не внутри него: всё, что меняет раскладку списка, должно
 * приходить от самого списка, иначе стенд проверяет не то, что показывает.
 */
export const ControlPanel: FC<IControlPanelProps> = memo(({ children }) => {
  const { palette } = useTheme();

  return (
    <View style={[ss.panel, { backgroundColor: palette.panel }]}>
      {children}
    </View>
  );
});

ControlPanel.displayName = "ControlPanel";

const ss = StyleSheet.create({
  panel: { borderRadius: 12, margin: 8, padding: 10 },
});
