import { ListStore } from "../../../model";
import { MaintainScrollAtEnd } from "../maintain-scroll-at-end";
import type { IScrollAdapter } from "../scroll-adapter";

const createMaintain = (
  options: { enabled?: boolean; animated?: boolean } = {},
) => {
  const store = new ListStore();
  /** Смещение скролла; меняется только когда список ведёт пользователь. */
  let offset = 0;
  const adapter: IScrollAdapter = {
    scrollToEnd: jest.fn(),
    scrollToOffset: jest.fn(),
    getOffset: () => offset,
  };
  /** Пользователь потянул список. */
  const drag = (to: number) => {
    offset = to;
  };
  const maintain = new MaintainScrollAtEnd({
    store,
    adapter: () => adapter,
    enabled: options.enabled ?? true,
    animated: options.animated ?? false,
  });

  store.set("isWithinMaintainScrollAtEndThreshold", true);

  return { store, adapter, maintain, drag };
};

/** Кадр в node не наступает сам. */
const nextFrame = () => jest.advanceTimersByTime(16);

describe("MaintainScrollAtEnd", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
    globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("молчит, пока проп не задан", () => {
    const { maintain, adapter } = createMaintain({ enabled: false });

    expect(maintain.run()).toBe(false);

    nextFrame();
    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
  });

  it("молчит, когда пользователь далеко от конца", () => {
    const { store, maintain, adapter } = createMaintain();

    store.set("isWithinMaintainScrollAtEndThreshold", false);

    expect(maintain.run()).toBe(false);

    nextFrame();
    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
  });

  it("скроллит к концу следующим кадром", () => {
    const { maintain, adapter } = createMaintain();

    expect(maintain.run()).toBe(true);
    // К этому моменту новый контент ещё не разложен: конец списка посчитан бы
    // по оценкам.
    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
    expect(maintain.isActive()).toBe(true);

    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledWith(false);
    expect(maintain.isActive()).toBe(false);
  });

  it("отменяется, если за кадр пользователь увёл список от конца", () => {
    const { maintain, adapter, drag } = createMaintain();

    maintain.run();
    drag(-400);
    nextFrame();

    // Иначе ленту выдёргивает из-под пальца.
    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
    expect(maintain.isActive()).toBe(false);
  });

  /**
   * Та самая жалоба: прилипание срабатывало ровно один раз, а дальше сообщение
   * добавлялось за вьюпорт — даже если вручную довести список до низа.
   *
   * Флаг «у конца» гасила сама добавленная строка: к моменту проверки она уже
   * посчитана в раскладке, и список формально не у конца. Проходили только
   * строки короче порога — в примере такая была ровно одна.
   */
  it("не отменяется от того, что добавленная строка сама увела от конца", () => {
    const { store, maintain, adapter } = createMaintain();

    // Пользователь был у конца, когда контент начал расти.
    maintain.run(true);
    // Новая строка выше порога: флаг погас, но смещение не изменилось.
    store.set("isWithinMaintainScrollAtEndThreshold", false);
    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("не запускается, когда пользователь и не был у конца", () => {
    const { maintain, adapter } = createMaintain();

    expect(maintain.run(false)).toBe(false);
    nextFrame();

    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
  });

  it("копит повторные запросы в один отложенный", () => {
    const { maintain, adapter } = createMaintain();

    maintain.run();
    maintain.run();
    maintain.run();
    nextFrame();

    // Пачка сообщений не должна давать пачку конкурирующих скроллов.
    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("выполняет накопленный запрос после завершения текущего", () => {
    const { maintain, adapter } = createMaintain();

    maintain.run();
    nextFrame();
    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(1);

    maintain.run();
    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(2);
  });

  it("ждёт завершения анимированного прилипания", () => {
    const { maintain, adapter } = createMaintain({ animated: true });

    maintain.run();
    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledWith(true);
    expect(maintain.isActive()).toBe(true);

    jest.advanceTimersByTime(500);
    expect(maintain.isActive()).toBe(false);
  });

  it("сбрасывает накопленный запрос, когда список взяли в руки", () => {
    const { maintain, adapter } = createMaintain({ animated: true });

    maintain.run();
    nextFrame();
    maintain.run();

    // Палец лёг на экран посреди доводки — второй раз не тянем. Смещением этот
    // случай не поймать: доводка двигает его сама.
    maintain.cancel();
    jest.advanceTimersByTime(500);
    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("выполняет накопленный запрос, если список не трогали", () => {
    const { maintain, adapter } = createMaintain({ animated: true });

    maintain.run();
    nextFrame();
    // Пока шла доводка, пришло ещё одно сообщение.
    maintain.run(true);

    jest.advanceTimersByTime(500);
    nextFrame();

    expect(adapter.scrollToEnd).toHaveBeenCalledTimes(2);
  });

  it("отменяет отложенный скролл при размонтировании", () => {
    const { maintain, adapter } = createMaintain();

    maintain.run();
    (maintain as unknown as { dispose: () => void }).dispose();
    nextFrame();

    expect(adapter.scrollToEnd).not.toHaveBeenCalled();
    expect(maintain.isActive()).toBe(false);
  });
});
