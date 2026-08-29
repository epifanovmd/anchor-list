import { useEffect, useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "./useKeyboardHeight";

/** Из чего складывается нижнее перекрытие экрана. */
export interface IKeyboardInsetOptions {
  /** Высота панели ввода без безопасной зоны под ней. */
  barHeight: SharedValue<number>;
  /** Что добавить сверх панели и зоны: зазор, тень, что угодно своё. */
  extraPadding?: number;
  /**
   * Компенсация включена; по умолчанию да.
   *
   * Выключенная замораживает перекрытие на закрытом положении: список тогда не
   * узнаёт о клавиатуре, и видно, как контент уходит под неё. В приложении тем
   * же способом отступ придерживают, пока поле ввода потеряло фокус, — иначе
   * закрывшаяся клавиатура дёргает раскладку под всплывающей панелью.
   */
  enabled?: boolean;
}

/** Нижнее перекрытие экрана: одно значение на всех, кто до него дотягивается. */
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
  /** Перекрытие при закрытой клавиатуре: панель плюс безопасная зона. */
  closedInset: SharedValue<number>;
  /** Полное перекрытие — оно и уходит списку в `insetEnd`. */
  contentInset: SharedValue<number>;
}

/**
 * Единственная подписка на клавиатуру на экран.
 *
 * Отсюда перекрытие берут все, кто до низа дотягивается: список пропом
 * `insetEnd`, панель ввода, кнопка возврата. Считать «сколько занято снизу»
 * каждому самостоятельно — значит получить столько же расходящихся ответов, а
 * расхождение видно глазом.
 *
 * Всё живёт на UI-потоке: клавиатура едет покадрово, и через рендер значения
 * отставали бы на кадр.
 */
export const useKeyboardInset = ({
  barHeight,
  extraPadding = 0,
  enabled = true,
}: IKeyboardInsetOptions): IKeyboardInset => {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  // Признак на UI-потоке: перекрытие считается в worklet, и обычное поле
  // объекта туда не доходит.
  const isEnabled = useSharedValue(enabled);

  useEffect(() => {
    isEnabled.value = enabled;
  }, [enabled, isEnabled]);

  const occludedBottom = useDerivedValue(() =>
    Math.max(keyboardHeight.value, safeAreaBottom),
  );

  const closedInset = useDerivedValue(
    () => safeAreaBottom + barHeight.value + extraPadding,
  );

  const liveInset = useDerivedValue(
    () => occludedBottom.value + barHeight.value + extraPadding,
  );

  const contentInset = useDerivedValue(() =>
    isEnabled.value ? liveInset.value : closedInset.value,
  );

  return useMemo(
    () => ({ occludedBottom, keyboardHeight, closedInset, contentInset }),
    [occludedBottom, keyboardHeight, closedInset, contentInset],
  );
};
