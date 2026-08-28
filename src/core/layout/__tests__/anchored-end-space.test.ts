import { ListMetrics, ListStore } from "../../../model";
import type { IAnchorListAnchoredEndSpace } from "../../../types";
import { AnchoredEndSpace } from "../anchored-end-space";

const SCROLL_LENGTH = 500;

const createSpace = (
  config: IAnchorListAnchoredEndSpace | undefined,
  count = 10,
) => {
  const store = new ListStore();
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const state = { config, scrollLength: SCROLL_LENGTH };

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  const space = new AnchoredEndSpace({
    store,
    metrics,
    getConfig: () => state.config,
    getScrollLength: () => state.scrollLength,
  });

  return { store, metrics, space, state };
};

describe("AnchoredEndSpace", () => {
  it("молчит без конфигурации", () => {
    const { store, space } = createSpace(undefined);

    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(0);
  });

  it("резервирует место, чтобы якорь дошёл до верхней кромки", () => {
    const { store, space } = createSpace({ anchorIndex: 8 });

    space.update();

    // Под якорем 200 контента, вьюпорт 500 — не хватает 300.
    expect(store.peek("anchoredEndSpaceSize")).toBe(300);
  });

  it("ничего не резервирует, когда контента под якорем достаточно", () => {
    const { store, space } = createSpace({ anchorIndex: 2 });

    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(0);
  });

  it("учитывает отступ над якорем", () => {
    const { store, space } = createSpace({ anchorIndex: 8, anchorOffset: 80 });

    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(220);
  });

  it("не превышает объявленного предела", () => {
    const { store, space } = createSpace({ anchorIndex: 8, maxSize: 120 });

    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(120);
  });

  it("сообщает о новом размере", () => {
    const onSizeChanged = jest.fn();
    const { space } = createSpace({ anchorIndex: 8, onSizeChanged });

    space.update();

    expect(onSizeChanged).toHaveBeenCalledWith(300);

    // Размер не изменился — сообщать не о чем.
    space.update();
    expect(onSizeChanged).toHaveBeenCalledTimes(1);
  });

  it("пересчитывает распорку при смене размера вьюпорта", () => {
    const { store, space, state } = createSpace({ anchorIndex: 8 });

    space.update();
    state.scrollLength = 300;
    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(100);
  });

  it("молчит на несуществующем якоре", () => {
    const { store, space } = createSpace({ anchorIndex: 50 });

    space.update();

    expect(store.peek("anchoredEndSpaceSize")).toBe(0);
  });
});
