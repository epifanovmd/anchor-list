import { ListStore } from "../../../model";
import type { IAnchorListRange } from "../../layout";
import { ItemHighlight } from "../item-highlight";

const createHighlight = () => {
  const store = new ListStore();
  const state = {
    keys: ["a", "b", "c", "d", "e"],
    range: {
      start: 0,
      end: 2,
      startBuffered: 0,
      endBuffered: 3,
    } as IAnchorListRange,
  };
  const highlight = new ItemHighlight({
    store,
    getIndexByKey: key => {
      const index = state.keys.indexOf(key);

      return index === -1 ? undefined : index;
    },
    getRange: () => state.range,
  });

  return { store, state, highlight };
};

describe("ItemHighlight", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("подсвечивает строку, которая уже на экране, сразу", () => {
    const { store, highlight } = createHighlight();

    expect(highlight.request("b", true)).toBe(true);

    expect(store.peek("highlight")).toMatchObject({ key: "b" });
  });

  it("ждёт, пока строка не доедет до экрана", () => {
    // Переход анимирован: подсветить строку до того, как она появилась,
    // значит подсветить пустое место — пользователь увидит уже угасшую.
    const { store, state, highlight } = createHighlight();

    highlight.request("e", true);

    expect(store.peek("highlight")).toBeNull();

    state.range = { start: 2, end: 4, startBuffered: 1, endBuffered: 4 };
    highlight.check();

    expect(store.peek("highlight")).toMatchObject({ key: "e" });
  });

  it("не подсвечивает строку в буфере за кадром", () => {
    const { store, state, highlight } = createHighlight();

    highlight.request("d", true);
    state.range = { start: 0, end: 2, startBuffered: 0, endBuffered: 4 };
    highlight.check();

    expect(store.peek("highlight")).toBeNull();
  });

  it("отдаёт длительности с умолчаниями и по опциям", () => {
    const { store, highlight } = createHighlight();

    highlight.request("a", true);
    expect(store.peek("highlight")).toMatchObject({
      duration: 1200,
      fade: 200,
    });

    highlight.request("b", { duration: 3000, fade: 50 });
    expect(store.peek("highlight")).toMatchObject({
      key: "b",
      duration: 3000,
      fade: 50,
    });
  });

  it("каждая подсветка — новая, даже той же строки", () => {
    // Повторный переход к той же цитате обязан подсветить её снова: ячейка
    // узнаёт о подсветке по объекту сигнала, и тот же объект её не разбудит.
    const { store, highlight } = createHighlight();

    highlight.request("a", true);
    const first = store.peek("highlight");

    highlight.request("a", true);
    const second = store.peek("highlight");

    expect(second).not.toBe(first);
    expect(second?.seq).not.toBe(first?.seq);
  });

  it("снимает подсветку, когда она догорела", () => {
    const { store, highlight } = createHighlight();

    highlight.request("a", { duration: 1000, fade: 100 });
    jest.advanceTimersByTime(1199);
    expect(store.peek("highlight")).not.toBeNull();

    jest.advanceTimersByTime(1);
    expect(store.peek("highlight")).toBeNull();
  });

  it("ничего не делает без просьбы и для отсутствующего ключа", () => {
    const { store, highlight } = createHighlight();

    expect(highlight.request("a", undefined)).toBe(false);
    expect(highlight.request("a", false)).toBe(false);
    expect(highlight.request("missing", true)).toBe(false);
    expect(store.peek("highlight")).toBeNull();
  });

  it("жест отменяет ожидающую подсветку, но не горящую", () => {
    // Пользователь перехватил переезд пальцем — цели он уже не увидит, и
    // подсвечивать её, когда она мелькнёт в кадре, незачем. А уже горящая
    // подсветка остаётся: она на строке, на которую он смотрит.
    const { store, state, highlight } = createHighlight();

    highlight.request("a", true);
    highlight.request("e", true);
    highlight.cancel();

    state.range = { start: 2, end: 4, startBuffered: 1, endBuffered: 4 };
    highlight.check();

    expect(store.peek("highlight")).toMatchObject({ key: "a" });
  });

  it("гасит подсветку по требованию", () => {
    const { store, highlight } = createHighlight();

    highlight.request("a", true);
    highlight.clear();

    expect(store.peek("highlight")).toBeNull();

    // Таймер погасшей подсветки не должен погасить следующую.
    highlight.request("b", { duration: 5000 });
    jest.advanceTimersByTime(1600);
    expect(store.peek("highlight")).toMatchObject({ key: "b" });
  });
});
