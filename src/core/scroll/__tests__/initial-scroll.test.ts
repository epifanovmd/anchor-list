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
    target,
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
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it("сдаётся после предела попыток", () => {
    const { scroll, scrollToOffset, onFinished } = createScroll(
      { type: "end" },
      { isTargetSettled: () => false },
    );

    scroll.apply();
    flushFrames(20);

    // Иначе список открывался бы на позиции, доводимой бесконечно.
    expect(scrollToOffset).toHaveBeenCalledTimes(10);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(scroll.isActive()).toBe(false);
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
