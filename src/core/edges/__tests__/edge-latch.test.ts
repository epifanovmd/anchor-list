import { EdgeLatch } from "../edge-latch";

const CONTEXT = { contentSize: 5000, dataLength: 50 };

describe("EdgeLatch", () => {
  it("начинает несработавшей", () => {
    const latch = new EdgeLatch();

    expect(latch.isReached()).toBe(false);
    expect(latch.getSnapshot()).toBeUndefined();
  });

  it("молчит за пределами порога", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(1000, false, 250, CONTEXT, onReached);

    expect(onReached).not.toHaveBeenCalled();
    expect(latch.isReached()).toBe(false);
  });

  it("срабатывает один раз на вход в пороговую зону", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(200, false, 250, CONTEXT, onReached);
    expect(onReached).toHaveBeenCalledWith(200);

    // Событий скролла в зоне десятки в секунду — сеть на такое не рассчитана.
    latch.evaluate(150, false, 250, CONTEXT, onReached);
    latch.evaluate(100, false, 250, CONTEXT, onReached);

    expect(onReached).toHaveBeenCalledTimes(1);
    expect(latch.isReached()).toBe(true);
  });

  it("срабатывает у точно достигнутой кромки при любом пороге", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(1000, true, 0, CONTEXT, onReached);

    expect(onReached).toHaveBeenCalled();
  });

  it("молчит при нулевом пороге", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(0, false, 0, CONTEXT, onReached);

    expect(onReached).not.toHaveBeenCalled();
  });

  it("снимается только после выхода за порог с запасом", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(100, false, 250, CONTEXT, onReached);

    // Чуть дальше порога — защёлка держится, гистерезис не пройден.
    latch.evaluate(260, false, 250, CONTEXT, onReached);
    expect(latch.isReached()).toBe(true);

    latch.evaluate(400, false, 250, CONTEXT, onReached);
    expect(latch.isReached()).toBe(false);
    expect(latch.getSnapshot()).toBeUndefined();
  });

  it("срабатывает снова после возврата в зону", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(100, false, 250, CONTEXT, onReached);
    latch.evaluate(400, false, 250, CONTEXT, onReached);
    latch.evaluate(100, false, 250, CONTEXT, onReached);

    expect(onReached).toHaveBeenCalledTimes(2);
  });

  it("обновляет снимок, когда список изменился под порогом", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(100, false, 250, CONTEXT, onReached);
    latch.evaluate(
      100,
      false,
      250,
      { contentSize: 7000, dataLength: 70 },
      onReached,
    );

    // Колбэк повторно не уходит, но снимок обязан отражать новый список —
    // иначе следующая проверка сочтёт его выросшим ещё раз.
    expect(onReached).toHaveBeenCalledTimes(1);
    expect(latch.getSnapshot()).toMatchObject({
      contentSize: 7000,
      dataLength: 70,
    });
  });

  it("не трогает снимок, пока список тот же", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(100, false, 250, CONTEXT, onReached);

    const snapshot = latch.getSnapshot();

    latch.evaluate(120, false, 250, CONTEXT, onReached);

    expect(latch.getSnapshot()).toBe(snapshot);
  });

  it("сбрасывается по требованию", () => {
    const latch = new EdgeLatch();
    const onReached = jest.fn();

    latch.evaluate(100, false, 250, CONTEXT, onReached);
    latch.reset();

    latch.evaluate(100, false, 250, CONTEXT, onReached);

    expect(onReached).toHaveBeenCalledTimes(2);
  });
});
