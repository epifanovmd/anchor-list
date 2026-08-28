import { useEffect } from "react";
import type { SharedValue } from "react-native-reanimated";

import type {
  AnchorListSignalMap,
  AnchorListSignalName,
  ListStore,
} from "../model";
import type { IAnchorListSharedValues } from "../types";

/**
 * Значения, которые список отдаёт не из стора.
 *
 * Смещение скролла и фаза жеста живут только на UI-потоке: они меняются на
 * каждом кадре, и гонять их через стор значило бы гонять их через JS.
 *
 * Расстояния до кромок и флаги — там же, но по другой причине: они выводятся из
 * смещения, и считает их {@link useEdgeSharedValues} покадрово. Писатель у
 * значения обязан быть один: зеркало из стора приходило бы следом за отставшим
 * проходом JS и возвращало значение на кадр назад — на экране это мигание.
 */
type DirectName =
  | "scrollOffset"
  | "isDragging"
  | "isMomentum"
  | "distanceFromStart"
  | "distanceFromEnd"
  | "isAtStart"
  | "isAtEnd"
  | "isNearStart"
  | "isNearEnd"
  | "isWithinMaintainScrollAtEndThreshold";

/** Публикуемые значения, у которых есть сигнал-источник в сторе. */
type MirroredName = Exclude<keyof IAnchorListSharedValues, DirectName>;

/**
 * Сигнал стора для каждого публикуемого значения.
 *
 * Тип `Record` обязывает перечислить их все: добавить поле в
 * {@link IAnchorListSharedValues} и забыть о публикации не выйдет — не соберётся.
 */
const SIGNAL_OF: Record<MirroredName, AnchorListSignalName> = {
  velocity: "velocity",
  totalSize: "totalSize",
  contentSize: "contentSize",
  maxScroll: "maxScroll",
  scrollLength: "scrollLength",
  scrollSize: "scrollSize",
  headerSize: "headerSize",
  footerSize: "footerSize",
  alignItemsAtEndPadding: "alignItemsAtEndPadding",
  anchoredEndSpaceSize: "anchoredEndSpaceSize",
  readyToRender: "readyToRender",
  firstVisibleIndex: "firstVisibleIndex",
  lastVisibleIndex: "lastVisibleIndex",
  activeStickyStartIndex: "activeStickyStartIndex",
  activeStickyEndIndex: "activeStickyEndIndex",
};

const MIRRORED_NAMES = Object.keys(SIGNAL_OF) as MirroredName[];

/** Значение из стора отдаётся как есть; несуществующее — не отдаётся вовсе. */
const write = (
  target: SharedValue<unknown> | undefined,
  value: unknown,
): void => {
  if (!target || value === undefined) return;

  target.value = value;
};

/**
 * Публикация состояния списка в shared values вызывающего кода.
 *
 * Зачем нужна: тем, кто строит анимации поверх списка, состояние нужно на
 * UI-потоке, а не через рендер. Кнопка «вниз», тень под навбаром, свой
 * скроллбар, пузырь с датой — всё это обязано двигаться в такт со скроллом, а
 * не через кадр после него.
 *
 * Какую проблему решает: подписка заводится только на то, что вызывающий
 * действительно попросил. Незаполненное поле не стоит ни подписки, ни записи —
 * поэтому список может отдавать наружу всё, что знает, ничего за это не платя.
 */
export const useListSharedValues = (
  store: ListStore,
  scrollOffset: SharedValue<number>,
  sharedValues: IAnchorListSharedValues | undefined,
): void => {
  useEffect(() => {
    if (!sharedValues) return;

    // Стартовое значение: дальше смещение пишет worklet скролла напрямую, но до
    // первого его события наружу ушёл бы ноль — а список мог открыться уже
    // прокрученным (`initialScroll`).
    if (sharedValues.scrollOffset) {
      sharedValues.scrollOffset.value = scrollOffset.value;
    }

    const unsubscribes: (() => void)[] = [];

    for (const name of MIRRORED_NAMES) {
      const target = sharedValues[name] as SharedValue<unknown> | undefined;

      if (!target) continue;

      const signal = SIGNAL_OF[name];

      write(target, store.peek(signal));
      unsubscribes.push(
        store.listen(signal, (value: AnchorListSignalMap[typeof signal]) =>
          write(target, value),
        ),
      );
    }

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [store, scrollOffset, sharedValues]);
};
