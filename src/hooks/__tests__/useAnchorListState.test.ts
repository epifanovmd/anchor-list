import { act, createElement, useState } from "react";
import TestRenderer from "react-test-renderer";

import { AnchorListState, ListStore } from "../../model";
import { useAnchorListValue } from "../useAnchorListState";

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

/** Рендерит чтение значения и запоминает всё, что оно вернуло. */
const renderValue = <T>(read: () => T) => {
  const renders: T[] = [];
  let rerender = () => {};

  const Probe = () => {
    const [, setTick] = useState(0);

    rerender = () => setTick(tick => tick + 1);
    renders.push(read());

    return null;
  };

  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(createElement(Probe));
  });

  return { renders, renderer, rerender: () => act(() => rerender()) };
};

describe("useAnchorListValue", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("не знает значения, пока список не смонтирован", () => {
    const state = new AnchorListState();
    const { renders } = renderValue(() =>
      useAnchorListValue(state, "totalSize"),
    );

    expect(renders.at(-1)).toBeUndefined();
  });

  it("отдаёт значение появившегося списка", () => {
    const state = new AnchorListState();
    const store = new ListStore();

    store.set("totalSize", 4000);

    const { renders } = renderValue(() =>
      useAnchorListValue(state, "totalSize"),
    );

    act(() => {
      state.attach(store);
    });

    expect(renders.at(-1)).toBe(4000);
  });

  it("перерисовывает подписчика при изменении значения", () => {
    const state = new AnchorListState();
    const store = new ListStore();

    state.attach(store);

    const { renders } = renderValue(() =>
      useAnchorListValue(state, "isNearEnd"),
    );

    act(() => {
      store.set("isNearEnd", true);
    });

    expect(renders.at(-1)).toBe(true);
  });

  it("не перерисовывает подписчика из-за чужого значения", () => {
    const state = new AnchorListState();
    const store = new ListStore();

    state.attach(store);

    const { renders } = renderValue(() =>
      useAnchorListValue(state, "isNearEnd"),
    );
    const count = renders.length;

    act(() => {
      store.set("totalSize", 100);
    });

    // Подписка адресная: изменение любого другого состояния списка сюда не
    // доходит.
    expect(renders.length).toBe(count);
  });

  it("не заводит нового снимка на повторном рендере", () => {
    const state = new AnchorListState();
    const store = new ListStore();

    store.set("scrollSize", { width: 390, height: 500 });
    state.attach(store);

    const { renders, rerender } = renderValue(() =>
      useAnchorListValue(state, "scrollSize"),
    );

    rerender();

    // Снимок сравнивается по ссылке: новый объект на каждое чтение зациклил бы
    // рендер.
    expect(renders).toHaveLength(2);
    expect(renders[1]).toBe(renders[0]);
  });

  it("отписывается при размонтировании", () => {
    const state = new AnchorListState();
    const store = new ListStore();

    state.attach(store);

    const { renders, renderer } = renderValue(() =>
      useAnchorListValue(state, "totalSize"),
    );
    const count = renders.length;

    act(() => {
      renderer.unmount();
    });

    act(() => {
      store.set("totalSize", 900);
    });

    expect(renders.length).toBe(count);
  });
});
