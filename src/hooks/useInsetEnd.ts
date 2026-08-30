import { useMemo } from "react";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";

import { INSET_END_EPSILON, resolveInsetEnd } from "../core";
import {
  formatDebugValues,
  INSETS_FRAME_EVENT,
  INSETS_SETTLE_EVENT,
} from "../debug";
import { debugClock, debugFlag, logFromWorklet } from "../debug/debug-worklet";

/** Что нужно знать про низ списка, чтобы разложить его на UI-потоке. */
export interface IInsetEndOptions {
  /** Сколько низа вьюпорта занято не списком; меняется вместе с клавиатурой. */
  insetEnd: SharedValue<number> | undefined;
  /** Короткий контент прижимается к концу. */
  alignItemsAtEnd: boolean;
  /**
   * Размеры контента на UI-потоке — зеркала сигналов.
   *
   * Из них складывается высота контента без нижнего отступа. По замеру
   * `contentSize` её не взять: он приходит через JS и отстаёт на кадр-другой, а
   * решать по ней нужно в том же кадре, в котором сдвинулась клавиатура.
   */
  totalSize: SharedValue<number>;
  headerSize: SharedValue<number>;
  footerSize: SharedValue<number>;
  anchoredEndSpaceSize: SharedValue<number>;
  /** Размер вьюпорта вдоль оси скролла — зеркало того же сигнала. */
  scrollLength: SharedValue<number>;
  /** Измеренный размер контента: по нему видно, что нативная раскладка догнала. */
  contentSize: SharedValue<number>;
  /** Тот же `ScrollView`, что и у списка: сдвиг идёт на UI-потоке. */
  scrollRef: AnimatedRef<Animated.ScrollView>;
  /** Смещение скролла на UI-потоке. */
  scrollOffset: SharedValue<number>;
  /** Палец на экране и инерция после броска: тогда позицией управляет жест. */
  isDragging: SharedValue<boolean>;
  isMomentum: SharedValue<boolean>;
}

/** Низ списка на UI-потоке. */
export interface IInsetEnd {
  /** Сдвиг слоя контейнеров вниз: прижимает короткий контент к концу. */
  alignOffset: SharedValue<number>;
  /** Высота распорки в конце контента: отступ плюс запас на ход раскладки. */
  spacer: SharedValue<number>;
}

/**
 * Нижний отступ: распорка в конце контента, выравнивание короткого контента и
 * подъём смещения — всё от одной величины.
 *
 * Расчёт — в {@link resolveInsetEnd}; здесь только связь с кадрами и то, чего
 * чистая функция знать не может: успел ли нативный слой вырасти под новую
 * распорку.
 *
 * **Почему смещение копится своё.** Нативный `ScrollView` узнаёт о выросшей
 * распорке не в том же кадре, в котором её высоту записал worklet: раскладка
 * коммитится следом. Проси список сдвиг от того смещения, которое нативный слой
 * подтвердил, — каждый кадр терялся бы остаток, который тот обрезал, и к концу
 * анимации контент оставался бы ниже, чем должен. Поэтому список копит своё
 * значение и повторяет запрос, когда приходит новый размер контента: к этому
 * моменту место уже есть.
 */
export const useInsetEnd = ({
  insetEnd,
  alignItemsAtEnd,
  totalSize,
  headerSize,
  footerSize,
  anchoredEndSpaceSize,
  scrollLength,
  contentSize,
  scrollRef,
  scrollOffset,
  isDragging,
  isMomentum,
}: IInsetEndOptions): IInsetEnd => {
  const alignOffset = useSharedValue(0);
  const spacer = useSharedValue(0);
  /** Отступ, на котором посчитан прошлый кадр, и его тогдашняя дельта. */
  const appliedInset = useSharedValue(0);
  const appliedDelta = useSharedValue(0);
  /** Первый кадр прошёл: до него сдвигать не от чего. */
  const seeded = useSharedValue(false);
  /** Смещение, на котором список настаивает, и признак «нативный не подтвердил». */
  const desiredScroll = useSharedValue(0);
  const pending = useSharedValue(false);
  const debug = debugFlag("insets");
  const clock = debugClock();

  useAnimatedReaction(
    () => ({
      inset: insetEnd?.value ?? 0,
      base:
        totalSize.value +
        headerSize.value +
        footerSize.value +
        anchoredEndSpaceSize.value,
      length: scrollLength.value,
    }),
    ({ inset, base, length }) => {
      // До первой раскладки решать не о чем: вьюпорта ещё нет. Место под
      // отступ при этом отдаётся сразу — на нём стоит стартовая позиция.
      if (length <= 0) {
        spacer.value = inset;

        return;
      }

      // Отступ, на котором в последний раз считалось смещение: к концу хода
      // клавиатура идёт долями точки, и сбрасывать точку отсчёта на каждом
      // таком кадре — значит терять весь хвост движения.
      const previousInset = seeded.value ? appliedInset.value : inset;

      seeded.value = true;

      // Пока палец на экране или идёт инерция, позицией управляет жест, и
      // накопленное смещение к ней уже не относится.
      const owned = isDragging.value || isMomentum.value;
      const from =
        pending.value && !owned ? desiredScroll.value : scrollOffset.value;

      const layout = resolveInsetEnd({
        scroll: from,
        previousInset,
        previousDelta: appliedDelta.value,
        insetEnd: inset,
        baseHeight: base,
        scrollLength: length,
        alignItemsAtEnd,
      });

      alignOffset.value = layout.alignOffset;
      spacer.value = layout.spacer;

      if (debug.value) {
        logFromWorklet({
          clock,
          channel: "insets",
          event: INSETS_FRAME_EVENT,
          key: "",
          values: formatDebugValues({
            inset,
            delta: inset - previousInset,
            spacer: layout.spacer,
            align: layout.alignOffset,
            from,
            to: layout.scroll,
            owned,
          }),
        });
      }

      // Отступ не менялся — смещение не наше дело. Кадр приходит и от роста
      // элементов: тронуть скролл на нём значило бы уводить список от каждого
      // нового сообщения и от каждого замера строки.
      if (Math.abs(inset - previousInset) < INSET_END_EPSILON) return;

      appliedDelta.value = inset - previousInset;
      appliedInset.value = inset;
      desiredScroll.value = layout.scroll;
      pending.value =
        !owned &&
        Math.abs(layout.scroll - scrollOffset.value) >= INSET_END_EPSILON;

      if (!pending.value) return;

      scrollTo(scrollRef, 0, layout.scroll, false);
    },
  );

  // Пришёл новый размер контента — значит нативная раскладка догнала распорку.
  // Здесь и добирается остаток, который нативный слой обрезал по прежнему
  // размеру: без этого контент к концу анимации остаётся ниже, чем должен.
  useAnimatedReaction(
    () => contentSize.value,
    () => {
      if (!pending.value) return;
      if (isDragging.value || isMomentum.value) {
        pending.value = false;

        return;
      }

      if (
        Math.abs(desiredScroll.value - scrollOffset.value) < INSET_END_EPSILON
      ) {
        pending.value = false;

        return;
      }

      const room = contentSize.value - scrollLength.value;
      const applied = room >= desiredScroll.value - INSET_END_EPSILON;

      if (debug.value) {
        logFromWorklet({
          clock,
          channel: "insets",
          event: INSETS_SETTLE_EVENT,
          key: "",
          values: formatDebugValues({
            desired: desiredScroll.value,
            live: scrollOffset.value,
            content: contentSize.value,
            room,
            applied,
          }),
        });
      }

      // Место ещё не появилось: замер меньше, чем нужно под запрошенное
      // смещение. Повторять сейчас незачем — нативный слой обрежет так же, как
      // обрезал в тот раз, и это лишний вызов на каждый кадр клавиатуры.
      if (!applied) return;

      scrollTo(scrollRef, 0, desiredScroll.value, false);
    },
  );

  // Жест забирает позицию себе: накопленное смещение к ней больше не относится.
  useAnimatedReaction(
    () => isDragging.value || isMomentum.value,
    owned => {
      if (owned) pending.value = false;
    },
  );

  return useMemo(() => ({ alignOffset, spacer }), [alignOffset, spacer]);
};
