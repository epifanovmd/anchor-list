import { useCallback, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import type {
  AnimatedRef,
  AnimatedStyle,
  SharedValue,
} from "react-native-reanimated";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
} from "react-native-reanimated";

/** Меньшую разницу раскладка не двигает — реагировать на неё незачем. */
const EPSILON = 0.5;

/** Что нужно подключить к списку, чтобы контент ехал вместе с клавиатурой. */
export interface IScrollCompensation {
  /** Ref нижележащего `ScrollView` — на него уходит `scrollTo` с UI-потока. */
  scrollRef: AnimatedRef<Animated.ScrollView>;
  /** Стиль распорки в конце контента. */
  spacerStyle: AnimatedStyle<{ height: number }>;
  /**
   * Высота той же распорки числом — нижний отступ контента.
   *
   * Отдаётся списку пропом `insetEnd`: индикатор скролла и якорь конечной
   * кромки живут вне координат контента и о распорке не знают.
   */
  contentInset: SharedValue<number>;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  /**
   * Обязательны к подключению: пока палец на экране, позицией управляет жест, и
   * компенсация обязана в неё не вмешиваться.
   */
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
}

/**
 * Распорка в конце контента и подъём скролла на ту же дельту.
 *
 * Зачем нужна: одной распорки мало. Она добавляется **в конец** контента, а
 * удержание позиции компенсирует только изменения выше вьюпорта — видимые
 * строки от неё не двигаются, и последняя остаётся там же, просто под ней
 * появляется место. Чтобы контент поднялся вместе с клавиатурой, смещение
 * сдвигается явно, и делается это на UI-потоке: через JS сдвиг опоздал бы на
 * кадр и был бы виден рывком.
 *
 * Распорка входит в размер контента, поэтому `scrollToEnd` и автоприлипание к
 * концу считаются без поправок.
 *
 * @param bottomInset сколько низа вьюпорта занято прямо сейчас.
 * @param reservedInset зона, под которую место резервируется **сразу**, по
 *   целевой высоте. Высота распорки проходит через раскладку, а размер контента
 *   отстаёт на кадр: без резерва у самого низа списка `scrollTo` упирается в
 *   ещё не выросший диапазон, сдвиг обрезается — и компенсация теряется ровно
 *   там, где нужнее всего.
 */
export const useKeyboardScrollCompensation = (
  bottomInset: SharedValue<number>,
  reservedInset?: SharedValue<number>,
): IScrollCompensation => {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // Начальное значение: нулевая дельта не должна двигать контент на старте.
  const appliedInset = useSharedValue(bottomInset.value);
  const spacerHeight = useSharedValue(bottomInset.value);
  const isUserDragging = useSharedValue(false);
  /** Список стоял у конца — после коммита распорки его нужно туда довести. */
  const pendingEndPin = useSharedValue(false);

  // Позиция берётся у самого скролла: дельты обязаны складываться от реальной.
  const scrollY = useScrollViewOffset(scrollRef);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  useAnimatedReaction(
    () => bottomInset.value,
    target => {
      const applied = appliedInset.value;
      const delta = target - applied;

      if (Math.abs(delta) < EPSILON) return;

      const reserve = reservedInset?.value ?? 0;
      const previousSpacer = Math.max(applied, reserve);

      appliedInset.value = target;
      spacerHeight.value = Math.max(target, reserve);

      if (isUserDragging.value) return;
      if (contentHeight.value <= 0 || viewportHeight.value <= 0) return;

      // Конец контента считается сам: замер `contentSize` придёт только на
      // следующем кадре, а сдвинуть нужно уже сейчас.
      const contentEnd =
        contentHeight.value - previousSpacer + spacerHeight.value;
      const maxOffset = contentEnd - viewportHeight.value;

      if (maxOffset <= 0) return;

      const next = Math.min(Math.max(scrollY.value + delta, 0), maxOffset);

      pendingEndPin.value = next >= maxOffset - EPSILON;

      scrollY.value = next;
      scrollTo(scrollRef, 0, next, false);
    },
  );

  // Досыл до конца, когда пришёл настоящий размер контента: расчётный мог
  // разойтись с ним на доли пикселя, а у самого низа это заметно.
  useAnimatedReaction(
    () => contentHeight.value,
    height => {
      if (!pendingEndPin.value || isUserDragging.value) return;

      pendingEndPin.value = false;

      const maxOffset = height - viewportHeight.value;

      if (maxOffset <= 0) return;
      if (scrollY.value >= maxOffset - EPSILON) return;

      scrollY.value = maxOffset;
      scrollTo(scrollRef, 0, maxOffset, false);
    },
  );

  // Резерв применяется и сам по себе: цель известна до первого кадра движения.
  useAnimatedReaction(
    () => Math.max(appliedInset.value, reservedInset?.value ?? 0),
    height => {
      if (Math.abs(height - spacerHeight.value) < EPSILON) return;

      spacerHeight.value = height;
    },
  );

  const spacerStyle = useAnimatedStyle(() => ({ height: spacerHeight.value }));

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.value = event.nativeEvent.layout.height;
    },
    [viewportHeight],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.value = height;
    },
    [contentHeight],
  );

  const onScrollBeginDrag = useCallback(() => {
    isUserDragging.value = true;
    pendingEndPin.value = false;
  }, [isUserDragging, pendingEndPin]);

  const onScrollEndDrag = useCallback(() => {
    isUserDragging.value = false;
  }, [isUserDragging]);

  return useMemo(
    () => ({
      scrollRef,
      spacerStyle,
      contentInset: spacerHeight,
      onLayout,
      onContentSizeChange,
      onScrollBeginDrag,
      onScrollEndDrag,
    }),
    [
      scrollRef,
      spacerStyle,
      spacerHeight,
      onLayout,
      onContentSizeChange,
      onScrollBeginDrag,
      onScrollEndDrag,
    ],
  );
};
