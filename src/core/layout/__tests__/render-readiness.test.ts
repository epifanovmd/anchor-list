import { ListMetrics } from "../../../model";
import { RenderReadiness } from "../render-readiness";
import type { IAnchorListRange } from "../visible-range";

const ITEM_SIZE = 100;

const createReadiness = (
  options: {
    count?: number;
    measured?: number[];
    range?: IAnchorListRange;
    hasInitialTarget?: boolean;
  } = {},
) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const count = options.count ?? 5;
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const finish = jest.fn();
  const state = { pending: true, revision: 0 };

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );
  for (const index of options.measured ?? []) {
    metrics.setMeasuredSize(keys[index]!, ITEM_SIZE);
  }

  const readiness = new RenderReadiness({
    metrics,
    getRange: () =>
      options.range ?? {
        start: 0,
        end: count - 1,
        startBuffered: 0,
        endBuffered: count - 1,
      },
    getCount: () => count,
    hasInitialTarget: () => options.hasInitialTarget ?? false,
    getLayoutRevision: () => state.revision,
    isPending: () => state.pending,
    finish: () => {
      state.pending = false;
      finish();
    },
  });

  return { metrics, readiness, finish, state };
};

describe("RenderReadiness — показ по измерениям", () => {
  it("не показывает список, пока видимые строки не измерены", () => {
    const { readiness, finish } = createReadiness({ measured: [0, 1] });

    readiness.reveal();

    // До измерений позиции оценочные, и строки налезают друг на друга.
    expect(finish).not.toHaveBeenCalled();
  });

  it("показывает список, когда видимая часть измерена", () => {
    const { readiness, finish } = createReadiness({
      measured: [0, 1, 2, 3, 4],
    });

    readiness.reveal();

    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("ждёт измерений только видимого диапазона", () => {
    const { readiness, finish } = createReadiness({
      count: 20,
      measured: [3, 4, 5],
      range: { start: 3, end: 5, startBuffered: 0, endBuffered: 10 },
    });

    readiness.reveal();

    expect(finish).toHaveBeenCalled();
  });

  it("показывает пустой список сразу", () => {
    const { readiness, finish } = createReadiness({ count: 0 });

    readiness.reveal();

    expect(finish).toHaveBeenCalled();
  });

  it("не показывает список без посчитанного диапазона", () => {
    const { readiness, finish } = createReadiness({
      measured: [0, 1, 2, 3, 4],
      range: { start: 0, end: -1, startBuffered: 0, endBuffered: -1 },
    });

    readiness.reveal();

    expect(finish).not.toHaveBeenCalled();
  });

  it("уступает начальному скроллу, когда задана стартовая позиция", () => {
    const { readiness, finish } = createReadiness({
      measured: [0, 1, 2, 3, 4],
      hasInitialTarget: true,
    });

    readiness.reveal();

    // Там ждать нужно не измерений, а того, что цель перестала уезжать.
    expect(finish).not.toHaveBeenCalled();
  });

  it("ничего не делает после показа", () => {
    const { readiness, finish } = createReadiness({
      measured: [0, 1, 2, 3, 4],
    });

    readiness.reveal();
    readiness.reveal();

    expect(finish).toHaveBeenCalledTimes(1);
  });
});

describe("RenderReadiness — страховка", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("показывает список, даже если измерений так и не пришло", () => {
    const { readiness, finish } = createReadiness();

    readiness.scheduleFallback();
    jest.advanceTimersByTime(150);

    // Их может не быть вовсе: пустые данные, нулевая высота ячейки.
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("не показывает список, пока стартовая позиция ни разу не применялась", () => {
    // Показать сейчас — значит показать не там, где просили: цель ещё не
    // вычислима, потому что нет замера контента. Страховка идёт на новый круг.
    const { readiness, finish } = createReadiness({
      hasInitialTarget: true,
    });

    readiness.scheduleFallback();
    jest.advanceTimersByTime(150 * 3);

    expect(finish).not.toHaveBeenCalled();
  });

  it("не показывает применённую стартовую позицию, пока доводка не завершена", () => {
    const { readiness, finish } = createReadiness({
      hasInitialTarget: true,
    });

    readiness.scheduleFallback();
    jest.advanceTimersByTime(150 * 3);

    // Команда scrollTo уже ушла, но целевые контейнеры могут ещё ждать mount и
    // measure. Один тихий круг не означает, что нативный кадр готов.
    expect(finish).not.toHaveBeenCalled();
  });

  it("сдаётся, если стартовая позиция так и не применилась", () => {
    // Кругов не бесконечно: замер контента приходит первыми кадрами, и если его
    // нет вовсе — список всё равно нужно показать.
    const { readiness, finish } = createReadiness({
      hasInitialTarget: true,
    });

    readiness.scheduleFallback();
    jest.advanceTimersByTime(150 * 11);

    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("не показывает список, пока размеры ещё приходят", () => {
    // Замеры продолжают менять раскладку: показать сейчас — показать кадр,
    // который переложится на глазах.
    const { readiness, finish, state } = createReadiness();

    readiness.scheduleFallback();

    for (let round = 0; round < 3; round += 1) {
      state.revision += 1;
      jest.advanceTimersByTime(150);
    }

    expect(finish).not.toHaveBeenCalled();

    // Замеры кончились — список можно показывать.
    jest.advanceTimersByTime(150);

    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("заводит страховку один раз", () => {
    const { readiness, finish } = createReadiness();

    readiness.scheduleFallback();
    readiness.scheduleFallback();
    jest.advanceTimersByTime(150);

    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("не заводит страховку после показа", () => {
    const { readiness, finish, state } = createReadiness();

    state.pending = false;
    readiness.scheduleFallback();
    jest.advanceTimersByTime(150);

    expect(finish).not.toHaveBeenCalled();
  });

  it("снимает страховку при размонтировании", () => {
    const { readiness, finish } = createReadiness();

    readiness.scheduleFallback();
    readiness.dispose();
    jest.advanceTimersByTime(150);

    expect(finish).not.toHaveBeenCalled();
  });
});
