import { act, createElement } from "react";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

import type { IAnchorListContextValue } from "../../model";
import {
  ListContextProvider,
  ListItemKeyProvider,
  ListStore,
} from "../../model";

/**
 * Reanimated в node не поднимается. Носитель значения — обычный объект, а
 * анимации подменены на «сразу конечное значение»: проверяется, куда хук ведёт
 * прогресс, а не как он туда едет.
 */
jest.mock("react-native-reanimated", () => {
  const react = require("react") as typeof import("react");

  return {
    useSharedValue: <T>(initial: T) =>
      react.useState(() => ({ value: initial }))[0],
    withTiming: (value: number) => value,
    withDelay: (_delay: number, value: number) => value,
    // Последний шаг последовательности — то, где прогресс окажется в итоге.
    withSequence: (...values: number[]) => values[values.length - 1],
  };
});

// Импорт после мока: модуль тянет Reanimated на верхнем уровне.
const { useAnchorListItemHighlight } =
  require("../useAnchorListItemHighlight") as {
    useAnchorListItemHighlight: () => {
      isHighlighted: boolean;
      progress: SharedValue<number>;
    };
  };

const sharedValue = <T>(value: T) => ({ value }) as SharedValue<T>;

/** Рендерер предупреждает о своей устарелости — в выводе это лишний шум. */
const silenceRendererNotice = () => {
  const error = console.error;

  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;

    error(...args);
  });
};

interface IFrame {
  isHighlighted: boolean;
  progress: number;
}

let frames: IFrame[] = [];

const Row = () => {
  const { isHighlighted, progress } = useAnchorListItemHighlight();

  frames.push({ isHighlighted, progress: progress.value });

  return null;
};

const createContext = (store: ListStore): IAnchorListContextValue => ({
  store,
  runtime: {} as IAnchorListContextValue["runtime"],
  scrollOffset: sharedValue(0),
  sticky: [],
  stickyPinned: { start: sharedValue(-1), end: sharedValue(-1) },
  horizontal: false,
  layout: {
    scrollLength: sharedValue(500),
    contentOrigin: sharedValue(0),
    insetEnd: undefined,
    alignOffset: sharedValue(0),
  },
});

/** Ячейка с ключом внутри списка; ключ можно сменить, как при переработке. */
const renderCell = (store: ListStore, firstKey: string) => {
  frames = [];

  const tree = (itemKey: string) =>
    createElement(
      ListContextProvider,
      { value: createContext(store) },
      createElement(
        ListItemKeyProvider,
        { value: itemKey },
        createElement(Row),
      ),
    );

  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(tree(firstKey));
  });

  return {
    last: () => frames[frames.length - 1]!,
    renders: () => frames.length,
    rebind: (itemKey: string) => act(() => renderer.update(tree(itemKey))),
  };
};

const highlight = (store: ListStore, key: string, seq = 1) =>
  act(() => {
    store.set("highlight", { key, duration: 1000, fade: 100, seq });
  });

describe("useAnchorListItemHighlight", () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("в покое не подсвечена", () => {
    const cell = renderCell(new ListStore(), "a");

    expect(cell.last()).toEqual({ isHighlighted: false, progress: 0 });
  });

  it("загорается на подсветку своего ключа", () => {
    const store = new ListStore();
    const cell = renderCell(store, "a");

    highlight(store, "a");

    expect(cell.last().isHighlighted).toBe(true);
  });

  it("не реагирует на подсветку чужого ключа — и не перерисовывается", () => {
    const store = new ListStore();
    const cell = renderCell(store, "a");
    const before = cell.renders();

    highlight(store, "b");

    expect(cell.last().isHighlighted).toBe(false);
    expect(cell.renders()).toBe(before);
  });

  it("гаснет, когда подсветка догорела", () => {
    const store = new ListStore();
    const cell = renderCell(store, "a");

    highlight(store, "a");
    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(cell.last().isHighlighted).toBe(false);
  });

  it("повторная подсветка того же ключа загорается снова", () => {
    const store = new ListStore();
    const cell = renderCell(store, "a");

    highlight(store, "a", 1);
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    highlight(store, "a", 2);

    expect(cell.last().isHighlighted).toBe(true);
  });

  it("гаснет, когда контейнер перешёл к другой строке", () => {
    // Переработка: тот же узел, другой ключ. Подсветка адресована прежней
    // строке и уходить с ней в чужую не должна.
    const store = new ListStore();
    const cell = renderCell(store, "a");

    highlight(store, "a");
    cell.rebind("b");

    expect(cell.last().isHighlighted).toBe(false);
  });

  it("гаснет по снятию сигнала", () => {
    const store = new ListStore();
    const cell = renderCell(store, "a");

    highlight(store, "a");
    act(() => {
      store.set("highlight", null);
    });

    expect(cell.last().isHighlighted).toBe(false);
  });

  it("не работает вне ячейки списка", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      act(() => {
        TestRenderer.create(createElement(Row));
      });
    }).toThrow("useAnchorListItemHighlight");
  });
});
