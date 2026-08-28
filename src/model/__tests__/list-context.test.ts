import type { ReactNode } from "react";
import { createElement } from "react";
import { act } from "react";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

import type {
  IAnchorListContextValue,
  IAnchorListRuntimeHandle,
} from "../list-context";
import {
  ListContextProvider,
  useListRuntime,
  useListScrollOffset,
  useListSticky,
  useListStore,
} from "../list-context";
import { ListStore } from "../list-store";

const createValue = (): IAnchorListContextValue => ({
  store: new ListStore(),
  runtime: {
    getItemAt: () => undefined,
    setItemSize: () => {},
    setContainerItemSize: () => {},
    isItemSizeFixed: () => false,
    isItemSizeKnown: () => false,
    getKnownItemSize: () => undefined,
    shouldRecycleItems: () => false,
    getStickyGeometry: () => undefined,
  } satisfies IAnchorListRuntimeHandle,
  scrollOffset: { value: 0 } as SharedValue<number>,
  stickyPinned: {
    start: { value: -1 } as SharedValue<number>,
    end: { value: -1 } as SharedValue<number>,
  },
  sticky: [{ edge: "start", indices: [0] }],
});

/** Рендерит хук и отдаёт то, что он вернул. */
const renderHook = <T>(
  useHook: () => T,
  value?: IAnchorListContextValue,
): T => {
  let result!: T;

  const Probe = () => {
    result = useHook();

    return null;
  };

  const tree: ReactNode = value
    ? createElement(ListContextProvider, { value }, createElement(Probe))
    : createElement(Probe);

  act(() => {
    TestRenderer.create(tree);
  });

  return result;
};

/** Флаг, по которому React считает окружение тестовым. */
interface IActEnvironment {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}

/** Рендерер предупреждает о своей устарелости — в выводе это лишний шум. */
const silenceRendererNotice = () => {
  const error = console.error;

  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;

    error(...args);
  });
};

describe("контекст списка", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("отдаёт стор дереву списка", () => {
    const value = createValue();

    expect(renderHook(useListStore, value)).toBe(value.store);
  });

  it("отдаёт расчётное ядро", () => {
    const value = createValue();

    expect(renderHook(useListRuntime, value)).toBe(value.runtime);
  });

  it("отдаёт смещение скролла на UI-потоке", () => {
    const value = createValue();

    expect(renderHook(useListScrollOffset, value)).toBe(value.scrollOffset);
  });

  it("отдаёт наборы прилипающих элементов", () => {
    const value = createValue();

    expect(renderHook(useListSticky, value)).toBe(value.sticky);
  });

  it("сообщает об отрисовке вне списка", () => {
    // React печатает разбор упавшего рендера — сам он тесту не интересен.
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(useListStore)).toThrow(
      "useListContext: компонент отрисован вне списка",
    );

    error.mockRestore();
    silenceRendererNotice();
  });
});
