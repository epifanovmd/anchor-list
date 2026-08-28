import { ListStore } from "../../../model";
import type { IEdgeCheckContext } from "../edge-geometry";
import { EdgeThresholds } from "../edge-thresholds";

const SCROLL_LENGTH = 500;
const CONTENT_SIZE = 5000;

const createThresholds = () => {
  const store = new ListStore();
  const onStartReached = jest.fn();
  const onEndReached = jest.fn();

  const edges = new EdgeThresholds({
    store,
    startThreshold: 0.5,
    endThreshold: 0.5,
    maintainScrollAtEndThreshold: 0.1,
    onStartReached,
    onEndReached,
  });

  return { edges, store, onStartReached, onEndReached };
};

const context = (
  scroll: number,
  overrides: Partial<IEdgeCheckContext> = {},
): IEdgeCheckContext => ({
  scroll,
  scrollLength: SCROLL_LENGTH,
  contentSize: CONTENT_SIZE,
  dataLength: 50,
  contentInsetEnd: 0,
  skipCallbacks: false,
  ...overrides,
});

/** Смещение, при котором до конца остаётся `distance`. */
const scrollForDistanceFromEnd = (distance: number) =>
  CONTENT_SIZE - SCROLL_LENGTH - distance;

describe("EdgeThresholds — конец списка", () => {
  it("вызывает конец списка один раз на вход в пороговую зону", () => {
    const { edges, onEndReached } = createThresholds();

    edges.check(context(scrollForDistanceFromEnd(1000)));

    expect(onEndReached).not.toHaveBeenCalled();

    edges.check(context(scrollForDistanceFromEnd(200)));

    expect(onEndReached).toHaveBeenCalledTimes(1);
    expect(onEndReached).toHaveBeenCalledWith({ distanceFromEnd: 200 });

    edges.check(context(scrollForDistanceFromEnd(150)));

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it("не повторяет вызов, пока подгрузка ничего не изменила", () => {
    const { edges, onEndReached } = createThresholds();

    edges.check(context(scrollForDistanceFromEnd(200)));
    edges.check(context(scrollForDistanceFromEnd(200)));

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it("снимает защёлку только после выхода за порог с запасом", () => {
    const { edges, onEndReached } = createThresholds();
    const threshold = 0.5 * SCROLL_LENGTH;

    edges.check(context(scrollForDistanceFromEnd(100)));

    expect(onEndReached).toHaveBeenCalledTimes(1);

    // Чуть дальше порога — защёлка держится, гистерезис не пройден.
    edges.check(context(scrollForDistanceFromEnd(threshold + 10)));
    edges.check(context(scrollForDistanceFromEnd(100)));

    expect(onEndReached).toHaveBeenCalledTimes(1);

    // Ушли за порог с запасом и вернулись — кромка срабатывает снова.
    edges.check(context(scrollForDistanceFromEnd(threshold * 1.3 + 10)));
    edges.check(context(scrollForDistanceFromEnd(100)));

    expect(onEndReached).toHaveBeenCalledTimes(2);
  });

  it("молчит, пока высота контента не известна", () => {
    const { edges, store, onEndReached } = createThresholds();

    edges.check(context(0, { contentSize: 0 }));

    expect(onEndReached).not.toHaveBeenCalled();
    // Сигналы конца тоже не трогаются: считать расстояние не от чего.
    expect(store.peek("isAtEnd")).toBe(false);
  });

  it("не считает распорку конца расстоянием до кромки", () => {
    const { edges, onEndReached } = createThresholds();

    // До конца контента 400, но 300 из них — распорка: фактически остаётся 100.
    edges.check(
      context(scrollForDistanceFromEnd(400), { contentInsetEnd: 300 }),
    );

    expect(onEndReached).toHaveBeenCalledWith({ distanceFromEnd: 100 });
  });
});

describe("EdgeThresholds — начало списка", () => {
  it("вызывает начало один раз на вход в зону", () => {
    const { edges, onStartReached } = createThresholds();

    edges.check(context(1000));
    expect(onStartReached).not.toHaveBeenCalled();

    edges.check(context(200));
    edges.check(context(150));

    expect(onStartReached).toHaveBeenCalledTimes(1);
    expect(onStartReached).toHaveBeenCalledWith({ distanceFromStart: 200 });
  });

  it("повторяет вызов, когда список вырос выше текущей позиции", () => {
    const { edges, onStartReached } = createThresholds();

    edges.check(context(200));
    expect(onStartReached).toHaveBeenCalledTimes(1);

    // Подгрузка сверху удерживает позицию, поэтому расстояние до начала после
    // неё не меняется и обычного выхода за порог не происходит.
    edges.check(context(2200, { contentSize: 7000, dataLength: 70 }));
    edges.check(context(200, { contentSize: 7000, dataLength: 70 }));

    expect(onStartReached).toHaveBeenCalledTimes(2);
  });

  it("не сбрасывает защёлку, пока позиция в пороговой зоне", () => {
    const { edges, onStartReached } = createThresholds();

    edges.check(context(200));
    edges.check(context(200, { contentSize: 7000, dataLength: 70 }));

    expect(onStartReached).toHaveBeenCalledTimes(1);
  });
});

describe("EdgeThresholds — сигналы", () => {
  it("выставляет сигналы кромок", () => {
    const { edges, store } = createThresholds();

    edges.check(context(0));

    expect(store.peek("isAtStart")).toBe(true);
    expect(store.peek("isNearStart")).toBe(true);
    expect(store.peek("isAtEnd")).toBe(false);

    edges.check(context(scrollForDistanceFromEnd(0)));

    expect(store.peek("isAtEnd")).toBe(true);
    expect(store.peek("isNearEnd")).toBe(true);
    expect(store.peek("isAtStart")).toBe(false);
  });

  it("считает список прижатым к концу, когда контент короче вьюпорта", () => {
    const { edges, store } = createThresholds();

    edges.check(context(0, { contentSize: 100 }));

    expect(store.peek("isAtEnd")).toBe(true);
    expect(store.peek("isWithinMaintainScrollAtEndThreshold")).toBe(true);
  });

  it("обновляет сигналы, но молчит колбэками при программном скролле", () => {
    const { edges, store, onEndReached } = createThresholds();

    edges.check(context(scrollForDistanceFromEnd(50), { skipCallbacks: true }));

    expect(store.peek("isNearEnd")).toBe(true);
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("не взводит защёлку во время подавления", () => {
    const { edges, onEndReached } = createThresholds();

    // Иначе после программного прибытия к кромке подгрузка не запустилась бы
    // уже никогда: защёлка считалась бы сработавшей.
    edges.check(context(scrollForDistanceFromEnd(50), { skipCallbacks: true }));
    edges.check(context(scrollForDistanceFromEnd(50)));

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });
});

describe("EdgeThresholds — общий гейт", () => {
  /** Контент чуть длиннее вьюпорта: обе кромки в пороговой зоне одновременно. */
  const shortContent = { contentSize: 600, dataLength: 5 };

  it("после срабатывания кромки держит вторую до нового жеста", () => {
    const { edges, onStartReached, onEndReached } = createThresholds();

    edges.check(context(50, shortContent));

    const totalCalls =
      onStartReached.mock.calls.length + onEndReached.mock.calls.length;

    expect(totalCalls).toBeGreaterThan(0);

    onStartReached.mockClear();
    onEndReached.mockClear();

    edges.check(context(50, shortContent));

    expect(onStartReached).not.toHaveBeenCalled();
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("новый жест разблокирует кромку по направлению", () => {
    const { edges, onStartReached } = createThresholds();

    edges.check(context(50, shortContent));
    onStartReached.mockClear();

    edges.prepareForNextGesture();

    // Движение к началу списка — разблокируется начальная кромка.
    expect(edges.beginGesture(-1)).toBe("start");

    edges.check(context(50, shortContent), "start");

    expect(onStartReached).toHaveBeenCalled();
  });

  it("не разблокирует кромку противоположного направления", () => {
    const { edges, onStartReached } = createThresholds();

    edges.check(context(50, shortContent));
    onStartReached.mockClear();

    edges.prepareForNextGesture();
    expect(edges.beginGesture(1)).toBe("end");

    edges.check(context(50, shortContent), "end");

    expect(onStartReached).not.toHaveBeenCalled();
  });

  it("открывает гейт, когда обе кромки далеко за порогами", () => {
    const { edges, onEndReached } = createThresholds();

    edges.check(context(50, shortContent));
    onEndReached.mockClear();

    // Уехали на середину длинного списка — держать больше некого.
    edges.check(context(2000));
    edges.check(context(scrollForDistanceFromEnd(100)));

    expect(onEndReached).toHaveBeenCalled();
  });
});
