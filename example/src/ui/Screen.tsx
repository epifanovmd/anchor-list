import type { FC, ReactNode } from "react";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "./theme";
import { Txt } from "./Txt";

interface IScreenProps {
  title: string;
  /** Кнопка возврата; на витрине её нет. */
  onBack?: () => void;
  children: ReactNode;
}

/**
 * Экран стенда: заголовок и содержимое под ним.
 *
 * Верхний отступ берётся из safe area, а не из константы: вырез и статус-бар
 * отличаются между устройствами, а заголовок обязан оказаться под ними на любом.
 */
export const Screen: FC<IScreenProps> = memo(({ title, onBack, children }) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[ss.screen, { backgroundColor: palette.background }]}>
      <View
        style={[
          ss.bar,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        {/* Боковые слоты одинаковой ширины: заголовок между ними встаёт по
            центру экрана, а не по центру остатка. Правый пустой и нужен только
            ради этой симметрии. */}
        <View style={ss.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={16}
              accessibilityRole={"button"}
              accessibilityLabel={"Назад"}
            >
              <Txt
                role={"title"}
                style={[ss.chevron, { color: palette.accent }]}
              >
                {"‹"}
              </Txt>
            </Pressable>
          ) : null}
        </View>

        <Txt role={"title"} numberOfLines={1} style={ss.title}>
          {title}
        </Txt>

        <View style={ss.side} />
      </View>

      {children}
    </View>
  );
});

Screen.displayName = "Screen";

const ss = StyleSheet.create({
  bar: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  chevron: { fontSize: 36, lineHeight: 36 },
  screen: { flex: 1 },
  side: { width: 32 },
  title: { flex: 1, textAlign: "center" },
});
