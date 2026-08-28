import { shouldMeasureOnBind, shouldMeasureOnLayout } from "../measure-gate";

describe("shouldMeasureOnLayout", () => {
  it("меряет, пока замера ещё не было", () => {
    expect(shouldMeasureOnLayout(92, undefined)).toBe(true);
  });

  it("пропускает событие с той же высотой, что вернул замер", () => {
    expect(shouldMeasureOnLayout(92, 92)).toBe(false);
  });

  it("пропускает субпиксельное расхождение", () => {
    expect(shouldMeasureOnLayout(92.4, 92)).toBe(false);
  });

  it("меряет, когда высота изменилась", () => {
    expect(shouldMeasureOnLayout(120, 92)).toBe(true);
  });
});

describe("shouldMeasureOnBind", () => {
  it("меряет новый элемент, размер которого неизвестен", () => {
    expect(
      shouldMeasureOnBind({
        keyChanged: true,
        dataChanged: true,
        hasKnownSize: false,
      }),
    ).toBe(true);
  });

  it("не меряет элемент с уже известным размером", () => {
    expect(
      shouldMeasureOnBind({
        keyChanged: true,
        dataChanged: true,
        hasKnownSize: true,
      }),
    ).toBe(false);
  });

  it("меряет, когда у того же элемента сменились данные", () => {
    expect(
      shouldMeasureOnBind({
        keyChanged: false,
        dataChanged: true,
        hasKnownSize: true,
      }),
    ).toBe(true);
  });

  it("не меряет, когда не изменилось ничего", () => {
    expect(
      shouldMeasureOnBind({
        keyChanged: false,
        dataChanged: false,
        hasKnownSize: false,
      }),
    ).toBe(false);
  });
});
