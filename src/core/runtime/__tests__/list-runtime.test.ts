import { ListStore, POSITION_OUT_OF_VIEW } from "../../../model";
import type { IScrollAdapter } from "../../scroll";
import { getStickyOffset } from "../../sticky";
import { ListRuntime } from "../list-runtime";
import type { IAnchorListRuntimeProps } from "../runtime-props";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

interface IRow {
  id: string;
  size: number;
}

const rows = (count: number, prefix = "k", size = ITEM_SIZE): IRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index}`,
    size,
  }));

const createProps = (
  data: IRow[],
  overrides: Partial<IAnchorListRuntimeProps<IRow>> = {},
): IAnchorListRuntimeProps<IRow> => ({
  data,
  keyExtractor: item => item.id,
  getFixedItemSize: item => item.size,
  estimatedItemSize: ITEM_SIZE,
  drawDistance: 0,
  startReachedThreshold: 0.5,
  endReachedThreshold: 0.5,
  maintainScrollAtEndThreshold: 0.1,
  maintainScrollAtEnd: false,
  maintainScrollAtEndAnimated: false,
  maintainVisibleContentPositionData: false,
  maintainVisibleContentPositionSize: false,
  ...overrides,
});

const createRuntime = (
  data = rows(40),
  overrides: Partial<IAnchorListRuntimeProps<IRow>> = {},
) => {
  const store = new ListStore();
  const adapter: IScrollAdapter = {
    scrollToEnd: jest.fn(),
    scrollToOffset: jest.fn(),
    getOffset: jest.fn(() => 0),
  };
  const runtime = new ListRuntime<IRow>(store, createProps(data, overrides));

  runtime.setAdapter(adapter);
  runtime.setScrollLength(SCROLL_LENGTH);

  return { store, runtime, adapter };
};

const nextFrame = () => jest.advanceTimersByTime(16);

/** Подрезано ли содержимое контейнера под ключом; undefined — ключ не разложен. */
const clippedByKey = (store: ListStore, key: string): boolean | undefined => {
  const count = store.peek("numContainers") ?? 0;

  for (let id = 0; id < count; id++) {
    if (store.peek(`containerItemKey${id}`) === key) {
      return store.peek(`containerClipped${id}`);
    }
  }

  return undefined;
};

/** Ключи, разложенные по контейнерам в текущий момент. */
const boundKeys = (store: ListStore): string[] => {
  const count = store.peek("numContainers") ?? 0;
  const keys: string[] = [];

  for (let id = 0; id < count; id++) {
    const key = store.peek(`containerItemKey${id}`);
    const position = store.peek(`containerPosition${id}`);

    if (key !== undefined && position !== POSITION_OUT_OF_VIEW) keys.push(key);
  }

  return keys.sort();
};

describe("ListRuntime — раскладка", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("считает диапазон после измерения вьюпорта", () => {
    const { store, runtime } = createRuntime();

    expect(runtime.getScrollLength()).toBe(SCROLL_LENGTH);
    expect(runtime.getRange()).toMatchObject({ start: 0, end: 4 });
    expect(store.peek("totalSize")).toBe(4000);
    expect(store.peek("scrollLength")).toBe(SCROLL_LENGTH);
  });

  it("монтирует только элементы диапазона", () => {
    const { store } = createRuntime();

    expect(boundKeys(store)).toEqual(["k0", "k1", "k2", "k3", "k4", "k5"]);
  });

  it("сдвигает диапазон вместе со скроллом", () => {
    const { store, runtime } = createRuntime();

    runtime.setScroll(1000);

    expect(runtime.getScroll()).toBe(1000);
    expect(runtime.getRange()).toMatchObject({ start: 10, end: 14 });
    expect(boundKeys(store)).toContain("k12");
    expect(boundKeys(store)).not.toContain("k0");
  });

  it("расширяет диапазон буфером отрисовки", () => {
    const { runtime } = createRuntime(rows(40), { drawDistance: 250 });

    runtime.setScroll(1000);

    expect(runtime.getRange()).toMatchObject({
      startBuffered: 7,
      endBuffered: 17,
    });
  });

  it("не пересчитывает раскладку на повторном смещении", () => {
    const { store, runtime } = createRuntime();

    runtime.setScroll(1000);

    const listener = jest.fn();

    store.listen("containerPosition0", listener);
    runtime.setScroll(1000);

    expect(listener).not.toHaveBeenCalled();
  });

  it("освобождает контейнеры на опустевшем списке", () => {
    const { store, runtime } = createRuntime();

    runtime.setProps(createProps([]));

    expect(store.peek("totalSize")).toBe(0);
    expect(boundKeys(store)).toEqual([]);
    expect(runtime.getRange().end).toBeLessThan(runtime.getRange().start);
  });

  it("не меняет размер вьюпорта на то же значение", () => {
    const { store, runtime } = createRuntime();
    const listener = jest.fn();

    store.listen("scrollLength", listener);
    runtime.setScrollLength(SCROLL_LENGTH);

    expect(listener).not.toHaveBeenCalled();
  });

  it("отдаёт позицию элемента и элемент по индексу", () => {
    const { runtime } = createRuntime();

    expect(runtime.getPositionAtIndex(3)).toBe(300);
    expect(runtime.getPositionAtIndex(-1)).toBeUndefined();
    expect(runtime.getPositionAtIndex(100)).toBeUndefined();
    expect(runtime.getItemAt(3)).toMatchObject({ id: "k3" });
  });
});

describe("ListRuntime — координаты шапки", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("считает видимыми только строки, реально попавшие в кадр", () => {
    const { runtime } = createRuntime();

    runtime.setHeaderSize(200);

    // Шапка съела 200 из 500: под ней помещаются три строки, а не пять.
    expect(runtime.getRange()).toMatchObject({ start: 0, end: 2 });
  });

  it("отдаёт смещение скролла в координатах контента", () => {
    const { runtime } = createRuntime();

    runtime.setHeaderSize(60);
    runtime.setScroll(1060);

    // Наружу — то же число, что у нативного скролла; внутрь — координаты
    // элементов, в которых считается раскладка.
    expect(runtime.getScroll()).toBe(1060);
    expect(runtime.getRange()).toMatchObject({ start: 10, end: 14 });
  });

  it("пересчитывает раскладку, когда шапка измерилась", () => {
    const { runtime } = createRuntime();

    runtime.setScroll(1060);
    runtime.setHeaderSize(60);

    // Нативное смещение не менялось — сместилось начало элементов.
    expect(runtime.getScroll()).toBe(1060);
    expect(runtime.getRange()).toMatchObject({ start: 10, end: 14 });
  });

  it("считает расстояние до конца по полной высоте контента", () => {
    const { store, runtime } = createRuntime();

    runtime.setHeaderSize(60);
    runtime.setContentSize(4060);
    runtime.setScroll(3560);

    // Ровно конец контента: ни раньше на высоту шапки, ни позже.
    expect(store.peek("distanceFromEnd")).toBe(0);
    expect(store.peek("isAtEnd")).toBe(true);
  });

  it("удерживает позицию при вставке сверху под шапкой", () => {
    const { store, runtime } = createRuntime(rows(40), {
      maintainVisibleContentPositionData: true,
    });

    runtime.setHeaderSize(60);
    runtime.setContentSize(4060);
    runtime.setScroll(1060);

    runtime.setProps(
      createProps([...rows(5, "h"), ...rows(40)], {
        maintainVisibleContentPositionData: true,
      }),
    );

    expect(store.peek("scrollAdjust")).toBe(500);
    expect(runtime.getScroll()).toBe(1560);
  });

  it("отдаёт начало координат элементов наружу", () => {
    const { store, runtime } = createRuntime();

    runtime.setHeaderSize(60);

    // Прилипание живёт на UI-потоке и позиции строк получает в координатах
    // элементов, а смещение скролла — нативное. Перевести одно в другое оно
    // может только этой величиной.
    expect(store.peek("contentOrigin")).toBe(60);
  });

  /**
   * Та самая жалоба: с шапкой прилипшая дата вставала не у кромки, а ниже неё
   * ровно на высоту шапки.
   *
   * Считается здесь то же, что видит глаз: экранная координата якоря. Она
   * складывается из начала контента, позиции строки и смещения прилипания —
   * за вычетом того, куда уехал нативный скролл.
   */
  it("ставит прилипший якорь у самой кромки, а не ниже неё на высоту шапки", () => {
    const { store, runtime } = createRuntime(rows(40), {
      sticky: [{ edge: "start", indices: [0, 10] }],
    });

    runtime.setHeaderSize(60);
    runtime.setScroll(660);

    const origin = store.peek("contentOrigin") ?? 0;
    const geometry = runtime.getStickyGeometry(0)!;
    const offset = getStickyOffset({
      edge: "start",
      position: geometry.position,
      size: geometry.size,
      scrollLength: SCROLL_LENGTH,
      scroll: 660,
      edgeOffset: 0,
      limit: geometry.limit,
      stickySize: geometry.size,
      contentOrigin: origin,
    });

    expect(origin + geometry.position + offset - 660).toBe(0);
  });
});

describe("ListRuntime — измерения", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("копит измерения до конца кадра", () => {
    const { store, runtime } = createRuntime(rows(40), {
      getFixedItemSize: undefined,
    });

    for (let index = 0; index < 5; index++) {
      runtime.setItemSize(`k${index}`, 60);
    }

    // Пересчёт на каждое измерение стоил бы стольких же полных проходов.
    expect(store.peek("totalSize")).toBe(4000);

    nextFrame();

    // Пять измеренных по 60 вместо оценки в 100; остальные держат выданную им
    // оценку — задним числом она не меняется.
    expect(store.peek("totalSize")).toBe(3800);
  });

  it("не принимает измерение, ничего не меняющее в раскладке", () => {
    const { runtime } = createRuntime(rows(40), {
      getFixedItemSize: undefined,
    });

    runtime.setItemSize("k0", 60);
    nextFrame();

    const scheduled = jest.getTimerCount();

    // Доли пикселя — шум округления экрана.
    runtime.setItemSize("k0", 60.3);

    expect(jest.getTimerCount()).toBe(scheduled);
  });

  it("не перебивает объявленный размер измерением", () => {
    const { store, runtime } = createRuntime();

    runtime.setItemSize("k0", 333);
    nextFrame();

    expect(store.peek("totalSize")).toBe(4000);
  });

  it("отбрасывает замер после перепривязки контейнера", () => {
    const { runtime } = createRuntime(rows(40), {
      getFixedItemSize: undefined,
      recycleItems: true,
    });
    const id = runtime.pool.getContainerByKey("k0")!;

    expect(runtime.isItemSizeFixed("k0")).toBe(false);
    expect(runtime.shouldRecycleItems()).toBe(true);

    const timersBefore = jest.getTimerCount();

    runtime.setContainerItemSize(id, "старый-ключ", 60);
    expect(jest.getTimerCount()).toBe(timersBefore);

    runtime.setContainerItemSize(id, "k0", 60);
    expect(jest.getTimerCount()).toBe(timersBefore + 1);
  });
});

describe("ListRuntime — удержание позиции", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("компенсирует вставку выше вьюпорта", () => {
    const { store, runtime } = createRuntime(rows(40), {
      maintainVisibleContentPositionData: true,
    });

    runtime.setScroll(1000);
    runtime.setProps(
      createProps([...rows(5, "h"), ...rows(40)], {
        maintainVisibleContentPositionData: true,
      }),
    );

    expect(runtime.getScroll()).toBe(1500);
    expect(store.peek("scrollAdjust")).toBe(500);
    // Диапазон пересчитан по новому смещению, а не по старому.
    expect(runtime.getRange()).toMatchObject({ start: 15, end: 19 });
  });

  it("не компенсирует, когда удержание выключено", () => {
    const { store, runtime } = createRuntime();

    runtime.setScroll(1000);
    runtime.setProps(createProps([...rows(5, "h"), ...rows(40)]));

    expect(runtime.getScroll()).toBe(1000);
    expect(store.peek("scrollAdjust")).toBe(0);
  });

  it("компенсирует изменение размера строки выше вьюпорта", () => {
    const { store, runtime } = createRuntime(rows(40), {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionSize: true,
    });

    for (let index = 0; index < 40; index++)
      runtime.setItemSize(`k${index}`, 100);
    nextFrame();

    runtime.setScroll(1000);
    runtime.setItemSize("k2", 300);
    nextFrame();

    expect(store.peek("scrollAdjust")).toBe(200);
    expect(runtime.getScroll()).toBe(1200);
  });

  /**
   * Жалоба: на быстром броске список встаёт колом, а замер показывает десятки
   * восстановлений позиции со средним сдвигом в четыре пикселя.
   *
   * В неизмеренной территории каждая новая строка приходит с настоящей высотой,
   * и каждый такой замер снимает якорь. Один flush тогда стоит двух полных
   * привязок вместо одной плюс нативной подстройки скролла — ради сдвига,
   * который никто не увидит: строку, ради которой он делается, уносит с экрана
   * раньше, чем сдвиг доедет.
   */
  it("не удерживает позицию по размеру, пока список летит", () => {
    const { store, runtime } = createRuntime(rows(400), {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionSize: true,
    });

    for (let index = 0; index < 400; index++)
      runtime.setItemSize(`k${index}`, 100);
    nextFrame();

    // Вьюпорт 500px: три события подряд по 400px за кадр — 25px/мс, бросок.
    for (let frame = 1; frame <= 3; frame++) {
      jest.advanceTimersByTime(16);
      runtime.setScroll(10000 + frame * 400);
    }

    const scrollBefore = runtime.getScroll();

    runtime.setItemSize("k2", 300);
    nextFrame();

    expect(store.peek("scrollAdjust")).toBe(0);
    expect(runtime.getScroll()).toBe(scrollBefore);
  });

  /**
   * Обратная сторона: на спокойном скролле компенсация обязана работать как
   * работала. Пользователь читает и видит, как строка уезжает под ним.
   */
  it("удерживает позицию по размеру на спокойном скролле", () => {
    const { store, runtime } = createRuntime(rows(400), {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionSize: true,
    });

    for (let index = 0; index < 400; index++)
      runtime.setItemSize(`k${index}`, 100);
    nextFrame();

    // 16px за кадр — один пиксель в миллисекунду, обычное чтение.
    for (let frame = 1; frame <= 3; frame++) {
      jest.advanceTimersByTime(16);
      runtime.setScroll(10000 + frame * 16);
    }

    runtime.setItemSize("k2", 300);
    nextFrame();

    expect(store.peek("scrollAdjust")).toBe(200);
  });

  /**
   * Решение принимается в момент замера, а не в момент flush: к flush контент
   * уже вырос, и скорость к тому времени отвечает на другой вопрос. Якорь снят
   * на спокойном скролле — значит он обязан быть применён, даже если список
   * успел разогнаться.
   */
  it("доводит до конца компенсацию, снятую до броска", () => {
    const { store, runtime } = createRuntime(rows(400), {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionSize: true,
    });

    for (let index = 0; index < 400; index++)
      runtime.setItemSize(`k${index}`, 100);
    nextFrame();

    runtime.setScroll(10000);
    runtime.setItemSize("k2", 300);

    // Бросок начался уже после того, как якорь был снят.
    for (let frame = 1; frame <= 3; frame++) {
      jest.advanceTimersByTime(16);
      runtime.setScroll(10000 + frame * 400);
    }
    nextFrame();

    expect(store.peek("scrollAdjust")).toBe(200);
  });

  it("отбрасывает событие скролла, отправленное до применения сдвига", () => {
    const { runtime } = createRuntime(rows(40), {
      maintainVisibleContentPositionData: true,
    });

    runtime.setScroll(1000);
    runtime.setProps(
      createProps([...rows(5, "h"), ...rows(40)], {
        maintainVisibleContentPositionData: true,
      }),
    );

    runtime.setScroll(1004);

    // Принять его — значит откатить только что сделанный сдвиг.
    expect(runtime.getScroll()).toBe(1500);
  });
});

describe("ListRuntime — кромки и скролл", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Жалоба: на резком броске шкала скорости прыгает заметно позже самого
   * броска.
   *
   * Смещение приходит из события скролла, а отметка времени бралась в момент,
   * когда до события дошли руки в JS. Это двое разных часов: на броске JS занят
   * сильнее всего, промежутки между обработками растягиваются, и скорость
   * выходит тем ниже настоящей, чем тяжелее идёт список. Здесь кадр ровно 16мс,
   * а обработка отстаёт втрое.
   */
  it("не занижает скорость, когда JS обрабатывает события с опозданием", () => {
    const { store, runtime } = createRuntime(rows(400));

    let eventTime = 0;

    for (let frame = 1; frame <= 8; frame++) {
      eventTime += 16;
      // Реальное время идёт втрое быстрее, чем кадры скролла.
      jest.advanceTimersByTime(48);
      runtime.setScroll(frame * 48, eventTime);
    }

    // 48px за 16мс — ровно три пикселя в миллисекунду.
    expect(store.peek("velocity")).toBeCloseTo(3, 5);
  });

  /**
   * Жалоба: после резкого броска число скорости так и висит.
   *
   * Скорость публикуется только на событии скролла, а когда список встал,
   * событий больше нет — последнее значение остаётся снаружи навсегда. Само по
   * себе оно не затухает: счётчик считает средневзвешенное по уже собранной
   * истории, и без новых точек ответ не меняется.
   */
  it("обнуляет скорость, когда скролл встал", () => {
    const { store, runtime } = createRuntime(rows(400));

    runtime.setScroll(0);
    jest.advanceTimersByTime(16);
    runtime.setScroll(400);
    jest.advanceTimersByTime(16);
    runtime.setScroll(800);

    expect(store.peek("velocity")).toBeGreaterThan(0);

    // Событий больше нет: список стоит.
    jest.advanceTimersByTime(500);

    expect(store.peek("velocity")).toBe(0);
  });

  /**
   * Жалоба: на инерции вперёд скорость иногда проскакивает в минус, хотя
   * назад список не едет ни разу.
   *
   * Причина — в источнике. Смещение, по которому считается раскладка, склеено
   * из двух: пока JS отстаёт больше чем на полэкрана, вместо события берётся
   * живое смещение UI-потока. В момент, когда JS догоняет, подмена
   * выключается, и применённое смещение возвращается к своим часам — назад на
   * величину бывшего отставания. Движение при этом только вперёд.
   */
  it("не разворачивает скорость, когда JS догоняет UI-поток", () => {
    const store = new ListStore();
    // Отставание JS от UI-потока: сначала больше полэкрана, потом догнал.
    let lag = 900;
    let event = 0;
    const adapter: IScrollAdapter = {
      scrollToEnd: jest.fn(),
      scrollToOffset: jest.fn(),
      getOffset: jest.fn(() => event + lag),
    };
    const runtime = new ListRuntime<IRow>(store, createProps(rows(400)));

    runtime.setAdapter(adapter);
    runtime.setScrollLength(SCROLL_LENGTH);

    const samples: number[] = [];

    for (let step = 0; step < 12; step++) {
      event += 120;
      if (step === 5) lag = 50;
      jest.advanceTimersByTime(16);
      runtime.setScroll(event);
      samples.push(runtime.getVelocity());
    }

    expect(samples.every(value => value >= 0)).toBe(true);
    // Заодно и величина: 120px за 16мс — это 7.5px/мс, а не десятки.
    // Раньше в момент включения подмены счётчик мерил скачок применённого
    // смещения на всю величину отставания и показывал шестьдесят с лишним.
    expect(Math.max(...samples)).toBeLessThan(10);
  });

  it("вызывает подгрузку у конца списка", () => {
    const onEndReached = jest.fn();
    const { runtime } = createRuntime(rows(40), { onEndReached });

    runtime.setScroll(3300);

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  /**
   * JS не успел за нативным скроллом, и события пришли пачкой — все далеко
   * позади живого смещения. Направление обязано читаться по самой пачке.
   *
   * Иначе после первой подмены следующее событие выглядит движением назад,
   * подмена не срабатывает, и список откатывается к устаревшему смещению; через
   * событие — снова вперёд. На экране это моргание на месте: контейнеры
   * перепривязываются на каждом проходе, а в кадре мелькает пустота.
   */
  it("не мечется, разбирая очередь устаревших событий", () => {
    const { runtime, adapter } = createRuntime(rows(400));
    const live = 20000;

    (adapter.getOffset as jest.Mock).mockReturnValue(live);

    const seen: number[] = [];

    // Пачка событий из начала списка: каждое следующее чуть дальше предыдущего.
    for (const offset of [1000, 1024, 1048, 1072, 1096]) {
      runtime.setScroll(offset);
      seen.push(runtime.getScroll());
    }

    // Первое событие направления не имеет; дальше список стоит на живом
    // смещении и никуда не откатывается.
    expect(seen).toEqual([1000, live, live, live, live]);
  });

  it("не вызывает подгрузку во время программного скролла", () => {
    const onEndReached = jest.fn();
    const { runtime } = createRuntime(rows(40), { onEndReached });

    runtime.scrollToOffset(3300, true);
    runtime.setScroll(3300);

    // Иначе программный переезд к концу немедленно запускает подгрузку.
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("двигает нативный скролл через адаптер", () => {
    const { runtime, adapter } = createRuntime();

    runtime.scrollToOffset(300);
    runtime.scrollToEnd();
    runtime.scrollToIndex({ index: 10 });

    expect(adapter.scrollToOffset).toHaveBeenCalledWith(300, false);
    expect(adapter.scrollToEnd).toHaveBeenCalledWith(false);
    expect(adapter.scrollToOffset).toHaveBeenCalledWith(1000, false);
  });

  it("ставит элемент в заданное место вьюпорта", () => {
    const { runtime, adapter } = createRuntime();

    runtime.scrollToIndex({ index: 10, viewPosition: 1 });

    // Низ элемента у нижней кромки: 1000 + 100 - 500.
    expect(adapter.scrollToOffset).toHaveBeenCalledWith(600, false);
  });

  it("ставит элемент под шапкой, а не под кромкой вьюпорта", () => {
    const { runtime, adapter } = createRuntime();

    runtime.setHeaderSize(60);
    runtime.scrollToIndex({ index: 10 });

    // Элементы лежат под шапкой: без её высоты элемент уезжает ниже кромки.
    expect(adapter.scrollToOffset).toHaveBeenCalledWith(1060, false);
  });

  it("учитывает шапку и при скролле по ключу", () => {
    const { runtime, adapter } = createRuntime();

    runtime.setHeaderSize(60);
    runtime.scrollToKey({ key: "k10" });

    expect(adapter.scrollToOffset).toHaveBeenCalledWith(1060, false);
  });

  it("отдаёт позицию элемента в координатах контента", () => {
    const { runtime } = createRuntime();

    runtime.setHeaderSize(60);

    expect(runtime.getPositionAtIndex(10)).toBe(1060);
    expect(runtime.getPositionByKey("k10")).toBe(1060);
  });

  it("молчит на скролле к несуществующему индексу", () => {
    const { runtime, adapter } = createRuntime();

    runtime.scrollToIndex({ index: 500 });

    expect(adapter.scrollToOffset).not.toHaveBeenCalled();
  });

  it("разблокирует кромку по направлению жеста", () => {
    const onStartReached = jest.fn();
    const { runtime } = createRuntime(rows(40), { onStartReached });

    // Первый вход в зону начала закрывает общий гейт.
    runtime.setScroll(2000);
    jest.advanceTimersByTime(20);
    runtime.setScroll(100);
    expect(onStartReached).toHaveBeenCalledTimes(1);

    runtime.onGestureEnd();
    jest.advanceTimersByTime(20);
    runtime.setScroll(90);
    // Жест идёт к началу списка — начальная кромка разблокируется.
    runtime.onGestureBegin();
    runtime.setScroll(50);

    expect(onStartReached).toHaveBeenCalledTimes(2);
  });

  it("копит скорость по событиям скролла", () => {
    const { runtime } = createRuntime();

    runtime.setScroll(100);
    jest.advanceTimersByTime(20);
    runtime.setScroll(300);

    expect(runtime.getVelocity()).toBeGreaterThan(0);
  });
});

describe("ListRuntime — публикация состояния", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("публикует геометрию контента и границу скролла", () => {
    const { store, runtime } = createRuntime();

    expect(store.peek("totalSize")).toBe(4000);
    expect(store.peek("contentSize")).toBe(4000);
    expect(store.peek("maxScroll")).toBe(3500);

    // Замер контента добавил шапку и подвал — граница уехала вместе с ними.
    runtime.setContentSize(4160);

    expect(store.peek("contentSize")).toBe(4160);
    expect(store.peek("maxScroll")).toBe(3660);
  });

  it("не отдаёт отрицательной границы на коротком контенте", () => {
    const { store } = createRuntime(rows(2));

    expect(store.peek("maxScroll")).toBe(0);
  });

  it("публикует границы видимого диапазона", () => {
    const { store, runtime } = createRuntime();

    runtime.setScroll(1000);

    expect(store.peek("firstVisibleIndex")).toBe(10);
    expect(store.peek("lastVisibleIndex")).toBe(14);
  });

  it("сообщает, что видимых элементов нет", () => {
    const { store, runtime } = createRuntime();

    runtime.setProps(createProps([]));

    expect(store.peek("firstVisibleIndex")).toBe(-1);
    expect(store.peek("lastVisibleIndex")).toBe(-1);
  });

  it("публикует скорость скролла", () => {
    const { store, runtime } = createRuntime();

    runtime.setScroll(100);
    jest.advanceTimersByTime(20);
    runtime.setScroll(300);

    expect(store.peek("velocity")).toBeGreaterThan(0);
    expect(store.peek("velocity")).toBe(runtime.getVelocity());
  });

  it("публикует замеры шапки, подвала и вьюпорта", () => {
    const { store, runtime } = createRuntime();

    runtime.setHeaderSize(60);
    runtime.setFooterSize(40);
    runtime.setScrollSize(390, SCROLL_LENGTH);

    expect(store.peek("headerSize")).toBe(60);
    expect(store.peek("footerSize")).toBe(40);
    expect(store.peek("scrollSize")).toEqual({ width: 390, height: 500 });
  });

  it("не будит подписчиков размера вьюпорта без изменений", () => {
    const { store, runtime } = createRuntime();
    const listener = jest.fn();

    runtime.setScrollSize(390, SCROLL_LENGTH);
    store.listen("scrollSize", listener);
    runtime.setScrollSize(390, SCROLL_LENGTH);

    // Новый объект на каждый замер перерисовывал бы всех, кто его читает.
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("ListRuntime — чтение и адресация по ключу", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("отдаёт размер элемента", () => {
    const { runtime } = createRuntime();

    expect(runtime.getSizeAtIndex(3)).toBe(ITEM_SIZE);
    expect(runtime.getSizeAtIndex(-1)).toBeUndefined();
    expect(runtime.getSizeAtIndex(100)).toBeUndefined();
  });

  it("отдаёт полную высоту контента", () => {
    const { runtime } = createRuntime();

    runtime.setContentSize(4160);

    expect(runtime.getContentSize()).toBe(4160);
  });

  it("адресует элемент ключом, а не индексом", () => {
    const { runtime } = createRuntime();

    expect(runtime.getIndexByKey("k10")).toBe(10);
    expect(runtime.getPositionByKey("k10")).toBe(1000);

    // Подгрузка сверху сдвинула индексы, ключ остался прежним.
    runtime.setProps(createProps([...rows(5, "h"), ...rows(40)]));

    expect(runtime.getIndexByKey("k10")).toBe(15);
    expect(runtime.getPositionByKey("k10")).toBe(1500);
  });

  it("скроллит к элементу по ключу", () => {
    const { runtime, adapter } = createRuntime();

    expect(runtime.scrollToKey({ key: "k10" })).toBe(true);
    expect(adapter.scrollToOffset).toHaveBeenCalledWith(1000, false);
  });

  it("сообщает, что ключа в данных нет", () => {
    const { runtime, adapter } = createRuntime();

    expect(runtime.scrollToKey({ key: "missing" })).toBe(false);
    expect(adapter.scrollToOffset).not.toHaveBeenCalled();
  });
});

describe("ListRuntime — прочее", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("показывает список, когда видимая часть измерена", () => {
    const { store } = createRuntime();

    expect(store.peek("readyToRender")).toBe(true);
  });

  it("не показывает список с неизмеренными строками", () => {
    const { store } = createRuntime(rows(40), { getFixedItemSize: undefined });

    expect(store.peek("readyToRender")).toBe(false);
  });

  it("показывает список по страховке, если измерений не пришло", () => {
    const { store } = createRuntime(rows(40), { getFixedItemSize: undefined });

    jest.advanceTimersByTime(150);

    expect(store.peek("readyToRender")).toBe(true);
  });

  it("публикует прилипший якорь", () => {
    const { store, runtime } = createRuntime(rows(40), {
      sticky: [{ edge: "start", indices: [0, 10, 20] }],
    });

    runtime.setScroll(1200);

    expect(store.peek("activeStickyStartIndex")).toBe(10);
    // Якорь держится смонтированным, даже уйдя за буфер.
    expect(boundKeys(store)).toContain("k10");
  });

  it("открывает список над нижней распоркой", () => {
    const store = new ListStore();
    const adapter: IScrollAdapter = {
      scrollToEnd: jest.fn(),
      scrollToOffset: jest.fn(),
      getOffset: jest.fn(() => 0),
    };
    const runtime = new ListRuntime<IRow>(
      store,
      createProps(rows(40), { initialScroll: { type: "end" } }),
    );

    runtime.setAdapter(adapter);
    runtime.setScrollLength(SCROLL_LENGTH);
    // Подвал-распорка под панель ввода приходит замером контента.
    runtime.setContentSize(4080);
    nextFrame();

    // Последняя строка обязана встать над панелью, а не под ней.
    expect(adapter.scrollToOffset).toHaveBeenLastCalledWith(3580, false);
  });

  it("ждёт замер подвала, даже если он опоздал на кадр", () => {
    const store = new ListStore();
    const adapter: IScrollAdapter = {
      scrollToEnd: jest.fn(),
      scrollToOffset: jest.fn(),
      getOffset: jest.fn(() => 0),
    };
    const runtime = new ListRuntime<IRow>(
      store,
      createProps(rows(40), { initialScroll: { type: "end" } }),
    );

    runtime.setAdapter(adapter);
    runtime.setScrollLength(SCROLL_LENGTH);
    // Замер контента приходит от ScrollView и вполне может опоздать: до него
    // конец списка считается по одной сумме элементов, без распорки.
    nextFrame();
    runtime.setContentSize(4080);
    nextFrame();

    expect(adapter.scrollToOffset).toHaveBeenLastCalledWith(3580, false);
  });

  it("держит верхнюю строку на месте при подгрузке с разделителями дат", () => {
    // Стенд повторяет чат: разделители дат живут в тех же данных, а их ключ
    // считается от дня — при подгрузке того же дня такой разделитель уезжает
    // вверх, оставаясь тем же элементом.
    const dateRow = (day: string): IRow => ({ id: `d-${day}`, size: 44 });
    const message = (seq: number): IRow => ({ id: `m${seq}`, size: 100 });
    const messagesFrom = (from: number, count: number): IRow[] =>
      Array.from({ length: count }, (_, index) => message(from + index));

    const before: IRow[] = [dateRow("x"), ...messagesFrom(100, 40)];
    const after: IRow[] = [
      dateRow("w"),
      ...messagesFrom(60, 20),
      dateRow("x"),
      ...messagesFrom(80, 20),
      ...messagesFrom(100, 40),
    ];

    const store = new ListStore();
    const adapter: IScrollAdapter = {
      scrollToEnd: jest.fn(),
      scrollToOffset: jest.fn(),
      getOffset: jest.fn(() => 0),
    };
    const options: Partial<IAnchorListRuntimeProps<IRow>> = {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionData: true,
      maintainVisibleContentPositionSize: true,
    };
    const runtime = new ListRuntime<IRow>(
      store,
      createProps(before, {
        ...options,
        sticky: [{ edge: "start", indices: [0] }],
      }),
    );

    const measureAll = (data: IRow[]) => {
      for (const row of data) runtime.setItemSize(row.id, row.size);
      nextFrame();
    };

    runtime.setAdapter(adapter);
    runtime.setScrollLength(SCROLL_LENGTH);
    measureAll(before);

    // Верх списка: ровно там срабатывает подгрузка предыдущей страницы.
    runtime.setScroll(44);

    const screenTop = () =>
      (runtime.getPositionByKey("m100") ?? 0) - runtime.getScroll();
    const expected = screenTop();

    runtime.setProps(
      createProps(after, {
        ...options,
        sticky: [{ edge: "start", indices: [0, 21] }],
      }),
    );
    measureAll(after);

    // Строка, на которую смотрел пользователь, обязана остаться на месте.
    expect(screenTop()).toBeCloseTo(expected, 0);
  });

  it("не опирается на прилипающую дату при подгрузке того же дня", () => {
    // День продолжается сверху: разделитель остаётся тем же элементом, но
    // между ним и сообщением, на которое смотрит пользователь, встаёт целая
    // пачка. Держать на месте разделитель — значит увезти сообщение.
    const dateRow = (day: string): IRow => ({ id: `d-${day}`, size: 44 });
    const message = (seq: number): IRow => ({ id: `m${seq}`, size: 100 });
    const messagesFrom = (from: number, count: number): IRow[] =>
      Array.from({ length: count }, (_, index) => message(from + index));

    const before: IRow[] = [dateRow("x"), ...messagesFrom(100, 40)];
    const after: IRow[] = [
      dateRow("w"),
      ...messagesFrom(60, 20),
      dateRow("x"),
      ...messagesFrom(80, 20),
      ...messagesFrom(100, 40),
    ];

    const store = new ListStore();
    const adapter: IScrollAdapter = {
      scrollToEnd: jest.fn(),
      scrollToOffset: jest.fn(),
      getOffset: jest.fn(() => 0),
    };
    const options: Partial<IAnchorListRuntimeProps<IRow>> = {
      getFixedItemSize: undefined,
      maintainVisibleContentPositionData: true,
      maintainVisibleContentPositionSize: true,
    };
    const runtime = new ListRuntime<IRow>(
      store,
      createProps(before, {
        ...options,
        sticky: [{ edge: "start", indices: [0] }],
      }),
    );

    const measureAll = (data: IRow[]) => {
      for (const row of data) runtime.setItemSize(row.id, row.size);
      nextFrame();
    };

    runtime.setAdapter(adapter);
    runtime.setScrollLength(SCROLL_LENGTH);
    measureAll(before);

    // Разделитель целиком во вьюпорте — именно тогда он и попадает в якоря.
    runtime.setScroll(0);

    const screenTop = () =>
      (runtime.getPositionByKey("m100") ?? 0) - runtime.getScroll();
    const expected = screenTop();

    runtime.setProps(
      createProps(after, {
        ...options,
        sticky: [{ edge: "start", indices: [0, 21] }],
      }),
    );
    measureAll(after);

    expect(screenTop()).toBeCloseTo(expected, 0);
  });

  it("учитывает вклад шапки в высоту контента", () => {
    const { runtime } = createRuntime();

    runtime.setContentSize(4060);
    runtime.setScroll(3560);

    // Без учёта шапки список считал бы, что скролл ушёл за конец контента.
    expect(runtime.getRange().end).toBe(39);
  });

  it("уведомляет о видимых элементах", () => {
    const onViewableItemsChanged = jest.fn();
    const { runtime } = createRuntime(rows(40), {
      viewabilityPairs: [
        { config: { itemVisiblePercentThreshold: 50 }, onViewableItemsChanged },
      ],
    });

    runtime.setScroll(1000);

    expect(onViewableItemsChanged).toHaveBeenCalled();
  });

  it("снимает таймеры и ожидания при размонтировании", () => {
    const { runtime } = createRuntime(rows(40), {
      getFixedItemSize: undefined,
    });

    runtime.scrollToOffset(300, true);
    runtime.dispose();

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("ListRuntime — подрезка у кромки", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16) as unknown as number;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("не подрезает строку сразу за кадром, пока список движется", () => {
    // На броске она попадает в кадр раньше, чем до неё дойдёт пересчёт:
    // подрезанное содержимое успело бы мелькнуть обрезанным.
    const { store, runtime } = createRuntime(rows(40), { drawDistance: 250 });

    runtime.setScroll(10);

    // Вьюпорт 10…510, запас подрезки — половина буфера, до 635: строка 6
    // начинается на 600 и в него попадает.
    expect(clippedByKey(store, "k6")).toBe(false);
  });

  it("подрезает строку дальше запаса", () => {
    const { store, runtime } = createRuntime(rows(40), { drawDistance: 250 });

    runtime.setScroll(10);

    // Строка 7 начинается на 700, а подрезка снимается только до 635.
    expect(clippedByKey(store, "k7")).toBe(true);
  });

  /**
   * Жалоба: строка выше вьюпорта выросла — и на экране мелькнуло поверх
   * видимых строк.
   *
   * Между тем, как React отрисовал строку новой высотой, и тем, как список
   * узнал эту высоту замером, проходит кадр. В этом кадре строка нарисована
   * выше, чем отведённое ей место, и разница вылезает за её границы — вниз, в
   * кадр. Запас подрезки заведён ради броска: там строка въезжает в кадр раньше
   * пересчёта, и подрезанной её видно. Пока список стоит, въезжать нечему, а
   * запас как раз и оставляет наползанию дорогу.
   *
   * При заранее известных высотах этого не бывает: размер приходит вместе с
   * данными, и расхождению взяться неоткуда.
   */
  it("подрезает строку вплотную за кадром, когда список стоит", () => {
    const { store, runtime } = createRuntime(rows(40), { drawDistance: 250 });

    runtime.setScroll(10);
    expect(clippedByKey(store, "k6")).toBe(false);

    // Скролл встал: событий больше нет.
    jest.advanceTimersByTime(500);

    expect(clippedByKey(store, "k6")).toBe(true);
  });
});
