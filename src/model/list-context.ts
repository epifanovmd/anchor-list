import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

import type { IAnchorListStickyConfig } from "../types";
import type { ListStore } from "./list-store";

/** Расчётное ядро, доступное дереву списка. Тип элемента здесь не важен. */
export interface IAnchorListRuntimeHandle {
  /** Элемент данных по индексу; undefined — индекс вне данных. */
  getItemAt: (index: number) => unknown;
  /** Ключ элемента по индексу; undefined — индекс вне данных. */
  getItemKeyAt: (index: number) => string | undefined;
  /** Принять замер строки по ключу. */
  setItemSize: (key: string, size: number) => void;
  /** Принять замер, только пока контейнер всё ещё рисует указанный ключ. */
  setContainerItemSize: (id: number, key: string, size: number) => void;
  /** Фиксированный размер не требует `onLayout` и повторных измерений. */
  isItemSizeFixed: (key: string) => boolean;
  /** Размер известен точно — повторный замер той же строки ничего не уточнит. */
  isItemSizeKnown: (key: string) => boolean;
  /** Точно известный размер элемента; undefined — есть только оценка. */
  getKnownItemSize: (key: string) => number | undefined;
  /** Перерабатывать нативное поддерево ячейки между элементами одного типа. */
  shouldRecycleItems: () => boolean;
  /** Геометрия якоря в координатах элементов; undefined — индекса нет. */
  getStickyGeometry: (index: number) => IAnchorListStickyGeometry | undefined;
}

/** Что нужно знать о якоре слою прилипших копий. */
export interface IAnchorListStickyGeometry {
  /** Позиция в координатах элементов — тех же, в которых считается прилипание. */
  position: number;
  size: number;
  /** Предел смещения; см. `getStickyLimitOf`. */
  limit: number | undefined;
}

/** Всё, что список отдаёт своему дереву. */
export interface IAnchorListContextValue {
  /** Адресные сигналы: через них ядро говорит с контейнерами. */
  store: ListStore;
  /** Расчётное ядро — то немногое из него, что нужно дереву. */
  runtime: IAnchorListRuntimeHandle;
  /** Смещение скролла на UI-потоке — прилипание считается из него. */
  scrollOffset: SharedValue<number>;
  /** Наборы прилипающих элементов, объявленные списком. */
  sticky: IAnchorListStickyConfig[];
  /** Якоря, уже отрисованные слоем прилипших копий. */
  stickyPinned: IAnchorListStickyPinnedIndices;
}

/**
 * Индекс якоря, который слой действительно нарисовал, по кромкам.
 *
 * Зачем нужен: копия внутри контента обязана прятаться не тогда, когда якорь
 * доехал до кромки, а тогда, когда его уже рисует слой. Слой узнаёт о новом
 * якоре из рендера, то есть на коммит позже, и без этой сверки на стыке
 * оставался бы кадр, где не нарисован ни один из двух.
 */
export interface IAnchorListStickyPinnedIndices {
  start: SharedValue<number>;
  end: SharedValue<number>;
}

const ListContext = createContext<IAnchorListContextValue | null>(null);

/** Раздаёт дереву стор, ядро и общие shared values списка. */
export const ListContextProvider = ListContext.Provider;

const useListContext = (): IAnchorListContextValue => {
  const value = useContext(ListContext);

  if (!value) {
    throw new Error("useListContext: компонент отрисован вне списка");
  }

  return value;
};

/** Стор сигналов текущего списка. */
export const useListStore = (): ListStore => useListContext().store;

/** Расчётное ядро текущего списка. */
export const useListRuntime = (): IAnchorListRuntimeHandle =>
  useListContext().runtime;

/** Смещение скролла на UI-потоке. */
export const useListScrollOffset = (): SharedValue<number> =>
  useListContext().scrollOffset;

/** Наборы прилипающих элементов, объявленные списком. */
export const useListSticky = (): IAnchorListStickyConfig[] =>
  useListContext().sticky;

/** Якоря, уже отрисованные слоем прилипших копий; см. {@link IAnchorListStickyPinnedIndices}. */
export const useListStickyPinned = (): IAnchorListStickyPinnedIndices =>
  useListContext().stickyPinned;
