import { MIN_SHIFT, solveShift } from "../shift-solver";

const SCROLL_LENGTH = 500;
/** Контента заведомо больше, чем нужно: границы в расчёт не вмешиваются. */
const LONG_CONTENT = 100000;

const solve = (input: Partial<Parameters<typeof solveShift>[0]>) =>
  solveShift({
    scroll: 1000,
    moved: 0,
    residual: 0,
    contentSize: LONG_CONTENT,
    scrollLength: SCROLL_LENGTH,
    ...input,
  });

describe("solveShift — обычный случай", () => {
  it("сдвигает ровно на то, на сколько уехал якорь", () => {
    const solution = solve({ moved: 300 });

    expect(solution.applied).toBe(300);
    expect(solution.target).toBe(1300);
    expect(solution.residual).toBe(0);
    expect(solution.lost).toBe(0);
    expect(solution.pulledByScrollView).toBe(0);
  });

  it("компенсирует удаление выше вьюпорта", () => {
    const solution = solve({ moved: -200 });

    expect(solution.applied).toBe(-200);
    expect(solution.target).toBe(800);
  });

  it("ничего не двигает, когда якорь остался на месте", () => {
    const solution = solve({ moved: 0 });

    expect(solution.applied).toBe(0);
    expect(Math.abs(solution.applied) < MIN_SHIFT).toBe(true);
  });
});

describe("solveShift — доли точки", () => {
  it("округляет сдвиг до целых точек", () => {
    // iOS отбрасывает смещение кадра меньше 0.5pt, Android считает кадр целым.
    const solution = solve({ moved: 12.4 });

    expect(solution.applied).toBe(12);
    expect(solution.residual).toBeCloseTo(0.4);
  });

  it("копит остаток, пока он не соберётся в точку", () => {
    let residual = 0;
    let applied = 0;

    for (let pass = 0; pass < 5; pass++) {
      const solution = solve({ moved: 0.4, residual });

      residual = solution.residual;
      applied += solution.applied;
    }

    // Пять шагов по 0.4 — это два целых пикселя, и потеряться они не должны.
    expect(applied).toBe(2);
  });

  it("учитывает накопленный остаток в текущем сдвиге", () => {
    const solution = solve({ moved: 0.6, residual: 0.6 });

    expect(solution.wanted).toBeCloseTo(1.2);
    expect(solution.applied).toBe(1);
    expect(solution.residual).toBeCloseTo(0.2);
  });

  it("может дать остаток в минус при округлении вверх", () => {
    const solution = solve({ moved: 0.6 });

    expect(solution.applied).toBe(1);
    expect(solution.residual).toBeCloseTo(-0.4);
  });
});

describe("solveShift — границы контента", () => {
  it("не повторяет сдвиг, который ScrollView сделает сам у конца", () => {
    // 20 элементов по 100 при вьюпорте 500: конец списка на 1500. Контент стал
    // короче на 300, и смещение к новой границе ScrollView подтянет сам.
    const solution = solve({
      scroll: 1500,
      moved: -300,
      contentSize: 1700,
    });

    expect(solution.settled).toBe(1200);
    expect(solution.pulledByScrollView).toBe(-300);
    expect(solution.applied).toBe(0);
  });

  it("упирается в конец контента и сбрасывает остаток", () => {
    const solution = solve({
      scroll: 1000,
      moved: 400,
      residual: 0.4,
      contentSize: 1600,
    });

    // Дальше 1100 скролл не уходит: 1600 контента при вьюпорте 500.
    expect(solution.maxScroll).toBe(1100);
    expect(solution.target).toBe(1100);
    expect(solution.applied).toBe(100);
    expect(solution.lost).toBeCloseTo(300.4);
    // У границы доводить уже нечего.
    expect(solution.residual).toBe(0);
  });

  it("упирается в начало контента", () => {
    const solution = solve({ scroll: 100, moved: -400 });

    expect(solution.target).toBe(0);
    expect(solution.applied).toBe(-100);
    expect(solution.lost).toBe(-300);
    expect(solution.residual).toBe(0);
  });

  it("считает границей ноль, когда контент короче вьюпорта", () => {
    const solution = solve({ scroll: 0, moved: 200, contentSize: 300 });

    expect(solution.maxScroll).toBe(0);
    expect(solution.target).toBe(0);
    expect(solution.applied).toBe(0);
  });

  it("совмещает подтяжку границей и собственный сдвиг", () => {
    // Скролл за новой границей на 300, а якорь уехал ещё на 100 вверх.
    const solution = solve({
      scroll: 1500,
      moved: -400,
      contentSize: 1700,
    });

    expect(solution.settled).toBe(1200);
    expect(solution.target).toBe(1100);
    expect(solution.applied).toBe(-100);
  });
});
