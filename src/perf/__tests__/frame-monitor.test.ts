import { FrameMonitor } from "../frame-monitor";

/**
 * Кадры двигаются вручную: в node их никто не рисует, а замер обязан считать
 * ровно то, что ему подсунули.
 */
const runFrames = (monitor: FrameMonitor, durations: number[]) => {
  let now = 0;

  jest.spyOn(performance, "now").mockImplementation(() => now);

  const frames: FrameRequestCallback[] = [];

  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    frames.push(callback);

    return frames.length;
  };

  monitor.start();

  for (const duration of durations) {
    now += duration;
    frames.pop()!(now);
  }
};

describe("FrameMonitor", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("считает медиану и p95 по длительностям кадров", () => {
    const monitor = new FrameMonitor();

    // Восемнадцать ровных кадров и два провала: среднее такие провалы утопили
    // бы в общей массе, а p95 обязан их показать.
    runFrames(monitor, [...Array.from({ length: 18 }, () => 16), 120, 120]);

    const stats = monitor.take();

    expect(stats.frames).toBe(20);
    expect(stats.medianMs).toBe(16);
    expect(stats.p95Ms).toBe(120);
    expect(stats.worstMs).toBe(120);
    expect(stats.longFrames).toBe(2);
  });

  it("обнуляет окно после снятия статистики", () => {
    const monitor = new FrameMonitor();

    runFrames(monitor, [16, 16, 90]);
    monitor.take();

    const empty = monitor.take();

    expect(empty).toEqual({
      frames: 0,
      longFrames: 0,
      worstMs: 0,
      medianMs: 0,
      p95Ms: 0,
    });
  });
});
