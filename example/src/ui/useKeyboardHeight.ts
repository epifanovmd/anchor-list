import { useKeyboardHandler } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue, withTiming } from "react-native-reanimated";

/** Сырая высота клавиатуры на UI-потоке; 0 — скрыта. */
export type KeyboardHeight = SharedValue<number>;

/**
 * Единственная подписка на клавиатуру.
 *
 * Низкоуровневый источник правды: покадрово, на UI-потоке, включая закрытие
 * свайпом. О безопасной зоне и панелях не знает — это уже
 * {@link useKeyboardInset}.
 *
 * В `onStart` высота доводится анимацией на длительность самой клавиатуры:
 * покадровые события приходят не на всех платформах, и без этого движение было
 * бы ступенчатым.
 */
export const useKeyboardHeight = (): KeyboardHeight => {
  const height = useSharedValue(0);

  useKeyboardHandler({
    onStart: event => {
      "worklet";

      height.value = withTiming(event.height, { duration: event.duration });
    },
    onMove: event => {
      "worklet";

      height.value = event.height;
    },
    onInteractive: event => {
      "worklet";

      height.value = event.height;
    },
    onEnd: event => {
      "worklet";

      height.value = event.height;
    },
  });

  return height;
};
