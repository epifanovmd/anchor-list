import { isPastCompensationSpeed } from "../compensation-gate";

const SCROLL_LENGTH = 500;

describe("isPastCompensationSpeed", () => {
  it("не считает броском чтение пальцем", () => {
    // Один-два пикселя в миллисекунду — обычная прокрутка.
    expect(isPastCompensationSpeed(2, SCROLL_LENGTH)).toBe(false);
  });

  it("считает броском скорость, сменяющую вьюпорт за два кадра", () => {
    expect(isPastCompensationSpeed(25, SCROLL_LENGTH)).toBe(true);
  });

  it("смотрит на модуль: бросок вверх ничем не отличается от броска вниз", () => {
    expect(isPastCompensationSpeed(-25, SCROLL_LENGTH)).toBe(true);
  });

  it("без известного вьюпорта решать не берётся", () => {
    // Порог задан в экранах: пока экран не измерен, сравнивать не с чем.
    expect(isPastCompensationSpeed(1000, 0)).toBe(false);
  });

  it("порог считается от вьюпорта, а не от абсолютной скорости", () => {
    // Та же скорость на экране вчетверо длиннее — уже не бросок.
    expect(isPastCompensationSpeed(25, 2000)).toBe(false);
  });
});
