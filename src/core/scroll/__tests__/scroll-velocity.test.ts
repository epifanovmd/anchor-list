import { ScrollVelocityTracker } from "../scroll-velocity";

describe("ScrollVelocityTracker", () => {
  it("не знает скорости по одной точке", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(0, 0);

    expect(tracker.get(0)).toBe(0);
  });

  it("считает движение к концу списка положительным", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(0, 0);
    tracker.add(100, 100);

    expect(tracker.get(100)).toBeCloseTo(1);
  });

  it("считает движение к началу списка отрицательным", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(100, 0);
    tracker.add(0, 100);

    expect(tracker.get(100)).toBeCloseTo(-1);
  });

  it("обрывает историю на смене направления", () => {
    const tracker = new ScrollVelocityTracker();

    // Быстро вниз, затем разворот вверх: после разворота скорость обязана
    // показывать новую сторону, иначе буфер отрисовки уезжает не туда.
    tracker.add(0, 0);
    tracker.add(500, 100);
    tracker.add(400, 200);

    expect(tracker.get(200)).toBeLessThan(0);
  });

  it("затухает на паузе", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(0, 0);
    tracker.add(100, 100);

    // Последняя точка старше окна — скорость больше не значит ничего.
    expect(tracker.get(5000)).toBe(0);
  });

  it("весит свежие точки больше старых", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(0, 0);
    tracker.add(10, 100);
    tracker.add(210, 200);

    // Последний отрезок вдвое быстрее: среднее ближе к нему, чем к простому.
    expect(tracker.get(200)).toBeGreaterThan(1.05);
  });

  it("пропускает точки без движения", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(100, 0);
    tracker.add(100, 100);

    expect(tracker.get(100)).toBe(0);
  });

  it("забывает историю после сброса", () => {
    const tracker = new ScrollVelocityTracker();

    tracker.add(0, 0);
    tracker.add(100, 100);
    tracker.reset();

    expect(tracker.get(100)).toBe(0);
  });

  it("держит ограниченное окно точек", () => {
    const tracker = new ScrollVelocityTracker();

    for (let index = 0; index <= 30; index++) {
      tracker.add(index * 10, index * 10);
    }

    expect(tracker.get(300)).toBeCloseTo(1);
  });
});
