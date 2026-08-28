import type { ReactElement } from "react";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Нижний отступ экрана — одинаковый для всех, кто до него дотягивается. */
export interface IBottomInset {
  /** Распорка в подвал списка: контент кончается над домашним индикатором. */
  footer: ReactElement;
  /** То же значение на UI-потоке — для пропа `insetEnd`. */
  inset: SharedValue<number>;
}

/**
 * Безопасная зона снизу для экранов без панели ввода.
 *
 * Зачем нужен: контенту место снизу отдаётся распоркой, а индикатор скролла
 * живёт в координатах `ScrollView` и о ней не знает — без явного отступа iOS
 * добавляет ему свою безопасную зону сам, и он кончается не там, где контент.
 * Обе величины берутся отсюда, поэтому разойтись не могут; туда же смотрит и
 * якорь конечной кромки, если на экране есть прилипание.
 */
export const useBottomInset = (): IBottomInset => {
  const insets = useSafeAreaInsets();
  const inset = useSharedValue(insets.bottom);

  useEffect(() => {
    inset.value = insets.bottom;
  }, [insets.bottom, inset]);

  const footer = useMemo(
    () => <View style={{ height: insets.bottom }} pointerEvents={"none"} />,
    [insets.bottom],
  );

  return { footer, inset };
};
