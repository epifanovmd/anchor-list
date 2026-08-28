import type { IEdgeCheckContext } from "../edge-geometry";
import { getEdgeGeometry, isOutsideThreshold } from "../edge-geometry";

const context = (
  overrides: Partial<IEdgeCheckContext> = {},
): IEdgeCheckContext => ({
  scroll: 0,
  scrollLength: 500,
  contentSize: 5000,
  dataLength: 50,
  contentInsetEnd: 0,
  skipCallbacks: false,
  ...overrides,
});

describe("getEdgeGeometry", () => {
  it("считает расстояния до обеих кромок", () => {
    const geometry = getEdgeGeometry(context({ scroll: 1000 }));

    expect(geometry.distanceFromStart).toBe(1000);
    expect(geometry.distanceFromEnd).toBe(3500);
    expect(geometry.isContentShorter).toBe(false);
  });

  it("не считает распорку конца расстоянием до кромки", () => {
    // Иначе подгрузка срабатывала бы на пустом месте.
    const geometry = getEdgeGeometry(
      context({ scroll: 4100, contentInsetEnd: 300 }),
    );

    expect(geometry.distanceFromEnd).toBe(100);
  });

  it("замечает контент короче вьюпорта", () => {
    const geometry = getEdgeGeometry(context({ contentSize: 100 }));

    expect(geometry.isContentShorter).toBe(true);
  });

  it("отдаёт отрицательное расстояние при перелёте за конец", () => {
    const geometry = getEdgeGeometry(context({ scroll: 4600 }));

    expect(geometry.distanceFromEnd).toBe(-100);
  });
});

describe("isOutsideThreshold", () => {
  it("не считает покинутой точно достигнутую кромку", () => {
    // Стоять у самого конца короткого контента и «выйти за порог» нельзя.
    expect(isOutsideThreshold(1000, true, 250)).toBe(false);
  });

  it("требует выхода за порог с запасом", () => {
    // Без запаса достаточно дрогнуть на границе, чтобы защёлка снялась.
    expect(isOutsideThreshold(250, false, 250)).toBe(false);
    expect(isOutsideThreshold(320, false, 250)).toBe(false);
    expect(isOutsideThreshold(325, false, 250)).toBe(true);
  });

  it("считает расстояние по модулю", () => {
    expect(isOutsideThreshold(-325, false, 250)).toBe(true);
  });

  it("при нулевом пороге считает выходом любое ненулевое расстояние", () => {
    expect(isOutsideThreshold(0, false, 0)).toBe(false);
    expect(isOutsideThreshold(1, false, 0)).toBe(true);
  });
});
