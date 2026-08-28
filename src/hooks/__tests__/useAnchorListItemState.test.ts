import { act, createElement } from "react";
import TestRenderer from "react-test-renderer";

import { ListItemKeyProvider } from "../../model";
import { useAnchorListItemState } from "../useAnchorListItemState";

/** Флаг, по которому React считает окружение тестовым. */
interface IActEnvironment {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}

/** Рендерер предупреждает о своей устарелости — в выводе это лишний шум. */
const silenceRendererNotice = () => {
  const error = console.error;

  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;

    error(...args);
  });
};

/** Что ячейка нарисовала на очередном рендере. */
interface IFrame {
  itemKey: string;
  value: boolean;
}

let frames: IFrame[] = [];
let update: (next: boolean) => void = () => {};

interface IRowProps {
  itemKey: string;
  getInitial: (itemKey: string) => boolean;
}

/**
 * Строка, какой её пишет пользователь: состояние живёт внутри компонента,
 * который вернул `renderItem`, а ключ приходит контекстом снаружи.
 */
const Row = ({ itemKey, getInitial }: IRowProps) => {
  const [value, setValue] = useAnchorListItemState(() => getInitial(itemKey));

  update = setValue;
  frames.push({ itemKey, value });

  return null;
};

/**
 * Контейнер, которому можно сменить элемент.
 *
 * Смена идёт через `update` того же дерева, а не пересозданием: контейнер при
 * переработке остаётся тем же узлом, и весь смысл проверки — в этом.
 */
const renderCell = (
  firstKey: string,
  getInitial: (itemKey: string) => boolean,
) => {
  frames = [];

  const tree = (itemKey: string) =>
    createElement(
      ListItemKeyProvider,
      { value: itemKey },
      createElement(Row, { itemKey, getInitial }),
    );

  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(tree(firstKey));
  });

  return {
    last: () => frames[frames.length - 1]!,
    rebind: (itemKey: string) => act(() => renderer.update(tree(itemKey))),
    set: (next: boolean) => act(() => update(next)),
  };
};

describe("useAnchorListItemState", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("начинается с начального значения", () => {
    const cell = renderCell("a", () => false);

    expect(cell.last().value).toBe(false);
  });

  it("держит состояние, пока контейнер рисует тот же элемент", () => {
    const cell = renderCell("a", () => false);

    cell.set(true);

    expect(cell.last().value).toBe(true);
  });

  /**
   * Жалоба: развернул длинное сообщение, пролистнул — и развёрнутым оказалось
   * совсем другое. Контейнер переработан под новый элемент, а `useState` внутри
   * ячейки этого не заметил и отдал ему чужое состояние.
   */
  it("сбрасывает состояние, когда контейнер берёт другой элемент", () => {
    const cell = renderCell("a", () => false);

    cell.set(true);
    cell.rebind("b");

    expect(cell.last().value).toBe(false);
  });

  /**
   * Сброс обязан случиться до коммита: кадр, нарисованный чужим состоянием, не
   * только виден — этим же кадром строку измеряют, и в метрики уходит чужая
   * высота.
   */
  it("не показывает новый элемент со старым состоянием ни на одном кадре", () => {
    const cell = renderCell("a", () => false);

    cell.set(true);
    cell.rebind("b");

    expect(frames.filter(frame => frame.itemKey === "b")).not.toContainEqual({
      itemKey: "b",
      value: true,
    });
  });

  it("берёт начальное значение у нового элемента, а не у прежнего", () => {
    const cell = renderCell("a", itemKey => itemKey === "b");

    cell.rebind("b");

    expect(cell.last().value).toBe(true);
  });

  it("возвращённый setter работает и после смены элемента", () => {
    const cell = renderCell("a", () => false);

    cell.rebind("b");
    cell.set(true);

    expect(cell.last().value).toBe(true);
  });

  it("вызов вне ячейки списка объясняет, что пошло не так", () => {
    expect(() =>
      act(() => {
        TestRenderer.create(
          createElement(Row, { itemKey: "a", getInitial: () => false }),
        );
      }),
    ).toThrow(/вне ячейки списка/);
  });
});
