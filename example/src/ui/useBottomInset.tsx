import { useEffect } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Безопасная зона снизу для экранов без панели ввода.
 *
 * Отдаётся списку пропом `insetEnd` — одним значением, потому что меняется она
 * мгновенно: поворот экрана, а не ход клавиатуры. Дальше список сам ставит
 * распорку в конце контента, отодвигает индикатор скролла и якорь конечной
 * кромки, и разойтись им не на чем.
 *
 * @returns величина на UI-потоке; в JS она не нужна никому.
 */
export const useBottomInset = (): SharedValue<number> => {
  const insets = useSafeAreaInsets();
  const inset = useSharedValue(insets.bottom);

  useEffect(() => {
    inset.value = insets.bottom;
  }, [insets.bottom, inset]);

  return inset;
};
