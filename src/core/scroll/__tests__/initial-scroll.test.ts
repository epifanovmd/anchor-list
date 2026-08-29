import type { AnchorListInitialScroll } from "../../../types";
import { InitialScroll } from "../initial-scroll";

/** Кадры в node не идут сами: сдвигаем их вручную. */
const flushFrames = (count: number) => {
  for (let index = 0; index < count; index++) jest.advanceTimersByTime(16);
};

const createScroll = (
  target: AnchorListInitialScroll | undefined,
  overrides: {
    resolveOffset?: () => number | undefined;
    isTargetSettled?: () => boolean;
  } = {},
) => {
  const scrollToOffset = jest.fn();
  const onFinished = jest.fn();
  const scroll = new InitialScroll({
    getTarget: () => target,
    resolveOffset: overrides.resolveOffset ?? (() => 500),
    scrollToOffset,
    isTargetSettled: overrides.isTargetSettled ?? (() => true),
    onFinished,
  });

  return { scroll, scrollToOffset, onFinished };
};

describe("InitialScroll", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
    globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("не тратит попытки, пока цель не вычислима", () => {
    // Цель ждёт замера контента: считать попыткой кадр, где скроллить некуда,
    // значит позже принять невыполненную команду за стартовую позицию.
    let offset: number | undefined;
    const { scroll, scrollToOffset, onFinished } = createScroll(
      { type: "index", index: 95 },
      { resolveOffset: () => offset },
    );

    for (let attempt = 0; attempt < 12; attempt++) scroll.apply();

    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();

    // Замер пришёл — позиция применяется, попытки целы.
    offset = 6810;
    scroll.apply();

    expect(scrollToOffset).toHaveBeenCalledWith(6810);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("активен, пока не применил цель", () => {
    const { scroll } = createScroll({ type: "end" });

    expect(scroll.hasApplied()).toBe(false);

    scroll.apply();

    expect(scroll.hasApplied()).toBe(true);
  });

  it("не считает попытку применённой без нативного адаптера", () => {
    const scrollToOffset = jest.fn(() => false);
    const onFinished = jest.fn();
    const scroll = new InitialScroll({
      getTarget: () => ({ type: "end" }),
      resolveOffset: () => 500,
      scrollToOffset,
      isTargetSettled: () => false,
      onFinished,
    });

    scroll.apply();

    expect(scrollToOffset).toHaveBeenCalledWith(500);
    expect(scroll.hasApplied()).toBe(false);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("активен, пока не завершён", () => {
    const { scroll } = createScroll(undefined);

    expect(scroll.isActive()).toBe(true);
  });

  it("без стартовой позиции ничего не скроллит", () => {
    const { scroll, scrollToOffset, onFinished } = createScroll(undefined);

    scroll.apply();

    // Показать список решает вызывающий — по готовности измерений.
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
    expect(scroll.isActive()).toBe(true);
  });

  it("применяет позицию и завершается, когда цель устаканилась", () => {
    const { scroll, scrollToOffset, onFinished } = createScroll({
      type: "end",
    });

    scroll.apply();

    expect(scrollToOffset).toHaveBeenCalledWith(500);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(scroll.isActive()).toBe(false);
  });

  it("ждёт, пока цель станет вычислимой", () => {
    const { scroll, scrollToOffset } = createScroll(
      { type: "end" },
      { resolveOffset: () => undefined },
    );

    scroll.apply();

    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(scroll.isActive()).toBe(true);
  });

  it("повторяет скролл, пока размеры уточняются", () => {
    let offset = 500;
    const { scroll, scrollToOffset, onFinished } = createScroll(
      { type: "end" },
      { resolveOffset: () => (offset += 100), isTargetSettled: () => false },
    );

    scroll.apply();
    expect(scrollToOffset).toHaveBeenCalledTimes(1);

    flushFrames(1);
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("не раскрывает список по числу кадров, пока цель не готова", () => {
    const { scroll, onFinished } = createScroll(
      { type: "end" },
      { isTargetSettled: () => false },
    );

    scroll.apply();
    flushFrames(20);

    // Ограничение ожидания живёт в RenderReadiness и считается временем
    // тишины, а не десятью rAF, которые могут пройти до нативного коммита.
    expect(onFinished).not.toHaveBeenCalled();
    expect(scroll.isActive()).toBe(true);
  });

  it("отменяет запланированную доводку при размонтировании", () => {
    const { scroll, scrollToOffset } = createScroll(
      { type: "end" },
      { isTargetSettled: () => false },
    );

    scroll.apply();
    (scroll as unknown as { dispose: () => void }).dispose();
    flushFrames(2);

    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it("не выполняет вложенных попыток, пока запланирована следующая", () => {
    const { scroll, scrollToOffset } = createScroll(
      { type: "end" },
      { isTargetSettled: () => false },
    );

    scroll.apply();
    scroll.apply();
    scroll.apply();

    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it("завершается принудительно и только один раз", () => {
    const { scroll, onFinished } = createScroll({ type: "end" });

    scroll.finish();
    scroll.finish();

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("после завершения больше не скроллит", () => {
    const { scroll, scrollToOffset } = createScroll({ type: "end" });

    scroll.finish();
    scroll.apply();

    expect(scrollToOffset).not.toHaveBeenCalled();
  });
});
