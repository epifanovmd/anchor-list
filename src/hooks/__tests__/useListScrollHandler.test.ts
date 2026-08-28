/*
 * Хуки здесь не хуки: оба пакета Reanimated подменены обычными функциями,
 * поэтому обработчик собирается вне React — правило про порядок вызова хуков
 * тут проверяет несуществующее.
 */
/* eslint-disable react-hooks/rules-of-hooks */
import type { SharedValue } from "react-native-reanimated";

import type { IAnchorListScrollHandlerOptions } from "../useListScrollHandler";

/**
 * Reanimated в node-окружении не поднимается, а нужен здесь не он: обработчик —
 * обычный объект worklet-функций, и проверяется именно то, что он пишет.
 *
 * `useAnimatedScrollHandler` подменяется на «вернуть как есть»,
 * `useSharedValue` — на носитель значения.
 */
jest.mock("react-native-reanimated", () => ({
  useAnimatedScrollHandler: <THandlers>(handlers: THandlers) => handlers,
  useSharedValue: <TValue>(value: TValue) => ({ value }),
}));

jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    fn(...args),
}));

// Импорт после моков: модуль тянет оба пакета на верхнем уровне.
const { useListScrollHandler } = require("../useListScrollHandler") as {
  useListScrollHandler: (
    options: IAnchorListScrollHandlerOptions,
  ) => IScrollHandlers;
};

const CONTENT_HEIGHT = 10000;
const VIEWPORT_HEIGHT = 700;
/** Дальше этого смещения скроллить некуда. */
const MAX_SCROLL = CONTENT_HEIGHT - VIEWPORT_HEIGHT;
/** Смещение вдали от обеих кромок: там работает шаг, а не досылка. */
const MIDDLE = 1000;

/** Событие скролла в том виде, в каком его читает обработчик. */
interface IScrollEvent {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
}

interface IScrollHandlers {
  onScroll: (event: IScrollEvent) => void;
  onBeginDrag: (event: IScrollEvent) => void;
  onEndDrag: (event: IScrollEvent) => void;
  onMomentumBegin: (event: IScrollEvent) => void;
  onMomentumEnd: (event: IScrollEvent) => void;
}

const sharedValue = <T>(value: T) => ({ value }) as SharedValue<T>;

const scrollTo = (y: number): IScrollEvent => ({
  contentOffset: { y },
  contentSize: { height: CONTENT_HEIGHT },
  layoutMeasurement: { height: VIEWPORT_HEIGHT },
});

const setup = (
  overrides: Partial<IAnchorListScrollHandlerOptions> = {},
): {
  handlers: IScrollHandlers;
  scrollOffset: SharedValue<number>;
  onScroll: jest.Mock;
  /** Встать на смещение и забыть о нём: дальше проверяется только новое. */
  seed: (offset: number) => void;
} => {
  const scrollOffset = sharedValue(0);
  const onScroll = jest.fn();

  const handlers = useListScrollHandler({
    scrollOffset,
    onScroll,
    onBeginDrag: jest.fn(),
    onEndDrag: jest.fn(),
    onMomentumEnd: jest.fn(),
    ...overrides,
  });

  const seed = (offset: number) => {
    handlers.onScroll(scrollTo(offset));
    onScroll.mockClear();
  };

  return { handlers, scrollOffset, onScroll, seed };
};

describe("useListScrollHandler", () => {
  it("пишет смещение во внутреннее значение на каждом событии", () => {
    const { handlers, scrollOffset } = setup();

    handlers.onScroll(scrollTo(MIDDLE + 5));
    expect(scrollOffset.value).toBe(MIDDLE + 5);

    handlers.onScroll(scrollTo(MIDDLE + 9));
    expect(scrollOffset.value).toBe(MIDDLE + 9);
  });

  it("публикует смещение наружу тем же кадром", () => {
    const published = sharedValue(0);
    const { handlers } = setup({ publishedScrollOffset: published });

    handlers.onScroll(scrollTo(MIDDLE + 42));

    expect(published.value).toBe(MIDDLE + 42);
  });

  /**
   * Та самая регрессия: наружу смещение уходило один раз при монтировании, и
   * всё, что на него подписано, стояло на нуле.
   */
  it("публикует смещение чаще, чем шаг пересчёта диапазона", () => {
    const published = sharedValue(0);
    const { handlers, onScroll, seed } = setup({
      publishedScrollOffset: published,
    });

    seed(MIDDLE);

    // Шаг пересчёта — 24px: такие движения в JS не уходят.
    handlers.onScroll(scrollTo(MIDDLE + 3));
    handlers.onScroll(scrollTo(MIDDLE + 7));

    expect(published.value).toBe(MIDDLE + 7);
    expect(onScroll).not.toHaveBeenCalled();
  });

  it("не требует публикуемого значения", () => {
    const { handlers, scrollOffset } = setup();

    expect(() => handlers.onScroll(scrollTo(MIDDLE))).not.toThrow();
    expect(scrollOffset.value).toBe(MIDDLE);
  });

  it("уводит пересчёт в JS, когда набрался шаг", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    handlers.onScroll(scrollTo(MIDDLE + 10));
    expect(onScroll).not.toHaveBeenCalled();

    handlers.onScroll(scrollTo(MIDDLE + 30));
    expect(onScroll).toHaveBeenCalledWith(MIDDLE + 30, expect.any(Number));
  });

  it("берёт шаг перехода в JS из пропа", () => {
    const { handlers, onScroll, seed } = setup({ scrollThrottleDistance: 100 });

    seed(MIDDLE);

    // Больше умолчания, но меньше заданного шага — в JS не уходит.
    handlers.onScroll(scrollTo(MIDDLE + 40));
    expect(onScroll).not.toHaveBeenCalled();

    handlers.onScroll(scrollTo(MIDDLE + 120));
    expect(onScroll).toHaveBeenCalledWith(MIDDLE + 120, expect.any(Number));
  });

  it("без пропа шагает по умолчанию", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    handlers.onScroll(scrollTo(MIDDLE + 23));
    expect(onScroll).not.toHaveBeenCalled();

    handlers.onScroll(scrollTo(MIDDLE + 24));
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  /**
   * Доскроллили до самого верха и не убрали палец. Последнее событие отличается
   * от предыдущего меньше чем на шаг, и без досылки оно до JS не доходит: флаг
   * «упёрлись в начало» загорался бы только после отпускания пальца, когда
   * точное смещение уходит отдельным событием.
   */
  it("досылает смещение у начала контента, не дожидаясь шага", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    handlers.onScroll(scrollTo(10));
    handlers.onScroll(scrollTo(0));

    expect(onScroll).toHaveBeenLastCalledWith(0, expect.any(Number));
  });

  it("досылает смещение у конца контента", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MAX_SCROLL - 40);

    handlers.onScroll(scrollTo(MAX_SCROLL - 20));
    handlers.onScroll(scrollTo(MAX_SCROLL));

    expect(onScroll).toHaveBeenLastCalledWith(MAX_SCROLL, expect.any(Number));
  });

  /**
   * Отметка времени снимается на UI-потоке, вместе со смещением.
   *
   * Считать её в JS нельзя: смещение относится к моменту события, а до
   * обработки проходит неизвестно сколько — на броске JS занят сильнее всего, и
   * скорость, посчитанная по этим двум часам, занижалась тем больше, чем
   * тяжелее шёл список.
   */
  it("отдаёт время события вместе со смещением", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    const before = Date.now();

    handlers.onScroll(scrollTo(MIDDLE + 30));

    const [, time] = onScroll.mock.calls[0]!;

    expect(typeof time).toBe("number");
    expect(time).toBeGreaterThanOrEqual(before);
    expect(time).toBeLessThanOrEqual(Date.now());
  });

  it("не шлёт событие, когда смещение не изменилось", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    // Палец тянет за кромку, а смещение стоит — слать нечего.
    handlers.onScroll(scrollTo(0));
    handlers.onScroll(scrollTo(0));
    handlers.onScroll(scrollTo(0));

    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it("пишет фазу жеста без захода в JS", () => {
    const isDragging = sharedValue(false);
    const isMomentum = sharedValue(false);
    const { handlers } = setup({ isDragging, isMomentum });

    handlers.onBeginDrag(scrollTo(0));
    expect(isDragging.value).toBe(true);

    handlers.onEndDrag(scrollTo(0));
    expect(isDragging.value).toBe(false);

    handlers.onMomentumBegin(scrollTo(0));
    expect(isMomentum.value).toBe(true);

    handlers.onMomentumEnd(scrollTo(0));
    expect(isMomentum.value).toBe(false);
  });

  it("догоняет пересчёт остатком движения на конце жеста", () => {
    const { handlers, onScroll, seed } = setup();

    seed(MIDDLE);

    // Меньше шага — в JS не ушло.
    handlers.onScroll(scrollTo(MIDDLE + 8));
    expect(onScroll).not.toHaveBeenCalled();

    // Жест кончился: остаток обязан дойти, иначе диапазон останется старым.
    handlers.onEndDrag(scrollTo(MIDDLE + 8));
    expect(onScroll).toHaveBeenCalledWith(MIDDLE + 8, expect.any(Number));
  });
});
