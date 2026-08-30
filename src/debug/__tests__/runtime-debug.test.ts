import { ListRuntime } from "../../core/runtime/list-runtime";
import type { IAnchorListRuntimeProps } from "../../core/runtime/runtime-props";
import { ListStore } from "../../model";
import { anchorListDebug, setAnchorListDebug } from "../debug-control";

interface IRow {
  id: string;
}

/** Пятьдесят строк по сто точек: сумма элементов, от которой считается контент. */
const ITEMS_HEIGHT = 5000;

const rows = (count: number, prefix = "k"): IRow[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}` }));

const createProps = (data: IRow[]): IAnchorListRuntimeProps<IRow> => ({
  data,
  keyExtractor: item => item.id,
  estimatedItemSize: 100,
  drawDistance: 200,
  startReachedThreshold: 0.5,
  endReachedThreshold: 0.5,
  maintainScrollAtEndThreshold: 0.1,
  maintainScrollAtEnd: false,
  maintainScrollAtEndAnimated: false,
  maintainVisibleContentPositionData: true,
  maintainVisibleContentPositionSize: true,
});

/**
 * Диагностика на живом ядре.
 *
 * Проверяется не формат строк — он проверен отдельно, — а то, что каналы не
 * заливают лог там, где ничего не произошло. Диагностика, в которой шум
 * заглушает событие, хуже выключенной: по ней делают неверный вывод.
 */
describe("диагностика на проходе ядра", () => {
  let lines: string[] = [];
  let store: ListStore;
  let runtime: ListRuntime<IRow>;

  const linesOf = (event: string) => lines.filter(line => line.includes(event));

  beforeEach(() => {
    lines = [];
    anchorListDebug.configure({
      sink: line => lines.push(line),
      maxLinesPerSecond: 10_000,
    });
    setAnchorListDebug(true);

    globalThis.requestAnimationFrame = (() => 1) as never;
    globalThis.cancelAnimationFrame = (() => undefined) as never;

    store = new ListStore();
    runtime = new ListRuntime<IRow>(store, createProps(rows(50)));
    runtime.setAdapter({
      scrollToEnd: () => undefined,
      scrollToOffset: () => undefined,
      getOffset: () => 0,
    });
    runtime.setScrollLength(500);
    runtime.setContentSize(5000);
  });

  afterEach(() => {
    setAnchorListDebug(false);
    runtime.dispose();
  });

  it("не считает первую раздачу контейнеров переработкой", () => {
    // Новый контейнер переиспользовать было нечего: строка на каждый контейнер
    // списка утопила бы в первой же раздаче всё остальное.
    expect(linesOf("layout·recycle")).toHaveLength(0);
  });

  it("не печатает поштучные подробности, когда включён весь канал", () => {
    runtime.setScroll(2000, 1000);

    // Раздача и переработка идут по нескольку строк на кадр: включённые вместе
    // с каналом, они топят обзор. Сколько их было за секунду, считает замер.
    expect(linesOf("layout·recycle")).toHaveLength(0);
    expect(linesOf("layout·bind")).toHaveLength(0);
  });

  it("печатает переработку, когда её назвали по имени", () => {
    setAnchorListDebug({ layout: ["recycle"] });
    runtime.setScroll(2000, 1000);

    const recycled = linesOf("layout·recycle");

    expect(recycled.length).toBeGreaterThan(0);
    expect(recycled[0]).toMatch(/from=k\d+ to=k\d+/);
  });

  it("не печатает раздачу, ничего не изменившую", () => {
    setAnchorListDebug({ layout: ["bind"] });
    runtime.setScroll(2000, 1000);
    lines.length = 0;

    // Тот же диапазон: контейнеры уже привязаны, менять нечего.
    runtime.calculateItemsInView();

    expect(linesOf("layout·bind")).toHaveLength(0);
  });

  it("не объявляет пустотой вьюпорт скрытого списка", () => {
    runtime.setScroll(1200, 1000);

    // До первого показа в кадре нет ничего по построению: считать это дырой
    // значит объявлять пустотой каждое открытие списка.
    expect(linesOf("layout·blank")).toHaveLength(0);
  });

  it("не считает рывком первое движение из покоя", () => {
    runtime.setScroll(120, 1000);

    expect(linesOf("scroll·jump")).toHaveLength(0);
  });

  it("не считает рывком обычное событие после мелкого", () => {
    // События приходят неравномерно: посреди ровной прокрутки попадается
    // короткий промежуток между кадрами, а за ним — обычный ход. Он втрое
    // больше мелкого, но рывком не является: палец шёл ровно.
    runtime.setScroll(100, 1000);
    runtime.setScroll(125, 1016);
    runtime.setScroll(150, 1032);
    // Короткий промежуток: сдвиг за него вчетверо меньше обычного.
    runtime.setScroll(154, 1036);
    runtime.setScroll(180, 1052);

    expect(linesOf("scroll·jump")).toHaveLength(0);
  });

  it("считает рывком дельту, выпавшую из ряда", () => {
    runtime.setScroll(120, 1000);
    runtime.setScroll(240, 1016);
    runtime.setScroll(1240, 1032);

    expect(linesOf("scroll·jump")).toHaveLength(1);
    expect(linesOf("scroll·jump")[0]).toContain("delta=+1000");
  });

  it("печатает диапазон при изменении раскладки", () => {
    runtime.setScroll(1200, 1000);

    expect(linesOf("layout·range").length).toBeGreaterThan(0);
  });

  it("печатает высоту контента только при расхождении с нативной", () => {
    // Замер, который список принял: своя высота сходится с нативной, и
    // сообщать не о чем — а приходит такой замер каждый кадр прокрутки.
    runtime.setContentSize(runtime.getContentSize() + 40);

    expect(linesOf("layout·content")).toHaveLength(0);

    // Замер ниже суммы элементов принят быть не может: контент не бывает ниже
    // того, что в нём лежит, — значит замер отстал от раскладки. Вот тут
    // граница скролла и считается не по тому, что нарисовано.
    runtime.setContentSize(ITEMS_HEIGHT - 40);

    expect(linesOf("layout·content")).toHaveLength(1);
    expect(linesOf("layout·content")[0]).toContain("diff=-80");
  });

  it("печатает замер, разошедшийся с оценкой, и его компенсацию", () => {
    runtime.setItemSize("k3", 160);

    const measured = linesOf("layout·measure");

    expect(measured).toHaveLength(1);
    expect(measured[0]).toContain("from=100 to=160 delta=+60");
    expect(measured[0]).toContain("compensated=да");
  });
});
