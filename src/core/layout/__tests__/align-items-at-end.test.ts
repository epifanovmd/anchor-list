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

  // Сигнал `totalSize` — высота элементов без распорок: по нему слой
  // контейнеров задаёт свою высоту, а распорка добавляется снаружи. Подмена
  // делала слой выше содержимого, и последняя строка вставала не у нижней
  // кромки, а выше неё на размер распорки.
  it("не подменяет суммарную высоту элементов", () => {
    const { store, metrics, align, setCount } = createAlign(2);

    store.set("totalSize", metrics.getTotalSize());
    align.update();

    expect(store.peek("totalSize")).toBe(200);

    setCount(4);
    store.set("totalSize", metrics.getTotalSize());
    align.update();

    expect(store.peek("totalSize")).toBe(400);
  });
});
