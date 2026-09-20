import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { getItemVisibility } from "../core/viewability/item-visibility";
import {
  useListItemFrame,
  useListItemKey,
  useListLayoutValues,
  useListScrollOffset,
} from "../model";

/**
 * Доля строки во вьюпорте как shared value: от 0 до 1, на UI-потоке.
 *
 * Зачем нужен: параллакс, затухание у кромок, автовоспроизведение и отметка
 * «прочитано» хотят знать, насколько строка на экране, — каждым кадром и без
 * рендера. `viewabilityPairs` для этого не годятся: они отвечают «да/нет» по
 * порогу и приходят из JS шагами.
 *
 * Что учитывается: живое смещение скролла, шапка списка, нижний отступ
 * `insetEnd` — строка под панелью ввода или клавиатурой не видна, хотя и
 * лежит внутри `ScrollView`, — сдвиг прилипшего якоря и прижатие короткого
 * контента к концу. Считается доля самой строки, а не вьюпорта.
 *
 * Цена: один worklet на строку, где хук вызван. Заводить его на каждой строке
 * большого списка стоит мапперов на каждый кадр — вызывайте там, где эффект
 * действительно нужен.
 *
 * Вызывать можно только внутри компонента, который вернул `renderItem`, как и
 * `useAnchorListItemState`: при переработке контейнера значение само
 * переключается на новую строку.
 */
export const useAnchorListItemVisibility = (): SharedValue<number> => {
  const itemKey = useListItemKey();
  const frame = useListItemFrame();

  if (itemKey === null || frame === null) {
    throw new Error(
      "useAnchorListItemVisibility: хук вызван вне ячейки списка. Он работает " +
        "внутри компонента, который вернул renderItem.",
    );
  }

  const scrollOffset = useListScrollOffset();
  const { scrollLength, contentOrigin, insetEnd, alignOffset } =
    useListLayoutValues();
  const { position, size, shift } = frame;

  return useDerivedValue(() =>
    getItemVisibility({
      position,
      size,
      scroll: scrollOffset.value,
      contentOrigin: contentOrigin.value,
      scrollLength: scrollLength.value,
      insetEnd: insetEnd?.value ?? 0,
      shift: (shift?.value ?? 0) + alignOffset.value,
    }),
  );
};
