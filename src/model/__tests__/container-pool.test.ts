import type { IContainerRequest } from "../container-pool";
import { ContainerPool } from "../container-pool";

const request = (index: number, key: string, type = ""): IContainerRequest => ({
  index,
  key,
  type,
  stickyEdge: null,
});

describe("ContainerPool", () => {
  it("выделяет контейнер под каждый элемент", () => {
    const pool = new ContainerPool();

    const result = pool.allocate([request(0, "a"), request(1, "b")]);

    expect(result.count).toBe(2);
    expect(result.changed).toHaveLength(2);
    expect(pool.getContainerByKey("a")).toBe(0);
    expect(pool.getContainerByKey("b")).toBe(1);
    expect(pool.getCount()).toBe(2);
  });

  it("сохраняет привязку, если элемент остался в диапазоне", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a"), request(1, "b")]);

    const containerForA = pool.getContainerByKey("a");
    const result = pool.allocate([request(0, "a"), request(1, "b")]);

    expect(result.changed).toHaveLength(0);
    expect(pool.getContainerByKey("a")).toBe(containerForA);
  });

  it("переиспользует контейнер, освободившийся при прокрутке", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a"), request(1, "b")]);

    const result = pool.allocate([request(1, "b"), request(2, "c")]);

    // "a" ушёл из диапазона, его контейнер забрал "c" — новых не создано.
    expect(result.count).toBe(2);
    expect(result.released).toEqual([0]);
    expect(pool.getContainerByKey("c")).toBe(0);
  });

  it("предпочитает свободный контейнер того же типа", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "text1", "text"), request(1, "photo1", "photo")]);

    const textContainer = pool.getContainerByKey("text1")!;
    const photoContainer = pool.getContainerByKey("photo1")!;

    pool.allocate([]);
    pool.allocate([request(2, "photo2", "photo")]);

    expect(pool.getContainerByKey("photo2")).toBe(photoContainer);
    expect(pool.getContainerByKey("photo2")).not.toBe(textContainer);
  });

  it("не меняет обычный контейнер на sticky-структуру", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "plain", "message")]);
    pool.allocate([]);
    const result = pool.allocate([
      { ...request(1, "sticky", "message"), stickyEdge: "end" },
    ]);

    // Свободный контейнер под sticky не пошёл — пул завёл второй.
    expect(result.count).toBe(2);
    expect(pool.getContainerByKey("sticky")).toBe(1);
  });

  it("обновляет индекс при сдвиге данных без смены контейнера", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a")]);

    const container = pool.getContainerByKey("a");
    const result = pool.allocate([request(5, "a")]);

    expect(pool.getContainerByKey("a")).toBe(container);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.index).toBe(5);
  });

  it("замечает смену кромки прилипания без смены элемента", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a")]);

    const result = pool.allocate([{ ...request(0, "a"), stickyEdge: "start" }]);

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.stickyEdge).toBe("start");
    expect(pool.getBinding(0)!.stickyEdge).toBe("start");
  });

  it("освобождает все контейнеры на пустом диапазоне", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a"), request(1, "b")]);

    const result = pool.allocate([]);

    expect(result.released).toHaveLength(2);
    expect(pool.getContainerByKey("a")).toBeUndefined();
    expect(pool.getBinding(0)).toBeUndefined();
  });

  it("после сброса заново раздаёт существующие контейнеры", () => {
    const pool = new ContainerPool();

    pool.allocate([request(0, "a"), request(1, "b")]);
    pool.reset();

    expect(pool.getContainerByKey("a")).toBeUndefined();

    const result = pool.allocate([request(0, "x"), request(1, "y")]);

    // Контейнеры переиспользованы, новых не заведено.
    expect(result.count).toBe(2);
  });
});
