import {
  createListPerfWindow,
  formatListPerfReport,
  mergeListPerfWindow,
} from "../index";

const report = (
  fill: (window: ReturnType<typeof createListPerfWindow>) => void,
) => {
  const window = createListPerfWindow();

  fill(window);

  return formatListPerfReport({
    label: "наш",
    title: "окно",
    durationMs: 1000,
    frames: { frames: 58, longFrames: 3, worstMs: 48.2 },
    window,
  });
};

describe("formatListPerfReport", () => {
  it("печатает кадры всегда, остальные разделы — только с данными", () => {
    const lines = report(() => undefined).split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("[list·наш] окно 1.0с");
    expect(lines[1]).toBe("  кадры     58fps · длинных 3 · худший 48мс");
  });

  it("считает среднее и максимум по каждой величине", () => {
    const text = report(window => {
      window.counters.scrollEvents = 2;
      window.stats.scrollPx = { count: 2, sum: 300, max: 200 };
      window.stats.lagPx = { count: 2, sum: 100, max: 80 };
    });

    expect(text).toContain("2 соб · 300px · лаг 50/80px");
  });

  it("отмечает отсутствие пустот, когда проходы были", () => {
    const text = report(window => {
      window.counters.rangeCalc = 4;
      window.stats.rangeMs = { count: 4, sum: 2, max: 0.8 };
      window.stats.windowItems = { count: 4, sum: 40, max: 11 };
      window.stats.containers = { count: 4, sum: 100, max: 27 };
    });

    expect(text).toContain("пустоты   нет");
  });

  it("нормирует рендеры на пройденное расстояние", () => {
    const text = report(window => {
      window.counters.renderItem = 40;
      window.stats.scrollPx = { count: 1, sum: 2000, max: 2000 };
    });

    expect(text).toContain("на 1000px 20");
  });
});

describe("mergeListPerfWindow", () => {
  it("складывает суммы и берёт больший максимум", () => {
    const target = createListPerfWindow();
    const source = createListPerfWindow();

    target.counters.rebind = 3;
    target.stats.blankPx = { count: 1, sum: 10, max: 10 };
    source.counters.rebind = 4;
    source.stats.blankPx = { count: 2, sum: 30, max: 25 };

    mergeListPerfWindow(target, source);

    expect(target.counters.rebind).toBe(7);
    expect(target.stats.blankPx).toEqual({ count: 3, sum: 40, max: 25 });
  });
});
