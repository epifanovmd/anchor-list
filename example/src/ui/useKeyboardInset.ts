import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "./useKeyboardHeight";

/** Сколько низа экрана занято не контентом. */
export interface IKeyboardInset {
  /**
   * Перекрытие снизу: клавиатура либо безопасная зона.
   *
   * Именно максимум, а не сумма: открытая клавиатура закрывает собой и домашний
   * индикатор, и добавлять его отступ поверх неё нечего.
   */
  occludedBottom: SharedValue<number>;
  /**
   * Сама высота клавиатуры, без безопасной зоны.
   *
   * Нужна панели ввода: подниматься она обязана ровно на клавиатуру, а зону под
   * собой гасить — иначе между строкой ввода и клавишами остаётся пустая полоса.
   */
  keyboardHeight: SharedValue<number>;
  /** Полное перекрытие: зона плюс панель ввода. */
  contentInset: SharedValue<number>;
  /**
   * То же перекрытие, но целевое — известно до начала движения.
   *
   * Та же формула, только на целевой высоте клавиатуры. По нему резервируется
   * место в конце контента: без резерва у самого низа списка сдвиг упирается в
   * ещё не выросший диапазон скролла.
   */
  reservedInset: SharedValue<number>;
}

/**
 * Нижнее перекрытие экрана одним источником.
 *
 * Отсюда его берут все, кто до низа дотягивается: панель ввода, распорка и
 * сдвиг скролла, кнопка возврата, индикатор скролла и якорь конечной кромки.
 * Считать «сколько занято снизу» каждому самостоятельно — значит получить
 * столько же расходящихся ответов.
 *
 * @param barHeight высота панели ввода без безопасной зоны под ней.
 */
export const useKeyboardInset = (
  barHeight: SharedValue<number>,
): IKeyboardInset => {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();

  const occludedBottom = useDerivedValue(() =>
    Math.max(keyboard.height.value, safeAreaBottom),
  );

  const occludedBottomTarget = useDerivedValue(() =>
    Math.max(keyboard.targetHeight.value, safeAreaBottom),
  );

  const contentInset = useDerivedValue(
    () => occludedBottom.value + barHeight.value,
  );

  const reservedInset = useDerivedValue(
    () => occludedBottomTarget.value + barHeight.value,
  );

  return {
    occludedBottom,
    keyboardHeight: keyboard.height,
    contentInset,
    reservedInset,
  };
};
