import type { IAnchorListProps } from "../../../types";
import { createRuntimeProps } from "../runtime-props";

interface IRow {
  id: string;
  system?: boolean;
}

const rows: IRow[] = [{ id: "a" }, { id: "b", system: true }, { id: "c" }];

const baseProps = (
  overrides: Partial<IAnchorListProps<IRow>> = {},
): IAnchorListProps<IRow> => ({
  data: rows,
  renderItem: () => null,
  keyExtractor: item => item.id,
  estimatedItemSize: 100,
  ...overrides,
});

describe("createRuntimeProps — значения по умолчанию", () => {
  it("подставляет запас отрисовки и пороги", () => {
    const props = createRuntimeProps(baseProps());

    expect(props.drawDistance).toBe(400);
    expect(props.startReachedThreshold).toBe(0.5);
    expect(props.endReachedThreshold).toBe(0.5);
    expect(props.maintainScrollAtEndThreshold).toBe(0.1);
    expect(props.recycleItems).toBe(false);
  });

  it("не перебивает заданные значения", () => {
    const props = createRuntimeProps(
      baseProps({
        drawDistance: 600,
        onStartReachedThreshold: 0.2,
        onEndReachedThreshold: 0.3,
        maintainScrollAtEndThreshold: 0.4,
      }),
    );

    expect(props.drawDistance).toBe(600);
    expect(props.startReachedThreshold).toBe(0.2);
    expect(props.endReachedThreshold).toBe(0.3);
    expect(props.maintainScrollAtEndThreshold).toBe(0.4);
  });
});

describe("createRuntimeProps — разбор вложенных объектов", () => {
  it("разворачивает удержание позиции в два флага", () => {
    const off = createRuntimeProps(baseProps());

    expect(off.maintainVisibleContentPositionData).toBe(false);
    expect(off.maintainVisibleContentPositionSize).toBe(false);

    const on = createRuntimeProps(
      baseProps({ maintainVisibleContentPosition: { data: true } }),
    );

    expect(on.maintainVisibleContentPositionData).toBe(true);
    expect(on.maintainVisibleContentPositionSize).toBe(false);
  });

  it("разворачивает автоприлипание к концу", () => {
    expect(createRuntimeProps(baseProps()).maintainScrollAtEnd).toBe(false);

    const props = createRuntimeProps(
      baseProps({ maintainScrollAtEnd: { animated: true } }),
    );

    expect(props.maintainScrollAtEnd).toBe(true);
    expect(props.maintainScrollAtEndAnimated).toBe(true);
  });

  it("считает прилипание неанимированным по умолчанию", () => {
    const props = createRuntimeProps(baseProps({ maintainScrollAtEnd: {} }));

    expect(props.maintainScrollAtEnd).toBe(true);
    expect(props.maintainScrollAtEndAnimated).toBe(false);
  });
});

describe("createRuntimeProps — выбор якоря", () => {
  it("не создаёт переходника, когда правило не задано", () => {
    const props = createRuntimeProps(
      baseProps({ maintainVisibleContentPosition: { data: true } }),
    );

    expect(props.shouldRestorePosition).toBeUndefined();
  });

  it("переводит правило с элемента на индекс", () => {
    const props = createRuntimeProps(
      baseProps({
        maintainVisibleContentPosition: {
          data: true,
          shouldRestorePosition: item => !item.system,
        },
      }),
    );

    expect(props.shouldRestorePosition!(0)).toBe(true);
    expect(props.shouldRestorePosition!(1)).toBe(false);
  });

  it("запрещает якорь на несуществующем индексе", () => {
    const props = createRuntimeProps(
      baseProps({
        maintainVisibleContentPosition: {
          data: true,
          shouldRestorePosition: () => true,
        },
      }),
    );

    // Данные могли смениться между снятием якоря и проверкой.
    expect(props.shouldRestorePosition!(99)).toBe(false);
  });

  it("считает разрешением молчание правила", () => {
    const props = createRuntimeProps(
      baseProps({
        maintainVisibleContentPosition: {
          data: true,
          shouldRestorePosition: () => undefined as unknown as boolean,
        },
      }),
    );

    expect(props.shouldRestorePosition!(0)).toBe(true);
  });
});

describe("createRuntimeProps — проброс", () => {
  it("передаёт колбэки и конфигурации как есть", () => {
    const onLoad = jest.fn();
    const onStartReached = jest.fn();
    const onEndReached = jest.fn();
    const sticky = [{ edge: "start" as const, indices: [0] }];
    const anchoredEndSpace = { anchorIndex: 2 };
    const initialScroll = { type: "end" as const };

    const props = createRuntimeProps(
      baseProps({
        onLoad,
        onStartReached,
        onEndReached,
        sticky,
        anchoredEndSpace,
        initialScroll,
      }),
    );

    expect(props.onLoad).toBe(onLoad);
    expect(props.onStartReached).toBe(onStartReached);
    expect(props.onEndReached).toBe(onEndReached);
    expect(props.sticky).toBe(sticky);
    expect(props.anchoredEndSpace).toBe(anchoredEndSpace);
    expect(props.initialScroll).toBe(initialScroll);
    expect(props.data).toBe(rows);
  });
});
