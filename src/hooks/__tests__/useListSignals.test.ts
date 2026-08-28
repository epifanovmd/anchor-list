import { act, createElement, useState } from "react";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

import type { IAnchorListContextValue } from "../../model";
import { ListContextProvider, ListStore } from "../../model";
import { useListSignal, useListSignals } from "../useListSignals";

const createValue = (store: ListStore): IAnchorListContextValue => ({
  store,
  runtime: {
    getItemAt: () => undefined,
    getItemKeyAt: () => undefined,
    setItemSize: () => {},
    setContainerItemSize: () => {},
    isItemSizeFixed: () => false,
    isItemSizeKnown: () => false,
    getKnownItemSize: () => undefined,
    shouldRecycleItems: () => false,
    getStickyGeometry: () => undefined,
  },
  scrollOffset: { value: 0 } as SharedValue<number>,
  stickyPinned: {
    start: { value: -1 } as SharedValue<number>,
    end: { value: -1 } as SharedValue<number>,
  },
  sticky: [],
});

/** Рендерит хук внутри списка и запоминает всё, что он вернул. */
const renderSignals = <T>(store: ListStore, useHook: () => T) => {
  const renders: T[] = [];
  let rerender = () => {};

  // Своё состояние — чтобы вызвать перерисовку, не трогая ни стор, ни контекст.
  const Probe = () => {
    const [, setTick] = useState(0);

    rerender = () => setTick(tick => tick + 1);
    renders.push(useHook());

    return null;
  };

  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      createElement(
        ListContextProvider,
        { value: createValue(store) },
        createElement(Probe),
      ),
    );
  });

  return { renders, renderer, rerender: () => act(() => rerender()) };
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

describe("useListSignals", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("отдаёт текущие значения сигналов", () => {
    const store = new ListStore();

    store.set("containerPosition0", 300);
    store.set("containerItemKey0", "k3");

    const { renders } = renderSignals(store, () =>
      useListSignals(["containerPosition0", "containerItemKey0"] as const),
    );

    expect(renders.at(-1)).toEqual([300, "k3"]);
  });

  it("отдаёт undefined у сигнала без значения", () => {
    const store = new ListStore();

    const { renders } = renderSignals(store, () =>
      useListSignals(["containerPosition7"] as const),
    );

    expect(renders.at(-1)).toEqual([undefined]);
  });

  it("перерисовывает подписчика при изменении сигнала", () => {
    const store = new ListStore();
    const { renders } = renderSignals(store, () =>
      useListSignals(["containerPosition0"] as const),
    );

    act(() => {
      store.set("containerPosition0", 500);
    });

    expect(renders.at(-1)).toEqual([500]);
  });

  it("не перерисовывает подписчика из-за чужого сигнала", () => {
    const store = new ListStore();
    const { renders } = renderSignals(store, () =>
      useListSignals(["containerPosition0"] as const),
    );
    const count = renders.length;

    act(() => {
      store.set("containerPosition1", 500);
    });

    // Смещение одной строки не должно перерисовывать остальные.
    expect(renders.length).toBe(count);
  });

  it("сохраняет ссылку на снимок, пока значения те же", () => {
    const store = new ListStore();

    store.set("containerPosition0", 300);

    const { renders, rerender } = renderSignals(store, () =>
      useListSignals(["containerPosition0"] as const),
    );

    rerender();

    // useSyncExternalStore сравнивает снимки по ссылке: новый массив на каждом
    // чтении зациклил бы рендер.
    expect(renders).toHaveLength(2);
    expect(renders[1]).toBe(renders[0]);
  });

  it("отписывается при размонтировании", () => {
    const store = new ListStore();
    const { renders, renderer } = renderSignals(store, () =>
      useListSignals(["containerPosition0"] as const),
    );
    const count = renders.length;

    act(() => {
      renderer.unmount();
    });

    act(() => {
      store.set("containerPosition0", 900);
    });

    expect(renders.length).toBe(count);
  });
});

describe("useListSignal", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("подписывается на один сигнал", () => {
    const store = new ListStore();

    store.set("totalSize", 1200);

    const { renders } = renderSignals(store, () => useListSignal("totalSize"));

    expect(renders.at(-1)).toBe(1200);

    act(() => {
      store.set("totalSize", 1500);
    });

    expect(renders.at(-1)).toBe(1500);
  });
});
