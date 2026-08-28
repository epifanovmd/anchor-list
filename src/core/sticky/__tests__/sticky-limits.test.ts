import { ListMetrics } from "../../../model";
import { getStickyEdgeOf, getStickyLimitOf } from "../sticky-limits";

const ITEM_SIZE = 100;

const createMetrics = (sizes?: number[]) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const count = sizes?.length ?? 10;
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  if (sizes)
    keys.forEach((key, index) => metrics.setFixedSize(key, sizes[index]!));

  return metrics;
};

describe("getStickyEdgeOf", () => {
  it("находит кромку якоря", () => {
    const configs = [
      { edge: "start" as const, indices: [0, 4] },
      { edge: "end" as const, indices: [6] },
    ];

    expect(getStickyEdgeOf(configs, 4)).toBe("start");
    expect(getStickyEdgeOf(configs, 6)).toBe("end");
    expect(getStickyEdgeOf(configs, 5)).toBeNull();
  });

  it("ничего не находит без наборов", () => {
    expect(getStickyEdgeOf([], 0)).toBeNull();
  });
});

describe("getStickyLimitOf — начальная кромка", () => {
  it("ограничивает ход следующим якорем", () => {
    const metrics = createMetrics();

    // Следующий якорь на 400, высота текущего 100: дальше 300 не уедет.
    expect(
      getStickyLimitOf([{ edge: "start", indices: [0, 4] }], metrics, 0),
    ).toBe(300);
  });

  it("не ограничивает последний якорь набора", () => {
    const metrics = createMetrics();

    expect(
      getStickyLimitOf([{ edge: "start", indices: [0, 4] }], metrics, 4),
    ).toBeUndefined();
  });
});

describe("getStickyLimitOf — конечная кромка", () => {
  it("берёт строку сразу за предыдущим якорем", () => {
    const metrics = createMetrics();

    // Группа якоря 6 начинается на элементе 3.
    expect(
      getStickyLimitOf([{ edge: "end", indices: [2, 6] }], metrics, 6),
    ).toBe(300);
  });

  it("для первого якоря ограничивает подъём началом контента", () => {
    const metrics = createMetrics();

    expect(getStickyLimitOf([{ edge: "end", indices: [6] }], metrics, 6)).toBe(
      0,
    );
  });

  it("берёт объявленное начало группы", () => {
    // Разделитель даты 44, затем три сообщения группы.
    const metrics = createMetrics([44, 56, 84, 120]);

    expect(
      getStickyLimitOf(
        [{ edge: "end", indices: [3], groupStarts: [1] }],
        metrics,
        3,
      ),
    ).toBe(44);
  });

  it("сдвигает границу группы на зазор внутри строки", () => {
    const metrics = createMetrics([44, 56, 84, 120]);

    // Зазор между строками создан отступом внутри них: без поправки объект
    // поднимается в этот зазор.
    expect(
      getStickyLimitOf(
        [{ edge: "end", indices: [3], groupStarts: [1], limitInset: 8 }],
        metrics,
        3,
      ),
    ).toBe(52);
  });
});

describe("getStickyLimitOf — прочее", () => {
  it("ничего не отдаёт элементу вне наборов", () => {
    const metrics = createMetrics();

    expect(
      getStickyLimitOf([{ edge: "start", indices: [0, 4] }], metrics, 3),
    ).toBeUndefined();
  });

  it("ищет по всем наборам", () => {
    const metrics = createMetrics();
    const configs = [
      { edge: "start" as const, indices: [0, 4] },
      { edge: "end" as const, indices: [6] },
    ];

    expect(getStickyLimitOf(configs, metrics, 6)).toBe(0);
  });
});
