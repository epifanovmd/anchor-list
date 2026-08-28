import { ListMetrics } from "../../../model";
import type { AnchorListInitialScroll } from "../../../types";
import { InitialOffsetResolver } from "../initial-offset";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

const createResolver = (count = 20) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const state = {
    target: undefined as AnchorListInitialScroll | undefined,
    scrollLength: SCROLL_LENGTH,
    /** Шапка, подвал и распорки — в сумму элементов они не входят. */
    padding: 0,
    /** Смещение начала элементов в координатах контента: высота шапки. */
    origin: 0,
    /** Замер контента от ScrollView уже приходил. */
    contentMeasured: true,
  };

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  const resolver = new InitialOffsetResolver({
    metrics,
    getTarget: () => state.target,
    getScrollLength: () => state.scrollLength,
    getContentSize: () => metrics.getTotalSize() + state.padding,
    getContentOrigin: () => state.origin,
    isContentMeasured: () => state.contentMeasured,
  });

  return { metrics, resolver, state };
};

describe("InitialOffsetResolver", () => {
  it("не знает цели без стартовой позиции", () => {
    const { resolver } = createResolver();

    expect(resolver.resolve()).toBeUndefined();
  });

  it("не знает цели, пока вьюпорт не измерен", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };
    state.scrollLength = 0;

    expect(resolver.resolve()).toBeUndefined();
  });

  it("отдаёт заданное смещение как есть", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: 320 };

    expect(resolver.resolve()).toBe(320);
  });

  it("не уходит выше начала контента при отрицательном смещении", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: -100 };

    expect(resolver.resolve()).toBe(0);
  });

  it("ставит конец контента у нижней кромки", () => {
    const { resolver, state } = createResolver(20);

    state.target = { type: "end" };

    // 20 элементов по 100 при вьюпорте 500.
    expect(resolver.resolve()).toBe(1500);
  });

  it("ставит конец контента над нижней распоркой", () => {
    const { resolver, state } = createResolver(20);

    state.target = { type: "end" };
    // Подвал-распорка под панель ввода: контент выше суммы элементов.
    state.padding = 80;

    // Иначе список открывается с последней строкой под самой панелью.
    expect(resolver.resolve()).toBe(1580);
  });

  it("не скроллит к концу, когда контент короче вьюпорта", () => {
    const { resolver, state } = createResolver(2);

    state.target = { type: "end" };

    expect(resolver.resolve()).toBe(0);
  });

  it("ставит элемент по индексу", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };

    expect(resolver.resolve()).toBe(1000);
  });

  it("учитывает положение элемента во вьюпорте", () => {
    const { resolver, state } = createResolver();

    state.target = {
      type: "index",
      index: 10,
      viewPosition: 1,
      viewOffset: 20,
    };

    // Низ элемента у нижней кромки, минус отступ: 1000 + 100 - 500 - 20.
    expect(resolver.resolve()).toBe(580);
  });

  it("ставит элемент под шапкой", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };
    state.origin = 60;

    expect(resolver.resolve()).toBe(1060);
  });

  it("не знает цели для несуществующего индекса", () => {
    const { resolver, state } = createResolver(5);

    state.target = { type: "index", index: 50 };
    expect(resolver.resolve()).toBeUndefined();

    state.target = { type: "index", index: -1 };
    expect(resolver.resolve()).toBeUndefined();
  });

  it("считает цель устаканившейся, когда она перестала уезжать", () => {
    const { metrics, resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };

    // Первая проверка сравнивать не с чем.
    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(true);

    // Измерение сдвинуло цель — доводить позицию придётся снова.
    metrics.setMeasuredSize("k0", 300);
    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(true);
  });

  it("не считает устаканившейся невычислимую цель", () => {
    const { resolver } = createResolver();

    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(false);
  });
});

describe("InitialOffsetResolver — готовность цели", () => {
  it("не считает конец списка устаканившимся до замера контента", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };
    state.contentMeasured = false;

    resolver.isSettled();

    // Оба ответа посчитаны без подвала: совпали они не потому, что цель
    // перестала уезжать, а потому, что распорки для списка ещё не существует.
    expect(resolver.isSettled()).toBe(false);
  });

  it("считает цель устаканившейся, когда замер пришёл", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };

    resolver.isSettled();

    expect(resolver.isSettled()).toBe(true);
  });

  it("прочим целям замер контента не нужен", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: 300 };
    state.contentMeasured = false;

    resolver.isSettled();

    expect(resolver.isSettled()).toBe(true);
  });
});
