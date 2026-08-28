import { ListMetrics } from "../../../model";
import { pickAnchors, resolveAnchor } from "../anchor-picker";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

const keys = (count: number, prefix = "k") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

/** Стенд: элементы одинаковой высоты, все измерены. */
const createMetrics = (count = 20, measured = true) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const items = keys(count);

  metrics.setItems(
    items,
    items.map(() => ""),
  );

  if (measured) {
    for (const key of items) metrics.setMeasuredSize(key, ITEM_SIZE);
  }

  return metrics;
};

const pick = (metrics: ListMetrics, scroll: number, options = {}) =>
  pickAnchors({ metrics, scroll, scrollLength: SCROLL_LENGTH, ...options });

describe("pickAnchors", () => {
  it("не находит якорей в пустом списке", () => {
    const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });

    metrics.setItems([], []);

    const result = pick(metrics, 0);

    expect(result.anchors).toEqual([]);
    expect(result.firstIndex).toBe(0);
  });

  it("берёт первую строку, целиком лежащую ниже кромки", () => {
    const metrics = createMetrics();

    const { anchors } = pick(metrics, 1000);

    expect(anchors[0]).toMatchObject({ key: "k10", index: 10, position: 1000 });
  });

  it("запоминает смещение скролла на момент снятия", () => {
    const metrics = createMetrics();

    const { anchors, viewportEnd } = pick(metrics, 1000);

    // По расхождению с восстановлением видно, что пользователь проскроллил сам.
    expect(viewportEnd).toBe(1000 + SCROLL_LENGTH);
    expect(anchors[0]).toMatchObject({ position: 1000 });
  });

  it("снимает несколько кандидатов подряд", () => {
    const metrics = createMetrics();

    const { anchors } = pick(metrics, 1000);

    // Первая видимая строка может не пережить то самое изменение, ради которого
    // якорь и снимался.
    expect(anchors).toHaveLength(4);
    expect(anchors.map(anchor => anchor.index)).toEqual([10, 11, 12, 13]);
  });

  it("пропускает строку, целиком ушедшую выше вьюпорта", () => {
    const metrics = createMetrics();

    const { anchors, firstIndex } = pick(metrics, 1050);

    // findIndexAtOffset даёт k10, но её низ ровно на кромке.
    expect(firstIndex).toBe(10);
    expect(anchors.every(anchor => anchor.index >= 11)).toBe(true);
  });

  it("не опирается на строку, торчащую над кромкой", () => {
    const metrics = createMetrics();

    // Скролл посреди k9: она видна лишь нижней частью и тянет за собой всё,
    // что под ней.
    const { anchors } = pick(metrics, 950);

    expect(anchors[0]!.index).toBe(10);
  });

  it("берёт торчащую строку, когда других во вьюпорте нет", () => {
    const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });

    metrics.setItems(["only"], [""]);
    metrics.setMeasuredSize("only", 5000);

    const { anchors } = pick(metrics, 1000);

    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.key).toBe("only");
    expect(anchors[0]!.position).toBe(0);
  });

  it("пропускает неизмеренные строки", () => {
    const metrics = createMetrics(20);

    metrics.setItems([...keys(20), "fresh"], new Array(21).fill(""));
    metrics.markPending("fresh");

    const { anchors } = pick(metrics, 2000);

    // У неизмеренного элемента позиция оценочная: доводить по ней нечего.
    expect(anchors.every(anchor => anchor.key !== "fresh")).toBe(true);
  });

  it("не находит якорей, когда весь вьюпорт занят неизмеренным", () => {
    const metrics = createMetrics(3, false);

    const { anchors } = pick(metrics, 0);

    expect(anchors).toEqual([]);
  });

  it("уважает запрет на элемент как якорь", () => {
    const metrics = createMetrics();

    const { anchors } = pick(metrics, 1000, {
      shouldRestorePosition: (index: number) => index !== 10,
    });

    expect(anchors[0]!.index).toBe(11);
  });

  it("не находит якорей, когда запрещены все", () => {
    const metrics = createMetrics();

    const { anchors } = pick(metrics, 1000, {
      shouldRestorePosition: () => false,
    });

    expect(anchors).toEqual([]);
  });

  it("не выходит за нижнюю кромку вьюпорта", () => {
    const metrics = createMetrics(100);

    // Вьюпорт 1000..1500 — строк в нём пять, и брать шестую незачем.
    const { anchors, viewportEnd } = pick(metrics, 1000);

    expect(viewportEnd).toBe(1500);
    expect(anchors.every(anchor => anchor.position <= viewportEnd)).toBe(true);
  });

  it("обходится списком короче набора кандидатов", () => {
    const metrics = createMetrics(2);

    const { anchors } = pick(metrics, 0);

    expect(anchors).toHaveLength(2);
  });
});

describe("resolveAnchor", () => {
  it("берёт первый переживший якорь", () => {
    const metrics = createMetrics();
    const { anchors } = pick(metrics, 1000);

    metrics.setItems(keys(20).slice(11), new Array(9).fill(""));

    const resolved = resolveAnchor(anchors, metrics);

    // k10 удалён — опорой становится следующий снятый.
    expect(resolved!.anchor.key).toBe("k11");
    expect(resolved!.position).toBe(0);
  });

  it("отдаёт новую позицию якоря", () => {
    const metrics = createMetrics();
    const { anchors } = pick(metrics, 1000);

    metrics.setItems([...keys(3, "new"), ...keys(20)], new Array(23).fill(""));
    for (const key of keys(3, "new")) metrics.setMeasuredSize(key, ITEM_SIZE);

    expect(resolveAnchor(anchors, metrics)!.position).toBe(1300);
  });

  it("ничего не находит, когда не выжил ни один", () => {
    const metrics = createMetrics();
    const { anchors } = pick(metrics, 1000);

    metrics.setItems(keys(20).slice(14), new Array(6).fill(""));

    expect(resolveAnchor(anchors, metrics)).toBeUndefined();
  });

  it("ничего не находит на пустом наборе", () => {
    const metrics = createMetrics();

    expect(resolveAnchor([], metrics)).toBeUndefined();
  });
});
