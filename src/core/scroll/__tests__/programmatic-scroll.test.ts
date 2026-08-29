import { ProgrammaticScroll } from "../programmatic-scroll";
import type { IScrollAdapter } from "../scroll-adapter";

const createScroll = (withAdapter = true) => {
  const adapter: IScrollAdapter = {
    scrollToEnd: jest.fn(),
    scrollToOffset: jest.fn(),
  };
  const scroll = new ProgrammaticScroll({
    adapter: () => (withAdapter ? adapter : undefined),
  });

  return { scroll, adapter };
};

describe("ProgrammaticScroll", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("не активен в покое", () => {
    const { scroll } = createScroll();

    expect(scroll.isActive()).toBe(false);
  });

  it("двигает скролл через адаптер", () => {
    const { scroll, adapter } = createScroll();

    scroll.toOffset(300, false);
    scroll.toEnd(false);

    expect(adapter.scrollToOffset).toHaveBeenCalledWith(300, false);
    expect(adapter.scrollToEnd).toHaveBeenCalledWith(false);
  });

  it("мгновенный скролл заканчивается на событии, которое вызвал", () => {
    // Событие приходит следующим кадром. Сними пометку вызовом — и прыжок на
    // тысячи точек посчитается движением пользователя: по такой скорости
    // список раздувает запас отрисовки и перестаёт компенсировать замеры.
    const { scroll } = createScroll();

    scroll.toOffset(300, false);

    expect(scroll.isActive()).toBe(true);

    scroll.onScrollEvent();

    expect(scroll.isActive()).toBe(false);
  });

  it("снимает пометку по таймеру, если своего события не было", () => {
    // Запрошенное смещение совпало с текущим или его обрезала граница контента
    // — событию взяться неоткуда.
    const { scroll } = createScroll();

    scroll.toOffset(300, false);
    jest.advanceTimersByTime(500);

    expect(scroll.isActive()).toBe(false);
  });

  it("держит пометку всю анимацию", () => {
    const { scroll } = createScroll();

    scroll.toEnd(true);

    // Пороги подгрузки в это время не проверяются: иначе прибытие к кромке
    // немедленно запускает подгрузку.
    expect(scroll.isActive()).toBe(true);

    jest.advanceTimersByTime(499);
    expect(scroll.isActive()).toBe(true);

    jest.advanceTimersByTime(1);
    expect(scroll.isActive()).toBe(false);
  });

  it("держит цель конца после первого события и умеет довести повторно", () => {
    const { scroll, adapter } = createScroll();

    scroll.toEnd(false);
    scroll.onScrollEvent();

    expect(scroll.isActive()).toBe(true);
    expect(scroll.isTargetingEnd()).toBe(true);

    scroll.reapplyEnd();

    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(2);
    expect(adapter.scrollToEnd).toHaveBeenLastCalledWith(false);

    jest.advanceTimersByTime(500);
    expect(scroll.isActive()).toBe(false);
    expect(scroll.isTargetingEnd()).toBe(false);
  });

  it("сохраняет анимацию при повторной доводке к концу", () => {
    const { scroll, adapter } = createScroll();

    scroll.toEnd(true);
    scroll.reapplyEnd();

    expect(adapter.scrollToEnd).toHaveBeenLastCalledWith(true);
  });

  it("продлевает ожидание вторым скроллом", () => {
    const { scroll } = createScroll();

    scroll.toOffset(300, true);
    jest.advanceTimersByTime(400);

    scroll.toOffset(600, true);
    jest.advanceTimersByTime(400);

    expect(scroll.isActive()).toBe(true);

    jest.advanceTimersByTime(100);
    expect(scroll.isActive()).toBe(false);
  });

  it("мгновенный скролл снимает ожидание анимированного", () => {
    const { scroll } = createScroll();

    scroll.toOffset(300, true);
    scroll.toOffset(600, false);
    scroll.onScrollEvent();

    expect(scroll.isActive()).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(scroll.isActive()).toBe(false);
  });

  it("снимает ожидание при размонтировании", () => {
    const { scroll } = createScroll();

    scroll.toEnd(true);
    scroll.dispose();

    expect(scroll.isActive()).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(scroll.isActive()).toBe(false);
  });

  it("не падает без адаптера", () => {
    const { scroll } = createScroll(false);

    expect(() => scroll.toOffset(300, false)).not.toThrow();
    expect(() => scroll.toEnd(false)).not.toThrow();
    // Невыполненная команда не должна подавлять пороги и скорость на 500 мс.
    expect(scroll.isActive()).toBe(false);
  });
});
