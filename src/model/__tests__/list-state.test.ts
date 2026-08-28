import { AnchorListState } from "../list-state";
import { ListStore } from "../list-store";

describe("AnchorListState — до монтирования списка", () => {
  it("не знает значений", () => {
    const state = new AnchorListState();

    expect(state.peek("totalSize")).toBeUndefined();
  });

  it("принимает подписку, которой пока некуда идти", () => {
    const state = new AnchorListState();
    const listener = jest.fn();

    expect(() => state.listen("totalSize", listener)).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it("будит заждавшихся подписчиков, когда список появился", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    state.listen("totalSize", listener);
    store.set("totalSize", 4000);
    state.attach(store);

    // Значения появились разом: иначе подписчик остался бы с пустотой до
    // первого изменения.
    expect(listener).toHaveBeenCalledWith(4000);
    expect(state.peek("totalSize")).toBe(4000);
  });
});

describe("AnchorListState — привязка к списку", () => {
  it("передаёт изменения подписчикам", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    state.attach(store);
    state.listen("isNearEnd", listener);
    store.set("isNearEnd", true);

    expect(listener).toHaveBeenCalledWith(true);
  });

  it("не задевает чужие сигналы", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    state.attach(store);
    state.listen("isNearEnd", listener);
    store.set("totalSize", 100);

    expect(listener).not.toHaveBeenCalled();
  });

  it("держит одну подписку на имя при нескольких слушателях", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listen = jest.spyOn(store, "listen");

    state.attach(store);
    state.listen("totalSize", jest.fn());
    state.listen("totalSize", jest.fn());

    expect(listen).toHaveBeenCalledTimes(1);
  });

  it("уведомляет всех слушателей имени", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const first = jest.fn();
    const second = jest.fn();

    state.attach(store);
    state.listen("totalSize", first);
    state.listen("totalSize", second);
    store.set("totalSize", 300);

    expect(first).toHaveBeenCalledWith(300);
    expect(second).toHaveBeenCalledWith(300);
  });

  it("не перепривязывается к тому же списку", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    state.attach(store);
    state.listen("totalSize", listener);
    state.attach(store);
    store.set("totalSize", 100);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("AnchorListState — отписка", () => {
  it("перестаёт уведомлять снятого слушателя", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    state.attach(store);

    const unsubscribe = state.listen("totalSize", listener);

    unsubscribe();
    store.set("totalSize", 100);

    expect(listener).not.toHaveBeenCalled();
  });

  it("оставляет подписку, пока есть хоть один слушатель", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const kept = jest.fn();

    state.attach(store);

    const unsubscribe = state.listen("totalSize", jest.fn());

    state.listen("totalSize", kept);
    unsubscribe();
    store.set("totalSize", 100);

    expect(kept).toHaveBeenCalledWith(100);
  });

  it("забывает список при размонтировании", () => {
    const state = new AnchorListState();
    const store = new ListStore();
    const listener = jest.fn();

    const detach = state.attach(store);

    state.listen("totalSize", listener);
    detach();
    store.set("totalSize", 100);

    expect(listener).not.toHaveBeenCalled();
    expect(state.peek("totalSize")).toBeUndefined();
  });

  it("не отвязывается по чужому размонтированию", () => {
    const state = new AnchorListState();
    const first = new ListStore();
    const second = new ListStore();
    const listener = jest.fn();

    const detachFirst = state.attach(first);

    state.attach(second);
    state.listen("totalSize", listener);
    // Список пересоздался: отписка прежнего не должна рвать связь с новым.
    detachFirst();
    second.set("totalSize", 100);

    expect(listener).toHaveBeenCalledWith(100);
  });

  it("переносит подписки на новый список", () => {
    const state = new AnchorListState();
    const first = new ListStore();
    const second = new ListStore();
    const listener = jest.fn();

    state.attach(first);
    state.listen("totalSize", listener);

    second.set("totalSize", 900);
    state.attach(second);

    expect(listener).toHaveBeenLastCalledWith(900);

    first.set("totalSize", 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
