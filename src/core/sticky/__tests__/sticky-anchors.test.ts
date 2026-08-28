import type { SharedValue } from "react-native-reanimated";

import { ListMetrics } from "../../../model";
import { StickyAnchors } from "../sticky-anchors";

const ITEM_SIZE = 100;
const ITEM_COUNT = 10;
const SCROLL_LENGTH = 500;

/** В node-окружении shared value — обычный носитель значения. */
const sharedValue = (value: number) => ({ value }) as SharedValue<number>;

const createAnchors = () => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const keys = Array.from({ length: ITEM_COUNT }, (_, index) => `k${index}`);

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  return { metrics, anchors: new StickyAnchors({ metrics }) };
};

describe("StickyAnchors — начальная кромка", () => {
  it("прилипшим считает последний якорь, ушедший за кромку", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [0, 4, 8] }]);

    // Скролл 450: якоря на 0 и 400 уже за кромкой, на 800 — ещё нет.
    const [state] = anchors.resolve(450, SCROLL_LENGTH);

    expect(state!.activeIndex).toBe(4);
  });

  it("не находит якоря выше начала контента", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [4] }]);

    expect(anchors.resolve(100, SCROLL_LENGTH)[0]!.activeIndex).toBe(-1);
  });

  it("ограничивает ход следующим якорем", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [0, 4] }]);

    const [state] = anchors.resolve(100, SCROLL_LENGTH);

    // Следующий якорь на 400, высота текущего 100: дальше 300 не уедет.
    expect(state!.activeIndex).toBe(0);
    expect(state!.limit).toBe(300);
  });

  it("не ограничивает последний якорь набора", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [0, 4] }]);

    expect(anchors.resolve(500, SCROLL_LENGTH)[0]!.limit).toBeUndefined();
  });

  it("сдвигает кромку на заданный отступ", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([
      { edge: "start", indices: [0, 4], offset: sharedValue(150) },
    ]);

    // Кромка опущена на 150, поэтому якорь на 400 считается пройденным раньше.
    expect(anchors.resolve(300, SCROLL_LENGTH)[0]!.activeIndex).toBe(4);
    expect(anchors.resolve(200, SCROLL_LENGTH)[0]!.activeIndex).toBe(0);
  });
});

describe("StickyAnchors — конечная кромка", () => {
  it("прилипшим считает первый якорь, чей низ ниже кромки", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "end", indices: [2, 6] }]);

    // Вьюпорт 0..500: низ якоря 2 — 300 (выше кромки), низ якоря 6 — 700.
    const [state] = anchors.resolve(0, SCROLL_LENGTH);

    expect(state!.activeIndex).toBe(6);
  });

  it("ограничивает подъём верхом своей группы", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "end", indices: [2, 6] }]);

    const [state] = anchors.resolve(0, SCROLL_LENGTH);

    // Группа якоря 6 начинается сразу за предыдущим якорем — на элементе 3.
    expect(state!.limit).toBe(300);
  });

  it("для первого якоря ограничивает подъём началом контента", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "end", indices: [6] }]);

    expect(anchors.resolve(0, SCROLL_LENGTH)[0]!.limit).toBe(0);
  });

  it("не находит якоря, когда все они выше кромки", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "end", indices: [2] }]);

    expect(anchors.resolve(0, SCROLL_LENGTH)[0]!.activeIndex).toBe(-1);
  });

  it("сдвигает кромку на заданный отступ", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([
      { edge: "end", indices: [2, 6], offset: sharedValue(250) },
    ]);

    // Панель ввода подняла кромку на 250: якорь 2 оказывается под ней.
    expect(anchors.resolve(0, SCROLL_LENGTH)[0]!.activeIndex).toBe(2);
  });
});

describe("StickyAnchors — удержание контейнеров", () => {
  it("держит активный якорь и его соседей", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [0, 4, 8] }]);

    const states = anchors.resolve(450, SCROLL_LENGTH);

    expect(anchors.getPinnedIndices(states).sort()).toEqual([0, 4, 8]);
  });

  it("ничего не держит, когда якорей нет", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([]);

    expect(anchors.hasAnchors()).toBe(false);
    expect(anchors.getPinnedIndices(anchors.resolve(0, SCROLL_LENGTH))).toEqual(
      [],
    );
  });

  it("не считает набором пустой список индексов", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [] }]);

    expect(anchors.hasAnchors()).toBe(false);
  });

  it("обслуживает обе кромки одновременно", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([
      { edge: "start", indices: [0, 4] },
      { edge: "end", indices: [6] },
    ]);

    const states = anchors.resolve(100, SCROLL_LENGTH);

    expect(states).toHaveLength(2);
    expect(states.find(state => state.edge === "start")!.activeIndex).toBe(0);
    expect(states.find(state => state.edge === "end")!.activeIndex).toBe(6);
    expect(anchors.getEdgeOf(4)).toBe("start");
    expect(anchors.getEdgeOf(6)).toBe("end");
    expect(anchors.getEdgeOf(5)).toBeNull();
  });

  it("забывает наборы при сбросе конфигурации", () => {
    const { anchors } = createAnchors();

    anchors.setConfigs([{ edge: "start", indices: [0] }]);
    anchors.setConfigs(undefined);

    expect(anchors.hasAnchors()).toBe(false);
    expect(anchors.resolve(0, SCROLL_LENGTH)).toEqual([]);
  });
});
