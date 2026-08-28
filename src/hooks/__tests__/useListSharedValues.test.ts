import { act, createElement } from "react";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

import { ListStore } from "../../model";
import type { IAnchorListSharedValues } from "../../types";
import { useListSharedValues } from "../useListSharedValues";

/** В node-окружении shared value — обычный носитель значения. */
const sharedValue = <T>(value: T) => ({ value }) as SharedValue<T>;

const render = (
  store: ListStore,
  scrollOffset: SharedValue<number>,
  sharedValues: IAnchorListSharedValues | undefined,
) => {
  const Probe = () => {
    useListSharedValues(store, scrollOffset, sharedValues);

    return null;
  };

  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(createElement(Probe));
  });

  return renderer;
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

describe("useListSharedValues", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("ничего не делает без объявленных значений", () => {
    const store = new ListStore();

    expect(() => render(store, sharedValue(0), undefined)).not.toThrow();
  });

  it("отдаёт текущее состояние сразу при монтировании", () => {
    const store = new ListStore();
    const activeStickyStartIndex = sharedValue(-1);
    const maxScroll = sharedValue(0);

    store.set("activeStickyStartIndex", 4);
    store.set("maxScroll", 3700);

    render(store, sharedValue(0), { activeStickyStartIndex, maxScroll });

    expect(activeStickyStartIndex.value).toBe(4);
    expect(maxScroll.value).toBe(3700);
  });

  it("копирует смещение скролла напрямую", () => {
    const store = new ListStore();
    const scrollOffset = sharedValue(320);
    const target = sharedValue(0);

    // Оно уже живёт на UI-потоке — через стор его гонять незачем.
    render(store, scrollOffset, { scrollOffset: target });

    expect(target.value).toBe(320);
  });

  it("обновляет значения при изменении состояния списка", () => {
    const store = new ListStore();
    const activeStickyEndIndex = sharedValue(-1);

    render(store, sharedValue(0), { activeStickyEndIndex });

    act(() => {
      store.set("activeStickyEndIndex", 7);
    });

    expect(activeStickyEndIndex.value).toBe(7);
  });

  it("публикует всё, что список о себе знает", () => {
    const store = new ListStore();
    const targets = {
      velocity: sharedValue(0),
      totalSize: sharedValue(0),
      contentSize: sharedValue(0),
      maxScroll: sharedValue(0),
      scrollLength: sharedValue(0),
      scrollSize: sharedValue({ width: 0, height: 0 }),
      headerSize: sharedValue(0),
      footerSize: sharedValue(0),
      alignItemsAtEndPadding: sharedValue(0),
      anchoredEndSpaceSize: sharedValue(0),
      readyToRender: sharedValue(false),
      firstVisibleIndex: sharedValue(-1),
      lastVisibleIndex: sharedValue(-1),
      activeStickyStartIndex: sharedValue(-1),
      activeStickyEndIndex: sharedValue(-1),
    };

    render(store, sharedValue(0), targets);

    act(() => {
      store.set("velocity", 1.5);
      store.set("totalSize", 4000);
      store.set("contentSize", 4200);
      store.set("maxScroll", 3700);
      store.set("scrollLength", 500);
      store.set("scrollSize", { width: 390, height: 500 });
      store.set("headerSize", 60);
      store.set("footerSize", 40);
      store.set("alignItemsAtEndPadding", 12);
      store.set("anchoredEndSpaceSize", 24);
      store.set("readyToRender", true);
      store.set("firstVisibleIndex", 12);
      store.set("lastVisibleIndex", 17);
      store.set("activeStickyStartIndex", 4);
      store.set("activeStickyEndIndex", 9);
    });

    // Ни одно объявленное поле не должно остаться неподписанным: забытая связка
    // молча отдавала бы наружу стартовое значение.
    const published = Object.fromEntries(
      Object.entries(targets).map(([name, target]) => [name, target.value]),
    );

    expect(published).toEqual({
      velocity: 1.5,
      totalSize: 4000,
      contentSize: 4200,
      maxScroll: 3700,
      scrollLength: 500,
      scrollSize: { width: 390, height: 500 },
      headerSize: 60,
      footerSize: 40,
      alignItemsAtEndPadding: 12,
      anchoredEndSpaceSize: 24,
      readyToRender: true,
      firstVisibleIndex: 12,
      lastVisibleIndex: 17,
      activeStickyStartIndex: 4,
      activeStickyEndIndex: 9,
    });
  });

  it("обновляет только объявленные значения", () => {
    const store = new ListStore();
    const velocity = sharedValue(0);

    render(store, sharedValue(0), { velocity });

    act(() => {
      store.set("activeStickyStartIndex", 3);
      store.set("velocity", 2.5);
    });

    expect(velocity.value).toBe(2.5);
  });

  it("отписывается при размонтировании", () => {
    const store = new ListStore();
    const isNearEnd = sharedValue(false);
    const renderer = render(store, sharedValue(0), { isNearEnd });

    act(() => {
      renderer.unmount();
    });

    act(() => {});

    expect(isNearEnd.value).toBe(false);
  });
});
