import {
  MEASURE_OFFSCREEN,
  resolveContainerPlacement,
  roundLayout,
} from "../container-placement";

const place = (overrides = {}) =>
  resolveContainerPlacement({
    pending: false,
    stickyEdge: null,
    position: 1000,
    size: 100,
    viewportTop: 900,
    viewportEnd: 1400,
    ...overrides,
  });

describe("roundLayout", () => {
  it("срезает шум последних битов float", () => {
    // Иначе каждый контейнер перерисовывался бы на каждом измерении.
    expect(roundLayout(259.99999999999997)).toBe(260);
    expect(roundLayout(120.456)).toBe(120.46);
  });
});

describe("resolveContainerPlacement — обычная строка", () => {
  it("округляет позицию и размер", () => {
    const placement = place({ position: 999.99999, size: 100.004 });

    expect(placement.position).toBe(1000);
    expect(placement.size).toBe(100);
  });

  it("не подрезает строку в кадре", () => {
    // Обрезанное содержимое заметнее любого наползания: тень и выступающие
    // элементы рисуются за границами строки законно.
    expect(place().clipped).toBe(false);
  });

  it("подрезает строку целиком выше вьюпорта", () => {
    expect(place({ position: 700, size: 100 }).clipped).toBe(true);
  });

  it("подрезает строку целиком ниже вьюпорта", () => {
    expect(place({ position: 1400 }).clipped).toBe(true);
  });

  it("не подрезает строку, задевающую кромку", () => {
    expect(place({ position: 850, size: 100 }).clipped).toBe(false);
    expect(place({ position: 1399 }).clipped).toBe(false);
  });

  it("подрезает строку, ровно упирающуюся в верхнюю кромку", () => {
    expect(place({ position: 800, size: 100 }).clipped).toBe(true);
  });
});

describe("resolveContainerPlacement — особые случаи", () => {
  it("уводит ожидающего измерения за пределы контента", () => {
    // Подрезанный контейнер отдал бы высоту подрезки, и элемент навсегда
    // остался бы нулевым.
    const placement = place({ pending: true });

    expect(placement.position).toBe(MEASURE_OFFSCREEN);
    expect(placement.clipped).toBe(false);
  });

  it("не подрезает прилипающий элемент даже далеко за кадром", () => {
    // Аватар группы держится у кромки, когда сама группа ушла вверх.
    expect(place({ position: 0, stickyEdge: "end" }).clipped).toBe(false);
    expect(place({ position: 9000, stickyEdge: "start" }).clipped).toBe(false);
  });

  it("отдаёт настоящий размер ожидающему", () => {
    expect(place({ pending: true, size: 92.4 }).size).toBe(92.4);
  });
});
