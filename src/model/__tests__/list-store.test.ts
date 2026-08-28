import { ListStore } from "../list-store";

describe("ListStore", () => {
  it("отдаёт стартовые значения именованных сигналов", () => {
    const store = new ListStore();

    expect(store.peek("totalSize")).toBe(0);
    expect(store.peek("isAtStart")).toBe(true);
    expect(store.peek("readyToRender")).toBe(false);
    expect(store.peek("activeStickyStartIndex")).toBe(-1);
  });

  it("не знает значения сигнала контейнера до первой записи", () => {
    const store = new ListStore();

    expect(store.peek("containerPosition0")).toBeUndefined();
  });

  it("уведомляет подписчика об изменении", () => {
    const store = new ListStore();
    const listener = jest.fn();

    store.listen("totalSize", listener);
    store.set("totalSize", 300);

    expect(listener).toHaveBeenCalledWith(300);
    expect(store.peek("totalSize")).toBe(300);
  });

  it("молчит, когда значение не изменилось", () => {
    const store = new ListStore();
    const listener = jest.fn();

    store.set("totalSize", 300);
    store.listen("totalSize", listener);
    store.set("totalSize", 300);

    // Пересчёт раскладки пишет одни и те же значения десятки раз в секунду:
    // без этой отсечки каждая запись перерисовывала бы подписчиков.
    expect(listener).not.toHaveBeenCalled();
  });

  it("сравнивает по ссылке — новый объект данных доходит до ячейки", () => {
    const store = new ListStore();
    const listener = jest.fn();
    const item = { text: "привет" };

    store.set("containerItemData0", item);
    store.listen("containerItemData0", listener);

    store.set("containerItemData0", item);
    expect(listener).not.toHaveBeenCalled();

    // Правка сообщения приходит новым объектом с тем же содержимым.
    store.set("containerItemData0", { text: "привет" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("снимает подписку", () => {
    const store = new ListStore();
    const listener = jest.fn();

    const unsubscribe = store.listen("totalSize", listener);

    unsubscribe();
    store.set("totalSize", 100);

    expect(listener).not.toHaveBeenCalled();
  });

  it("уведомляет всех подписчиков одного сигнала", () => {
    const store = new ListStore();
    const first = jest.fn();
    const second = jest.fn();

    store.listen("scrollAdjust", first);
    store.listen("scrollAdjust", second);
    store.set("scrollAdjust", 42);

    expect(first).toHaveBeenCalledWith(42);
    expect(second).toHaveBeenCalledWith(42);
  });

  it("не задевает чужие сигналы", () => {
    const store = new ListStore();
    const listener = jest.fn();

    store.listen("containerPosition0", listener);
    store.set("containerPosition1", 100);

    expect(listener).not.toHaveBeenCalled();
  });

  it("уведомляет о позиции по ключу элемента", () => {
    const store = new ListStore();
    const listener = jest.fn();

    const unsubscribe = store.listenPosition("a", listener);

    store.notifyPosition("a", 250);
    expect(listener).toHaveBeenCalledWith(250);

    // Подписка на ключ переживает смену контейнера, но не отписку.
    unsubscribe();
    store.notifyPosition("a", 300);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("не падает на уведомлении о ключе без подписчиков", () => {
    const store = new ListStore();

    expect(() => store.notifyPosition("missing", 0)).not.toThrow();
  });
});
