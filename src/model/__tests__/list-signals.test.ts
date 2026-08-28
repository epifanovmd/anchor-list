import { INITIAL_SIGNALS, POSITION_OUT_OF_VIEW } from "../list-signals";

describe("сигналы списка", () => {
  it("считает список стоящим в начале до первой раскладки", () => {
    expect(INITIAL_SIGNALS.isAtStart).toBe(true);
    expect(INITIAL_SIGNALS.isNearStart).toBe(true);
    expect(INITIAL_SIGNALS.isAtEnd).toBe(false);
    expect(INITIAL_SIGNALS.isNearEnd).toBe(false);
  });

  it("не показывает список до первого готового кадра", () => {
    // Иначе виден скачок с оценочных размеров на измеренные.
    expect(INITIAL_SIGNALS.readyToRender).toBe(false);
  });

  it("начинает без контента, контейнеров и компенсации", () => {
    expect(INITIAL_SIGNALS.totalSize).toBe(0);
    expect(INITIAL_SIGNALS.numContainers).toBe(0);
    expect(INITIAL_SIGNALS.scrollAdjust).toBe(0);
    expect(INITIAL_SIGNALS.scrollLength).toBe(0);
  });

  it("считает, что якорей прилипания нет", () => {
    expect(INITIAL_SIGNALS.activeStickyStartIndex).toBe(-1);
    expect(INITIAL_SIGNALS.activeStickyEndIndex).toBe(-1);
  });

  it("начинает без геометрии контента", () => {
    expect(INITIAL_SIGNALS.contentSize).toBe(0);
    expect(INITIAL_SIGNALS.maxScroll).toBe(0);
    expect(INITIAL_SIGNALS.headerSize).toBe(0);
    expect(INITIAL_SIGNALS.footerSize).toBe(0);
    expect(INITIAL_SIGNALS.scrollSize).toEqual({ width: 0, height: 0 });
  });

  it("считает, что видимых элементов ещё нет", () => {
    expect(INITIAL_SIGNALS.firstVisibleIndex).toBe(-1);
    expect(INITIAL_SIGNALS.lastVisibleIndex).toBe(-1);
  });

  it("начинает без движения и на нулевых расстояниях", () => {
    expect(INITIAL_SIGNALS.velocity).toBe(0);
    expect(INITIAL_SIGNALS.distanceFromStart).toBe(0);
    expect(INITIAL_SIGNALS.distanceFromEnd).toBe(0);
  });

  it("уводит контейнер туда, куда скролл не доходит", () => {
    // Контейнер без привязки не размонтируется — он ждёт следующего элемента.
    expect(POSITION_OUT_OF_VIEW).toBeLessThan(-1000000);
  });
});
