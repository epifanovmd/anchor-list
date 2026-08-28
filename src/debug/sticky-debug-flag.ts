import type { SharedValue } from "react-native-reanimated";
import { makeMutable } from "react-native-reanimated";

import { anchorListStickyDebug } from "./sticky-debug";

let flag: SharedValue<boolean> | undefined;

/**
 * Тот же признак диагностики, но читаемый с UI-потока.
 *
 * Зачем отдельно: смещение прилипания считается в worklet, а он видит только
 * shared values — обычное поле объекта туда не доходит. Значение создаётся
 * лениво: модуль не должен ничего делать при импорте, иначе Reanimated
 * поднимался бы и там, где список не смонтирован.
 *
 * Живёт в отдельном файле от {@link anchorListStickyDebug} намеренно: тот
 * импортируют расчётные модули ядра, а им Reanimated не нужен вовсе.
 */
export const stickyDebugFlag = (): SharedValue<boolean> => {
  flag ??= makeMutable(anchorListStickyDebug.enabled);

  return flag;
};

/** Признак меняется сразу в обоих потоках. */
export const setStickyDebug = (value: boolean): void => {
  if (value) anchorListStickyDebug.enable();
  else anchorListStickyDebug.disable();

  stickyDebugFlag().value = value;
};
