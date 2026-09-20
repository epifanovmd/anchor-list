import { POSITION_OUT_OF_VIEW } from "../../../model";
import type { IItemVisibilityParams } from "../item-visibility";
import { getItemVisibility } from "../item-visibility";

const VIEWPORT = 500;

const visibilityOf = (overrides: Partial<IItemVisibilityParams>): number =>
  getItemVisibility({
    position: 0,
    size: 100,
    scroll: 0,
    contentOrigin: 0,
    scrollLength: VIEWPORT,
    insetEnd: 0,
    shift: 0,
    ...overrides,
  });

describe("getItemVisibility — доля строки во вьюпорте", () => {
  it("целиком во вьюпорте — единица", () => {
    expect(visibilityOf({ position: 200 })).toBe(1);
  });

  it("целиком за кромкой — ноль", () => {
    expect(visibilityOf({ position: 600 })).toBe(0);
    expect(visibilityOf({ position: 200, scroll: 400 })).toBe(0);
  });

  it("считает долю строки, а не вьюпорта", () => {
    // Строка в 100 точек уходит за верхнюю кромку на 25: видно три четверти.
    expect(visibilityOf({ position: 0, scroll: 25 })).toBe(0.75);
    // Строка выезжает снизу: у нижней кромки на 450 видно первые 50 точек.
    expect(visibilityOf({ position: 450 })).toBe(0.5);
  });

  it("считает от начала координат контента: шапка сдвигает всё", () => {
    // Шапка в 100 точек: строка на позиции 0 лежит на 100 в контенте.
    expect(visibilityOf({ position: 0, contentOrigin: 100, scroll: 150 })).toBe(
      0.5,
    );
  });

  it("не считает видимым то, что под нижним отступом", () => {
    // Панель ввода в 200 точек закрывает низ вьюпорта: видимый конец на 300,
    // и строка на 250..350 наполовину под панелью.
    expect(visibilityOf({ position: 250, insetEnd: 200 })).toBe(0.5);
    expect(visibilityOf({ position: 300, insetEnd: 200 })).toBe(0);
  });

  it("учитывает сдвиг строки: прилипший якорь и прижатый к концу контент", () => {
    // Строка на 600 сдвинута прилипанием на -200: на экране она на 400..500.
    expect(visibilityOf({ position: 600, shift: -200 })).toBe(1);
  });

  it("у отведённого за экран контейнера — ноль", () => {
    expect(visibilityOf({ position: POSITION_OUT_OF_VIEW })).toBe(0);
  });

  it("у строки без размера — ноль, а не деление на ноль", () => {
    expect(visibilityOf({ size: 0 })).toBe(0);
  });

  it("не выходит за пределы [0, 1] при отрицательном смещении", () => {
    expect(visibilityOf({ position: 0, scroll: -50 })).toBe(1);
  });
});
