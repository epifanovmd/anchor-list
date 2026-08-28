import { ListMetrics } from "../../../model";
import {
  computeVisibleRange,
  EMPTY_RANGE,
  isOverrunning,
} from "../visible-range";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

const createMetrics = (count = 40, sizes?: number[]) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  if (sizes)
    keys.forEach((key, index) => metrics.setFixedSize(key, sizes[index]!));

  return metrics;
};

const range = (metrics: ListMetrics, scroll: number, drawDistance = 0) =>
  computeVisibleRange({
    metrics,
    scroll,
    scrollLength: SCROLL_LENGTH,
    drawDistance,
  });

describe("computeVisibleRange", () => {
  it("отдаёт пустой диапазон на пустом списке", () => {
    const metrics = createMetrics(0);

    expect(range(metrics, 0)).toEqual(EMPTY_RANGE);
  });

  it("находит элементы, пересёкшие вьюпорт", () => {
    const metrics = createMetrics();

    // Вьюпорт 1000..1500 — это k10..k14; k15 начинается ровно на кромке и
    // видимым не считается, но контейнер под него уже держится.
    expect(range(metrics, 1000)).toEqual({
      start: 10,
      end: 14,
      startBuffered: 10,
      endBuffered: 15,
    });
  });

  it("считает видимой частично попавшую строку", () => {
    const metrics = createMetrics();

    // Вьюпорт 1050..1550: у k10 виден низ, у k15 — верх.
    expect(range(metrics, 1050)).toMatchObject({ start: 10, end: 15 });
  });

  it("расширяет диапазон буфером по обе стороны", () => {
    const metrics = createMetrics();

    // Элемент монтируется и измеряется заранее, к моменту прихода скролла.
    expect(range(metrics, 1000, 250)).toEqual({
      start: 10,
      end: 14,
      startBuffered: 7,
      endBuffered: 17,
    });
  });

  it("не уходит буфером выше начала контента", () => {
    const metrics = createMetrics();

    expect(range(metrics, 0, 250)).toMatchObject({
      start: 0,
      startBuffered: 0,
    });
  });

  it("не уходит буфером за конец контента", () => {
    const metrics = createMetrics(20);

    expect(range(metrics, 1500, 250)).toMatchObject({
      end: 19,
      endBuffered: 19,
    });
  });

  it("держит пустой видимый диапазон, когда вьюпорт за пределами контента", () => {
    const metrics = createMetrics(5);

    // Скролл ушёл ниже всего контента: буфер есть, видимого нет.
    const result = range(metrics, 5000);

    expect(result.end).toBeLessThan(result.start);
    expect(result.startBuffered).toBe(4);
  });

  it("справляется с разнородными высотами", () => {
    const metrics = createMetrics(5, [50, 400, 30, 900, 100]);

    // Вьюпорт 400..900: k1 кончается на 450, k2 — 480, k3 идёт до 1380.
    expect(range(metrics, 400)).toMatchObject({ start: 1, end: 3 });
  });

  it("схлопывает нулевые строки в одну точку", () => {
    const metrics = createMetrics(4, [100, 0, 0, 100]);

    // Ожидающие измерения места не занимают: сами в диапазон они не попадут.
    expect(range(metrics, 0)).toMatchObject({ start: 0, end: 3 });
  });
});

describe("computeVisibleRange — запас по скорости", () => {
  const metrics = createMetrics(40);

  const rangeAt = (velocity: number) =>
    computeVisibleRange({
      metrics,
      scroll: 1000,
      scrollLength: 500,
      drawDistance: 100,
      velocity,
    });

  it("без скорости буфер симметричен", () => {
    const buffered = rangeAt(0);

    // Вьюпорт 1000…1500, буфер по 100 в обе стороны; строка на самой границе
    // буфера в него входит.
    expect(buffered.startBuffered).toBe(9);
    expect(buffered.endBuffered).toBe(16);
  });

  it("к концу списка расширяет буфер вперёд", () => {
    // 2 px/мс за 220 мс — 440 px сверх буфера.
    const buffered = rangeAt(2);

    expect(buffered.endBuffered).toBe(20);
    expect(buffered.startBuffered).toBe(9);
  });

  it("к началу списка расширяет буфер назад", () => {
    const buffered = rangeAt(-2);

    expect(buffered.startBuffered).toBe(4);
    expect(buffered.endBuffered).toBe(16);
  });

  it("не растёт дальше полутора экранов", () => {
    // Иначе резкий бросок смонтировал бы сотни строк разом.
    const fast = rangeAt(50);
    const capped = rangeAt(10);

    expect(fast.endBuffered).toBe(capped.endBuffered);
    expect(fast.endBuffered).toBe(23);
  });
});

describe("isOverrunning", () => {
  it("на обычном броске запас остаётся", () => {
    expect(isOverrunning(100, 700)).toBe(false);
  });

  it("на быстром броске, который список ещё вывозит, запас остаётся", () => {
    expect(isOverrunning(240, 700)).toBe(false);
  });

  it("на скрабе запас снимается", () => {
    expect(isOverrunning(400, 700)).toBe(true);
  });

  it("направление движения роли не играет", () => {
    expect(isOverrunning(-400, 700)).toBe(true);
  });

  it("до замера вьюпорта решать не по чему", () => {
    expect(isOverrunning(400, 0)).toBe(false);
  });
});
