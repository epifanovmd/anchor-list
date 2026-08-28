import { ListMetrics } from "../../../model";
import { ViewabilityTracker } from "../viewability";
import type { IViewabilityContext } from "../viewability-window";

const ITEM_SIZE = 100;
const ITEM_COUNT = 10;
const SCROLL_LENGTH = 500;

interface IRow {
  id: string;
}

const createTracker = () => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const data: IRow[] = Array.from({ length: ITEM_COUNT }, (_, index) => ({
    id: `k${index}`,
  }));

  metrics.setItems(
    data.map(row => row.id),
    data.map(() => ""),
  );

  const tracker = new ViewabilityTracker<IRow>({
    metrics,
    getItem: index => data[index],
  });

  return { tracker, metrics, data };
};

const context = (scroll: number): IViewabilityContext => ({
  scroll,
  scrollLength: SCROLL_LENGTH,
  startBuffered: 0,
  endBuffered: ITEM_COUNT - 1,
});

const keysOf = (tokens: { key: string }[]) => tokens.map(token => token.key);

describe("ViewabilityTracker", () => {
  it("ничего не считает без пар", () => {
    const { tracker } = createTracker();

    expect(tracker.hasPairs()).toBe(false);
    expect(() => tracker.update(context(0))).not.toThrow();
  });

  it("сообщает о попавших во вьюпорт элементах", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      { config: { itemVisiblePercentThreshold: 50 }, onViewableItemsChanged },
    ]);
    tracker.update(context(0));

    const info = onViewableItemsChanged.mock.calls[0]![0];

    expect(keysOf(info.viewableItems)).toEqual(["k0", "k1", "k2", "k3", "k4"]);
    expect(info.changed).toHaveLength(5);
    expect(info.viewableItems[0].item).toEqual({ id: "k0" });
    expect(info.viewableItems[0].index).toBe(0);
  });

  it("не уведомляет повторно, пока видимость не изменилась", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      { config: { itemVisiblePercentThreshold: 50 }, onViewableItemsChanged },
    ]);
    tracker.update(context(0));
    tracker.update(context(0));

    expect(onViewableItemsChanged).toHaveBeenCalledTimes(1);
  });

  it("сообщает о вышедших из вьюпорта элементах", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      { config: { itemVisiblePercentThreshold: 50 }, onViewableItemsChanged },
    ]);
    tracker.update(context(0));
    onViewableItemsChanged.mockClear();

    tracker.update(context(300));

    const info = onViewableItemsChanged.mock.calls[0]![0];
    const gone = info.changed.filter(
      (token: { isViewable: boolean }) => !token.isViewable,
    );

    expect(keysOf(gone)).toEqual(["k0", "k1", "k2"]);
  });

  it("ведёт каждую пару отдельно", () => {
    const { tracker } = createTracker();
    const strict = jest.fn();
    const loose = jest.fn();

    // Один и тот же элемент виден по одному порогу и невиден по другому.
    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 90 },
        onViewableItemsChanged: strict,
      },
      {
        config: { itemVisiblePercentThreshold: 10 },
        onViewableItemsChanged: loose,
      },
    ]);
    tracker.update(context(50));

    expect(keysOf(strict.mock.calls[0]![0].viewableItems)).not.toContain("k0");
    expect(keysOf(loose.mock.calls[0]![0].viewableItems)).toContain("k0");
  });

  it("пропускает токен элемента, исчезнувшего из данных", () => {
    const { tracker, metrics } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      { config: { itemVisiblePercentThreshold: 50 }, onViewableItemsChanged },
    ]);
    tracker.update(context(0));
    onViewableItemsChanged.mockClear();

    metrics.setItems(["k4", "k5"], ["", ""]);
    tracker.update(context(0));

    const info = onViewableItemsChanged.mock.calls[0]![0];

    expect(keysOf(info.viewableItems)).not.toContain("k0");
  });
});

describe("ViewabilityTracker — выдержка", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("выдерживает minimumViewTime перед уведомлением", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
        onViewableItemsChanged,
      },
    ]);
    tracker.update(context(0));

    expect(onViewableItemsChanged).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);

    expect(onViewableItemsChanged).toHaveBeenCalled();
  });

  it("не уведомляет об элементе, мелькнувшем меньше выдержки", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
        onViewableItemsChanged,
      },
    ]);

    tracker.update(context(0));
    // Быстрый скролл увёл элементы до истечения выдержки.
    tracker.update(context(900));
    jest.advanceTimersByTime(200);

    const notifiedKeys = onViewableItemsChanged.mock.calls.flatMap(
      ([info]: [{ changed: { key: string }[] }]) =>
        info.changed.map(token => token.key),
    );

    expect(notifiedKeys).not.toContain("k0");
  });

  it("не заводит второго таймера на тот же элемент", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
        onViewableItemsChanged,
      },
    ]);

    tracker.update(context(0));
    tracker.update(context(10));
    jest.advanceTimersByTime(200);

    const notified = onViewableItemsChanged.mock.calls.flatMap(
      ([info]: [{ changed: { key: string }[] }]) =>
        info.changed.map(token => token.key),
    );

    expect(notified.filter(key => key === "k0")).toHaveLength(1);
  });

  it("сообщает об уходе сразу, не дожидаясь выдержки", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
        onViewableItemsChanged,
      },
    ]);

    tracker.update(context(0));
    jest.advanceTimersByTime(200);
    onViewableItemsChanged.mockClear();

    tracker.update(context(300));

    // Выдержка — условие появления, а не исчезновения.
    expect(onViewableItemsChanged).toHaveBeenCalledTimes(1);
  });

  it("снимает таймеры удалённой пары", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();
    const pair = {
      config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
      onViewableItemsChanged,
    };

    tracker.setPairs([pair]);
    tracker.update(context(0));
    tracker.setPairs([]);
    jest.advanceTimersByTime(200);

    expect(onViewableItemsChanged).not.toHaveBeenCalled();
  });

  it("снимает таймеры при размонтировании", () => {
    const { tracker } = createTracker();
    const onViewableItemsChanged = jest.fn();

    tracker.setPairs([
      {
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 200 },
        onViewableItemsChanged,
      },
    ]);
    tracker.update(context(0));
    tracker.dispose();
    jest.advanceTimersByTime(200);

    expect(onViewableItemsChanged).not.toHaveBeenCalled();
  });

  it("сохраняет состояние оставшейся пары", () => {
    const { tracker } = createTracker();
    const kept = jest.fn();
    const keptPair = {
      config: { itemVisiblePercentThreshold: 50 },
      onViewableItemsChanged: kept,
    };

    tracker.setPairs([
      keptPair,
      {
        config: { itemVisiblePercentThreshold: 50 },
        onViewableItemsChanged: jest.fn(),
      },
    ]);
    tracker.update(context(0));
    kept.mockClear();

    tracker.setPairs([keptPair]);
    tracker.update(context(0));

    // Видимость не изменилась — повторного уведомления быть не должно.
    expect(kept).not.toHaveBeenCalled();
  });
});
