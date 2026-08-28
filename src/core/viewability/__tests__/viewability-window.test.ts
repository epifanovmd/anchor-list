import { ListMetrics } from "../../../model";
import { collectViewableKeys } from "../viewability-window";

const ITEM_SIZE = 100;
const ITEM_COUNT = 10;
const SCROLL_LENGTH = 500;

const createMetrics = (sizes?: number[]) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const count = sizes?.length ?? ITEM_COUNT;
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  if (sizes)
    keys.forEach((key, index) => metrics.setFixedSize(key, sizes[index]!));

  return metrics;
};

const context = (scroll: number, endBuffered = ITEM_COUNT - 1) => ({
  scroll,
  scrollLength: SCROLL_LENGTH,
  startBuffered: 0,
  endBuffered,
});

describe("collectViewableKeys", () => {
  it("берёт элементы, попавшие во вьюпорт", () => {
    const metrics = createMetrics();

    const viewable = collectViewableKeys(metrics, context(0), {
      itemVisiblePercentThreshold: 50,
    });

    // Вьюпорт 0..500 полностью накрывает пять элементов по 100.
    expect([...viewable]).toEqual(["k0", "k1", "k2", "k3", "k4"]);
  });

  it("учитывает порог по доле элемента", () => {
    const metrics = createMetrics();

    // Скролл 50: у k0 видно лишь половину — порога в 80% не хватает.
    const viewable = collectViewableKeys(metrics, context(50), {
      itemVisiblePercentThreshold: 80,
    });

    expect(viewable.has("k0")).toBe(false);
    expect(viewable.has("k1")).toBe(true);
  });

  it("считает видимым любой задетый элемент при нулевом пороге", () => {
    const metrics = createMetrics();

    const viewable = collectViewableKeys(metrics, context(50), {});

    expect(viewable.has("k0")).toBe(true);
  });

  it("учитывает порог по доле вьюпорта", () => {
    const metrics = createMetrics();

    // Элемент занимает 100 из 500 — ровно 20% вьюпорта.
    const viewable = collectViewableKeys(metrics, context(0), {
      viewAreaCoveragePercentThreshold: 25,
    });

    expect(viewable.size).toBe(0);
  });

  it("даёт крупному элементу пройти по доле вьюпорта", () => {
    // Элемент выше экрана: порог по его собственной доле недостижим.
    const metrics = createMetrics([1200, 100]);

    const byItem = collectViewableKeys(metrics, context(300, 1), {
      itemVisiblePercentThreshold: 60,
    });
    const byViewport = collectViewableKeys(metrics, context(300, 1), {
      viewAreaCoveragePercentThreshold: 60,
    });

    expect(byItem.has("k0")).toBe(false);
    expect(byViewport.has("k0")).toBe(true);
  });

  it("предпочитает порог покрытия порогу по элементу", () => {
    const metrics = createMetrics();

    const viewable = collectViewableKeys(metrics, context(0), {
      itemVisiblePercentThreshold: 0,
      viewAreaCoveragePercentThreshold: 25,
    });

    expect(viewable.size).toBe(0);
  });

  it("не выходит за буферизованный диапазон", () => {
    const metrics = createMetrics();

    // За его пределами элементы не смонтированы и видимыми быть не могут.
    const viewable = collectViewableKeys(metrics, context(0, 2), {
      itemVisiblePercentThreshold: 50,
    });

    expect([...viewable]).toEqual(["k0", "k1", "k2"]);
  });

  it("пропускает элементы за пределами экрана", () => {
    const metrics = createMetrics();

    const viewable = collectViewableKeys(metrics, context(900), {
      itemVisiblePercentThreshold: 50,
    });

    expect([...viewable]).toEqual(["k9"]);
  });

  it("не падает на нулевой высоте элемента", () => {
    const metrics = createMetrics([0, 100]);

    const viewable = collectViewableKeys(metrics, context(0, 1), {
      itemVisiblePercentThreshold: 50,
    });

    expect(viewable.has("k0")).toBe(false);
    expect(viewable.has("k1")).toBe(true);
  });

  it("не падает на неизмеренном вьюпорте", () => {
    const metrics = createMetrics();

    const viewable = collectViewableKeys(
      metrics,
      { scroll: 0, scrollLength: 0, startBuffered: 0, endBuffered: 9 },
      { viewAreaCoveragePercentThreshold: 10 },
    );

    expect(viewable.size).toBe(0);
  });
});
