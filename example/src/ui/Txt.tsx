import type { FC, ReactNode } from "react";
import { memo } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet, Text } from "react-native";

import { useTheme } from "./theme";

/** Роль текста; заменяет типографику дизайн-системы приложения. */
export type TxtRole = "title" | "body" | "caption";

interface ITxtProps {
  children: ReactNode;
  role?: TxtRole;
  /** Приглушённый цвет: подписи и пояснения. */
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Текст стенда: три роли и два цвета — больше примерам не нужно. */
export const Txt: FC<ITxtProps> = memo(
  ({ children, role = "body", muted = false, style, numberOfLines }) => {
    const { palette } = useTheme();

    return (
      <Text
        numberOfLines={numberOfLines}
        style={[
          ss[role],
          { color: muted ? palette.textMuted : palette.text },
          style,
        ]}
      >
        {children}
      </Text>
    );
  },
);

Txt.displayName = "Txt";

const ss = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
});
