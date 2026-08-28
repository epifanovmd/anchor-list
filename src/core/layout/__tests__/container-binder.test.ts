import type { IContainerRequest } from "../../../model";
import {
  ContainerPool,
  ListMetrics,
  ListStore,
  POSITION_OUT_OF_VIEW,
} from "../../../model";
import { ContainerBinder } from "../container-binder";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

interface IRow {
  id: string;
}

const createBinder = (
  count = 20,
  itemsAreEqual?: (prev: unknown, next: unknown, index: number) => boolean,
) => {
  const store = new ListStore();
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const pool = new ContainerPool();
  const data: IRow[] = Array.from({ length: count }, (_, index) => ({
    id: `k${index}`,
  }));
  const limits = new Map<number, number>();

  metrics.setItems(
    data.map(row => row.id),
    data.map(() => ""),
  );
  for (const row of data) metrics.setFixedSize(row.id, ITEM_SIZE);

  const binder = new ContainerBinder({
    store,
    metrics,
    pool,
    getItem: index => data[index],
    itemsAreEqual,
    getStickyLimit: index => limits.get(index),
  });

  return { store, metrics, pool, binder, data, limits };
};

const request = (
  index: number,
  overrides: Partial<IContainerRequest> = {},
): IContainerRequest => ({
  index,
  key: `k${index}`,
  type: "",
  stickyEdge: null,
  ...overrides,
});

const bind = (
  binder: ContainerBinder,
  requests: IContainerRequest[],
  viewportTop = 0,
) =>
  binder.bind({
    requests,
    clipTop: viewportTop,
    clipEnd: viewportTop + SCROLL_LENGTH,
  });

describe("ContainerBinder — публикация сигналов", () => {
  it("раскладывает элементы по контейнерам", () => {
    const { store, binder } = createBinder();

    bind(binder, [request(0), request(1)]);

    expect(store.peek("numContainers")).toBe(2);
    expect(store.peek("containerItemKey0")).toBe("k0");
    expect(store.peek("containerItemIndex0")).toBe(0);
    expect(store.peek("containerPosition1")).toBe(100);
    expect(store.peek("containerItemSize1")).toBe(100);
  });

  it("отдаёт ячейке объект данных", () => {
    const { store, binder, data } = createBinder();

    bind(binder, [request(3)]);

    expect(store.peek("containerItemData0")).toBe(data[3]);
    expect(store.peek("containerItemType0")).toBe("");
  });

  it("доносит новый объект данных без смены привязки", () => {
    const { store, binder, data } = createBinder();

    bind(binder, [request(0)]);
    // Так приходит правка сообщения: элемент на своём месте, объект новый.
    data[0] = { id: "k0" };
    bind(binder, [request(0)]);

    expect(store.peek("containerItemData0")).toBe(data[0]);
  });

  it("сохраняет прежний объект, когда itemsAreEqual считает данные равными", () => {
    const { store, binder, data } = createBinder(
      20,
      (prev, next) => (prev as IRow).id === (next as IRow).id,
    );

    bind(binder, [request(0)]);

    const previous = store.peek("containerItemData0");

    data[0] = { id: "k0" };
    bind(binder, [request(0)]);

    expect(store.peek("containerItemData0")).toBe(previous);
  });

  it("не аллоцирует пул повторно при той же ревизии и запросах", () => {
    const { binder, pool } = createBinder();
    const allocate = jest.spyOn(pool, "allocate");
    const params = {
      requests: [request(0), request(1)],
      revision: 7,
      clipTop: 0,
      clipEnd: SCROLL_LENGTH,
    };

    binder.bind(params);
    binder.bind({ ...params, clipTop: 10, clipEnd: SCROLL_LENGTH + 10 });

    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it("проставляет кромку и предел прилипания", () => {
    const { store, binder, limits } = createBinder();

    limits.set(4, 300);
    bind(binder, [request(4, { stickyEdge: "start" })]);

    expect(store.peek("containerSticky0")).toBe("start");
    expect(store.peek("containerStickyLimit0")).toBe(300);
  });

  it("не считает предел у обычной строки", () => {
    const { store, binder, limits } = createBinder();

    limits.set(4, 300);
    bind(binder, [request(4)]);

    expect(store.peek("containerStickyLimit0")).toBeUndefined();
  });

  it("подрезает строку вне вьюпорта", () => {
    const { store, binder } = createBinder();

    bind(binder, [request(0), request(10)]);

    expect(store.peek("containerClipped0")).toBe(false);
    expect(store.peek("containerClipped1")).toBe(true);
  });

  it("уводит ожидающего измерения за пределы контента", () => {
    const { store, metrics, binder } = createBinder();

    metrics.setItems(
      ["fresh", ...Array.from({ length: 20 }, (_, index) => `k${index}`)],
      new Array(21).fill(""),
    );
    metrics.markPending("fresh");

    bind(binder, [{ index: 0, key: "fresh", type: "", stickyEdge: null }]);

    expect(store.peek("containerPosition0")).toBe(-100000);
    expect(store.peek("containerClipped0")).toBe(false);
  });

  it("уведомляет подписчиков позиции по ключу", () => {
    const { store, binder } = createBinder();
    const listener = jest.fn();

    store.listenPosition("k3", listener);
    bind(binder, [request(3)]);
    bind(binder, [request(3)]);

    expect(listener).toHaveBeenCalledWith(300);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("ContainerBinder — освобождение контейнеров", () => {
  it("уводит контейнер, оставшийся без элемента", () => {
    const { store, binder } = createBinder();

    bind(binder, [request(0), request(1)]);
    bind(binder, [request(0)]);

    expect(store.peek("containerPosition1")).toBe(POSITION_OUT_OF_VIEW);
    expect(store.peek("containerSticky1")).toBeNull();
  });

  it("не уводит контейнер, тут же занятый другим элементом", () => {
    const { store, binder } = createBinder();

    bind(binder, [request(0), request(1)]);
    bind(binder, [request(1), request(2)]);

    // Контейнер k0 достался k2 — уводить его нельзя.
    expect(store.peek("containerPosition0")).toBe(200);
  });

  it("освобождает все контейнеры на опустевшем списке", () => {
    const { store, binder } = createBinder();

    bind(binder, [request(0), request(1)]);
    binder.releaseAll();

    expect(store.peek("containerPosition0")).toBe(POSITION_OUT_OF_VIEW);
    expect(store.peek("containerPosition1")).toBe(POSITION_OUT_OF_VIEW);
    expect(store.peek("numContainers")).toBe(2);
  });

  it("пропускает запрос без выделенного контейнера", () => {
    const { store, binder, pool } = createBinder();

    jest.spyOn(pool, "getContainerByKey").mockReturnValue(undefined);

    expect(() => bind(binder, [request(0)])).not.toThrow();
    expect(store.peek("containerItemKey0")).toBeUndefined();
  });
});
