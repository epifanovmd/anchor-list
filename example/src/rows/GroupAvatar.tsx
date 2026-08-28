import type { FC } from "react";
import { memo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Avatar } from "../ui";

interface IGroupAvatarProps {
  name: string;
  size: number;
  /** Смещение прилипания от списка: применяется только к аватару. */
  stickyOffset?: SharedValue<number>;
  /** Аватар сейчас нарисован слоем поверх списка — свой нужно спрятать. */
  stickyPinned?: SharedValue<boolean>;
}

/**
 * Аватар группы, прилипающий к нижней кромке.
 *
 * Смещение приходит от списка shared value, поэтому маппер Reanimated заводится
 * только здесь — у хвоста группы, а не у каждой строки списка.
 *
 * Пока аватар стоит у самой кромки, его рисует слой поверх списка, а этот
 * экземпляр прячется: `opacity` в ноль, но узел остаётся на месте — иначе
 * поехала бы раскладка строки.
 */
export const GroupAvatar: FC<IGroupAvatarProps> = memo(
  ({ name, size, stickyOffset, stickyPinned }) => {
    const style = useAnimatedStyle(() => ({
      opacity: stickyPinned?.value ? 0 : 1,
      transform: [{ translateY: stickyOffset?.value ?? 0 }],
    }));

    return (
      <Animated.View style={style}>
        <Avatar name={name} size={size} />
      </Animated.View>
    );
  },
);

GroupAvatar.displayName = "GroupAvatar";
