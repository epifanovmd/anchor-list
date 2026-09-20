import { ItemSizes } from "../item-sizes";
import { ListMetrics } from "../list-metrics";
import { AnchorListSizeCache, createAnchorListSizeCache } from "../size-cache";

describe("AnchorListSizeCache — хранилище", () => {
  it("создаётся пустым и отдаёт то, что в него положили", () => {
    const cache = createAnchorListSizeCache();

    expect(cache).toBeInstanceOf(AnchorListSizeCache);
    expect(cache.size).toBe(0);

    cache.set("a", 42);

    expect(cache.get("a")).toBe(42);
    expect(cache.has("a")).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("забывает ключ и очищается целиком", () => {
    const cache = createAnchorListSizeCache();

    cache.set("a", 1);
    cache.set("b", 2);
    cache.delete("a");

    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();

    expect(cache.size).toBe(0);
  });
});

describe("ItemSizes — кэш измерений", () => {
  it("читает измеренный размер из кэша: строку измерили в прошлой жизни списка", () => {
    const cache = createAnchorListSizeCache();

    cache.set("a", 42);

    const sizes = new ItemSizes({ estimatedItemSize: 100, sizeCache: cache });

    expect(sizes.isKnown("a")).toBe(true);
    expect(sizes.getKnown("a")).toBe(42);
    expect(sizes.resolve("a", "")).toBe(42);
  });

  it("пишет каждый замер в кэш", () => {
    const cache = createAnchorListSizeCache();
    const sizes = new ItemSizes({ estimatedItemSize: 100, sizeCache: cache });

    sizes.setMeasured("a", 42, "");

    expect(cache.get("a")).toBe(42);
  });

  it("не кладёт в кэш объявленный размер: его задаёт проп, а не замер", () => {
    const cache = createAnchorListSizeCache();
    const sizes = new ItemSizes({ estimatedItemSize: 100, sizeCache: cache });

    sizes.setFixed("a", 42);

    expect(cache.has("a")).toBe(false);
  });

  it("не считает строку из кэша ожидающей замера", () => {
    // Ожидающая строка не занимает места до измерения. Строка из кэша измерена
    // — пусть и в прошлой жизни списка — и место занимает сразу.
    const cache = createAnchorListSizeCache();

    cache.set("a", 42);

    const sizes = new ItemSizes({ estimatedItemSize: 100, sizeCache: cache });

    expect(sizes.markPending("a")).toBe(false);
    expect(sizes.resolve("a", "")).toBe(42);
  });

  it("принимает свежий замер поверх устаревшего кэша", () => {
    // Кэш пережил смену ширины экрана или размера шрифта: строка стала другой.
    // Первый же замер обязан заменить кэш, а не отклониться как «уже известно».
    const cache = createAnchorListSizeCache();

    cache.set("a", 42);

    const sizes = new ItemSizes({ estimatedItemSize: 100, sizeCache: cache });

    expect(sizes.willResize("a", 60)).toBe(true);
    expect(sizes.setMeasured("a", 60, "")).toBe(true);
    expect(cache.get("a")).toBe(60);
  });

  it("два списка над одним кэшем видят замеры друг друга", () => {
    const cache = createAnchorListSizeCache();
    const first = new ListMetrics({ estimatedItemSize: 100, sizeCache: cache });
    const second = new ListMetrics({
      estimatedItemSize: 100,
      sizeCache: cache,
    });

    first.setItems(["a", "b"], ["", ""]);
    second.setItems(["a", "b"], ["", ""]);
    first.setMeasuredSize("b", 30);

    expect(second.hasMeasured("b")).toBe(true);
    expect(second.getPosition(1)).toBe(100);
    expect(second.getTotalSize()).toBe(130);
  });
});
