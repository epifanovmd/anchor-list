import { ListMetrics } from "../../../model";
import { computeSnapOffsets, haveSameSnapOffsets } from "../snap-offsets";

const SCROLL_LENGTH = 500;

const createMetrics = (sizes: number[]) => {
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const keys = sizes.map((_, index) => `k${index}`);

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );
  keys.forEach((key, index) => metrics.setFixedSize(key, sizes[index]!));

  return metrics;
};

/** Десять строк по 100, контент 1000, предел скролла 500. */
const base = (
  overrides: Partial<Parameters<typeof computeSnapOffsets>[0]> = {},
) =>
  computeSnapOffsets({
    metrics: createMetrics(Array.from({ length: 10 }, () => 100)),
    indices: undefined,
    contentOrigin: 0,
    scrollLength: SCROLL_LENGTH,
    maxScroll: 500,
    align: "start",
    offset: 0,
    ...overrides,
  });

describe("computeSnapOffsets", () => {
  it("ставит точку в начало каждой строки и не уходит за предел скролла", () => {
    // Строки 5..9 упираются в конец контента: их точки сливаются в одну — 500.
    expect(base()).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("берёт только заданные строки", () => {
    expect(base({ indices: [0, 3, 4] })).toEqual([0, 300, 400]);
  });

  it("центрирует строку разной высоты во вьюпорте", () => {
    const metrics = createMetrics([100, 300, 100, 100, 100, 100, 100, 100]);

    // Строка 1: позиция 100, высота 300 — центр 250, вьюпорт 500 → 0.
    // Строка 2: позиция 400, высота 100 — центр 450 → 200.
    expect(
      computeSnapOffsets({
        metrics,
        indices: [1, 2, 3],
        contentOrigin: 0,
        scrollLength: SCROLL_LENGTH,
        maxScroll: 500,
        align: "center",
        offset: 0,
      }),
    ).toEqual([0, 200, 300]);
  });

  it("прижимает строку к концу вьюпорта", () => {
    // Строка 6: низ на 700 — смещение 200.
    expect(base({ indices: [6, 7], align: "end" })).toEqual([200, 300]);
  });

  it("учитывает шапку и сдвиг под навбар", () => {
    expect(
      base({ indices: [1, 2], contentOrigin: 60, offset: 40, maxScroll: 560 }),
    ).toEqual([120, 220]);
  });

  it("пропускает индексы за пределами данных", () => {
    expect(base({ indices: [-1, 2, 42] })).toEqual([200]);
  });
});

describe("haveSameSnapOffsets", () => {
  it("сравнивает по значениям, а не по ссылке", () => {
    expect(haveSameSnapOffsets([0, 100], [0, 100])).toBe(true);
    expect(haveSameSnapOffsets([0, 100], [0, 101])).toBe(false);
    expect(haveSameSnapOffsets(undefined, undefined)).toBe(true);
    expect(haveSameSnapOffsets([0], undefined)).toBe(false);
  });
});
