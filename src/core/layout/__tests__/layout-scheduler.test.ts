import { LayoutScheduler } from "../layout-scheduler";

const nextFrame = () => jest.advanceTimersByTime(16);

describe("LayoutScheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("в покое ничего не ждёт", () => {
    const scheduler = new LayoutScheduler(jest.fn());

    expect(scheduler.isPending()).toBe(false);
  });

  it("откладывает пересчёт до конца кадра", () => {
    const run = jest.fn();
    const scheduler = new LayoutScheduler(run);

    scheduler.schedule();

    expect(run).not.toHaveBeenCalled();
    expect(scheduler.isPending()).toBe(true);

    nextFrame();

    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending()).toBe(false);
  });

  it("сводит пачку измерений в один проход", () => {
    const run = jest.fn();
    const scheduler = new LayoutScheduler(run);

    // При первом наполнении списка измерения приходят десятками подряд.
    for (let index = 0; index < 30; index++) scheduler.schedule();
    nextFrame();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("принимает новый запрос после выполнения прошлого", () => {
    const run = jest.fn();
    const scheduler = new LayoutScheduler(run);

    scheduler.schedule();
    nextFrame();
    scheduler.schedule();
    nextFrame();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("снимает ожидание до вызова обработчика", () => {
    const seen: boolean[] = [];
    const scheduler: LayoutScheduler = new LayoutScheduler(() =>
      seen.push(scheduler.isPending()),
    );

    scheduler.schedule();
    nextFrame();

    // Обработчик вправе запланировать следующий проход из самого себя.
    expect(seen).toEqual([false]);
  });
});
