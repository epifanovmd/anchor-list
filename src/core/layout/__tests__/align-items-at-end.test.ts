import { ListMetrics, ListStore } from "../../../model";
import { AlignItemsAtEnd } from "../align-items-at-end";

const SCROLL_LENGTH = 500;

const createAlign = (count = 2, enabled = true) => {
  const store = new ListStore();
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const state = { count, enabled, scrollLength: SCROLL_LENGTH };

  const setCount = (next: number) => {
    const keys = Array.from({ length: next }, (_, index) => `k${index}`);

    metrics.setItems(
      keys,
      keys.map(() => ""),
    );
  };

  setCount(count);

  const align = new AlignItemsAtEnd({
    store,
    metrics,
    isEnabled: () => state.enabled,
    getScrollLength: () => state.scrollLength,
  });

  return { store, metrics, align, state, setCount };
};

describe("AlignItemsAtEnd", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("молчит, пока проп не задан", () => {
    const { store, align } = createAlign(2, false);

    align.update();

    expect(store.peek("alignItemsAtEndPadding")).toBe(0);
  });

  it("добирает распоркой недостающую высоту", () => {
    const { store, align } = createAlign(2);

    align.update();

    // 200 контента при вьюпорте 500: первые сообщения обязаны стоять внизу.
    expect(store.peek("alignItemsAtEndPadding")).toBe(300);
  });

  it("убирает распорку, когда контента стало достаточно", () => {
    const { store, align, setCount } = createAlign(2);

    align.update();
    setCount(8);
    align.update();

    expect(store.peek("alignItemsAtEndPadding")).toBe(0);
  });

  it("удерживает высоту контента на кадр при уменьшении распорки", () => {
    const { store, align, setCount } = createAlign(2);

    align.update();
    store.set("totalSize", 200);

    setCount(4);
    align.update();

    // Иначе ScrollView сожмёт контент раньше, чем разложены новые позиции.
    expect(store.peek("totalSize")).toBe(500);

    jest.advanceTimersByTime(16);

    expect(store.peek("totalSize")).toBe(500);
  });

  it("не удерживает высоту, когда распорка растёт", () => {
    const { store, align, setCount } = createAlign(4);

    align.update();
    store.set("totalSize", 400);

    setCount(2);
    align.update();

    expect(store.peek("totalSize")).toBe(400);
  });

  it("ничего не делает, когда распорка не изменилась", () => {
    const { store, align } = createAlign(2);

    align.update();
    store.set("totalSize", 999);
    align.update();

    expect(store.peek("totalSize")).toBe(999);
  });
});
