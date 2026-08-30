import type { SharedValue } from "react-native-reanimated";
import { makeMutable } from "react-native-reanimated";

import { formatDebugLine } from "./debug-format";
import type { AnchorListDebugChannel } from "./debug-registry";
import { debugRegistry } from "./debug-registry";

/** Признаки каналов на UI-потоке: заводятся лениво, по одному на канал. */
const flags = new Map<AnchorListDebugChannel, SharedValue<boolean>>();

/** Общее начало шкалы времени на UI-потоке. */
let clock: SharedValue<number> | undefined;

/**
 * Признак канала, читаемый с UI-потока.
 *
 * Зачем отдельно от реестра: прилипание и нижний отступ считаются в worklet-ах,
 * а те видят только shared values — обычное поле объекта туда не доходит.
 * Значение заводится лениво: модуль не должен поднимать Reanimated при импорте,
 * иначе он поднимался бы и там, где список не смонтирован.
 */
export const debugFlag = (
  channel: AnchorListDebugChannel,
): SharedValue<boolean> => {
  let flag = flags.get(channel);

  if (!flag) {
    flag = makeMutable(false);
    flags.set(channel, flag);
    debugRegistry.setFlag(channel, flag);
  }

  return flag;
};

/** Начало шкалы времени для worklet-ов: та же нулевая отметка, что и в JS. */
export const debugClock = (): SharedValue<number> => {
  if (!clock) {
    clock = makeMutable(0);
    debugRegistry.setClock(clock);
  }

  return clock;
};

/** Из чего складывается строка, печатаемая с UI-потока. */
export interface IWorkletLogParams {
  /** Начало шкалы: {@link debugClock}, переданный в worklet замыканием. */
  clock: SharedValue<number>;
  channel: AnchorListDebugChannel;
  event: string;
  key: string;
  problem?: boolean;
  /** Величины: собираются вызывающим, порядок — порядок объявления. */
  values: string;
}

/**
 * Печать с UI-потока.
 *
 * Формат совпадает с {@link formatDebugLine} до колонки: логи двух потоков
 * читаются одним списком, иначе расхождение JS и UI — а именно оно и есть
 * причина большинства проблем прилипания — по ним не восстанавливается.
 *
 * Отсечение повторов здесь на вызывающем: состояние worklet-а живёт в shared
 * values, и общего для двух потоков реестра ему не видно.
 */
export const logFromWorklet = ({
  clock: startedAt,
  channel,
  event,
  key,
  problem = false,
  values,
}: IWorkletLogParams): void => {
  "worklet";

  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  console.log(
    formatDebugLine({
      elapsed: (now - startedAt.value) / 1000,
      channel,
      event,
      key,
      problem,
      values,
    }),
  );
};
