import { getScrollIndicatorInsets } from "../scroll-indicator";

describe("getScrollIndicatorInsets", () => {
  it("отодвигает индикатор на нижний отступ контента", () => {
    // Иначе индикатор идёт до самого низа экрана, а контент — до панели ввода.
    expect(getScrollIndicatorInsets(96)).toEqual({
      top: 0,
      left: 0,
      bottom: 96,
      right: 0,
    });
  });

  it("не трогает остальные стороны", () => {
    const insets = getScrollIndicatorInsets(96);

    expect(insets.top).toBe(0);
    expect(insets.left).toBe(0);
    expect(insets.right).toBe(0);
  });

  it("не уводит индикатор за пределы вьюпорта", () => {
    // Отрицательный инсет сдвинул бы индикатор ниже кромки экрана.
    expect(getScrollIndicatorInsets(-40).bottom).toBe(0);
  });

  it("обходится без отступа", () => {
    expect(getScrollIndicatorInsets(0).bottom).toBe(0);
  });
});
