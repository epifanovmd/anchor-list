import type { FC } from "react";
import { useCallback, useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";

import type { DemoId } from "./demos";
import { DemoGallery, DEMOS } from "./demos";
import { useTheme } from "./ui";

/**
 * Открытый стенд или витрина.
 *
 * Навигация — собственный переключатель на одном состоянии, а не библиотека:
 * пример должен собираться из зависимостей самого списка и того немногого, что
 * нужно стендам. Стенд размонтируется при уходе, поэтому «уйти и вернуться»
 * здесь значит ровно то же, что в приложении с навигатором.
 */
export const DemoSwitch: FC = () => {
  const { palette, isDark } = useTheme();
  const [openId, setOpenId] = useState<DemoId | undefined>(undefined);

  const handleBack = useCallback(() => setOpenId(undefined), []);

  const entry = DEMOS.find(demo => demo.id === openId);
  const DemoScreen = entry?.screen;

  return (
    <View style={[ss.root, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {DemoScreen ? (
        <DemoScreen onBack={handleBack} />
      ) : (
        <DemoGallery onOpen={setOpenId} />
      )}
    </View>
  );
};

DemoSwitch.displayName = "DemoSwitch";

const ss = StyleSheet.create({
  root: { flex: 1 },
});
