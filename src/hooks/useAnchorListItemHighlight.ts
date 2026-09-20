import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SharedValue } from "react-native-reanimated";
import {
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { IAnchorListHighlightState } from "../model";
import { useListItemKey, useListStore } from "../model";

/** Что хук отдаёт строке. */
export interface IAnchorListItemHighlight {
  /**
   * Строка подсвечена — для стилей в React.
   *
   * Меняется дважды на подсветку: загорелась, догорела. Для анимации без
   * рендеров есть {@link progress}.
   */
  isHighlighted: boolean;
  /**
   * Прогресс подсветки на UI-потоке: 0 — нет, 1 — горит целиком.
   *
   * Поднимается за `fade`, держится `duration`, опускается за `fade` — те
   * длительности, что переданы в `highlight` при переходе. Применяется через
   * `useAnimatedStyle`: фон, рамка, масштаб — что угодно.
   */
  progress: SharedValue<number>;
}

/**
 * Подсветка строки после перехода к ней — со стороны самой строки.
 *
 * Зачем нужен: список знает, когда подсветить и на сколько, а как — знает
 * только строка. Хук отдаёт ей момент и прогресс, а рисует подсветку она
 * сама: жёлтым фоном, рамкой, лёгким масштабом — чем угодно, что подходит её
 * дизайну.
 *
 * Подписка адресная: сигнал подсветки один на список, но строка сверяет его
 * ключ со своим и просыпается только на свою подсветку. Смена ключа под тем
 * же контейнером гасит подсветку: она адресована строке, а не месту.
 *
 * Вызывать можно только внутри компонента, который вернул `renderItem`, как и
 * `useAnchorListItemState`.
 */
export const useAnchorListItemHighlight = (): IAnchorListItemHighlight => {
  const itemKey = useListItemKey();

  if (itemKey === null) {
    throw new Error(
      "useAnchorListItemHighlight: хук вызван вне ячейки списка. Он работает " +
        "внутри компонента, который вернул renderItem.",
    );
  }

  const store = useListStore();

  // Снимок — сам объект сигнала, если он про эту строку, иначе null: чужая
  // подсветка снимка не меняет и рендера не вызывает. Повторная подсветка той
  // же строки — новый объект, и по нему эффект заводится заново.
  const state = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => store.listen("highlight", onChange),
      [store],
    ),
    (): IAnchorListHighlightState | null => {
      const current = store.peek("highlight");

      return current && current.key === itemKey ? current : null;
    },
  );

  const progress = useSharedValue(0);
  const [isHighlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (state === null) {
      // Снятие раньше срока или перепривязка контейнера: гаснем плавно, но
      // от текущего значения, а не с полной яркости.
      progress.value = withTiming(0, { duration: DEFAULT_RELEASE_MS });
      setHighlighted(false);

      return;
    }

    const { duration, fade } = state;

    setHighlighted(true);
    progress.value = withSequence(
      withTiming(1, { duration: fade }),
      withDelay(duration, withTiming(0, { duration: fade })),
    );

    // JS-флаг гаснет по тем же часам, что и прогресс: колбэк анимации с
    // UI-потока пришёл бы на кадр позже и стоил бы перехода между потоками.
    const timer = setTimeout(
      () => setHighlighted(false),
      fade + duration + fade,
    );

    return () => clearTimeout(timer);
  }, [state, progress]);

  return { isHighlighted, progress };
};

/** Угасание при снятии подсветки раньше срока, мс. */
const DEFAULT_RELEASE_MS = 150;
