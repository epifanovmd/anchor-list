import { ListRuntime } from "../../core/runtime/list-runtime";
import type { IAnchorListRuntimeProps } from "../../core/runtime/runtime-props";
import { ListStore } from "../../model";
import { anchorListDebug, setAnchorListDebug } from "../debug-control";

interface IRow {
  id: string;
}

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

  it("печатает переработку, когда контейнер действительно сменил элемент", () => {
    runtime.setScroll(2000, 1000);

    const recycled = linesOf("layout·recycle");

    expect(recycled.length).toBeGreaterThan(0);
    expect(recycled[0]).toMatch(/from=k\d+ to=k\d+/);
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

  it("считает рывком дельту, выпавшую из ряда", () => {
    runtime.setScroll(120, 1000);
    runtime.setScroll(240, 1016);
    runtime.setScroll(1240, 1032);

    expect(linesOf("scroll·jump")).toHaveLength(1);
    expect(linesOf("scroll·jump")[0]).toContain("delta=+1000");
  });

  it("печатает диапазон и раздачу на каждом изменении раскладки", () => {
    runtime.setScroll(1200, 1000);

    expect(linesOf("layout·range").length).toBeGreaterThan(0);
    expect(linesOf("layout·bind").length).toBeGreaterThan(0);
  });

  it("печатает замер, разошедшийся с оценкой, и его компенсацию", () => {
    runtime.setItemSize("k3", 160);

    const measured = linesOf("layout·measure");

    expect(measured).toHaveLength(1);
    expect(measured[0]).toContain("from=100 to=160 delta=+60");
    expect(measured[0]).toContain("compensated=да");
  });
});
