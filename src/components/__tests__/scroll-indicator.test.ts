import { getScrollIndicatorInsets } from "../scroll-indicator";

describe("getScrollIndicatorInsets", () => {
  it("отодвигает индикатор на нижний отступ контента", () => {
    // Иначе индикатор идёт до самого низа экрана, а контент — до панели ввода.
    expect(getScrollIndicatorInsets(96, false)).toEqual({
      top: 0,
      left: 0,
      bottom: 96,
      right: 0,
    });
  });

  it("не трогает остальные стороны", () => {
    const insets = getScrollIndicatorInsets(96, false);

    expect(insets.top).toBe(0);
    expect(insets.left).toBe(0);
    expect(insets.right).toBe(0);
  });

  it("не уводит индикатор за пределы вьюпорта", () => {
    // Отрицательный инсет сдвинул бы индикатор ниже кромки экрана.
    expect(getScrollIndicatorInsets(-40, false).bottom).toBe(0);
  });

  it("обходится без отступа", () => {
    expect(getScrollIndicatorInsets(0, false).bottom).toBe(0);
  });

  it("в горизонтальном списке отступ уходит вправо", () => {
    // Индикатор горизонтального списка идёт вдоль нижней кромки, и укоротить
    // его можно только справа: нижний инсет сдвинул бы его от неё, а до конца
    // контента он всё равно доходил бы.
    expect(getScrollIndicatorInsets(96, true)).toEqual({
      top: 0,
      left: 0,
      bottom: 0,
      right: 96,
    });
  });

  it("горизонтальный отступ так же не уводит индикатор наружу", () => {
    expect(getScrollIndicatorInsets(-40, true).right).toBe(0);
  });
});
