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
  const state = { pending: true };

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
