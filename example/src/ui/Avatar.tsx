import type { FC } from "react";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

/** Палитра аватаров: цвет выбирается по имени, поэтому у автора он постоянный. */
const COLORS = ["#E4572E", "#17BEBB", "#3B82F6", "#8E5BF0", "#2E8B57"];

/** Сумма кодов имени по модулю палитры: у автора цвет всегда один и тот же. */
const colorOf = (name: string): string => {
  let sum = 0;

  for (let index = 0; index < name.length; index++) {
    sum = (sum + name.charCodeAt(index)) % COLORS.length;
  }

  return COLORS[sum]!;
};

interface IAvatarProps {
  name: string;
  size?: number;
}

/** Аватар автора: буква на цветном круге. */
export const Avatar: FC<IAvatarProps> = memo(({ name, size = 36 }) => {
  const style = useMemo(
    () => [
      ss.avatar,
      {
        backgroundColor: colorOf(name),
        borderRadius: size / 2,
        height: size,
        width: size,
      },
    ],
    [name, size],
  );

  return (
    <View style={style}>
      <Text style={[ss.letter, { fontSize: size * 0.42 }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
});

Avatar.displayName = "Avatar";

const ss = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  letter: { color: "#FFFFFF", fontWeight: "700" },
});
