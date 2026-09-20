/*
 * Хук здесь не хук: Reanimated подменён, и `useDerivedValue` вызывает своё
 * тело сразу — правило про порядок вызова хуков проверяет несуществующее.
 */
import { act, createElement } from "react";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

import type { IAnchorListContextValue } from "../../model";
import {
  ListContextProvider,
  ListItemFrameProvider,
  ListItemKeyProvider,
  ListStore,
} from "../../model";

/**
 * Reanimated в node не поднимается, а нужен здесь не он: проверяется то, что
 * считает worklet. `useDerivedValue` подменяется на «выполнить сразу и вернуть
 * носитель значения» — ровно то, что он делает при первом проходе на устройстве.
 */
jest.mock("react-native-reanimated", () => ({
  useDerivedValue: <TValue>(compute: () => TValue) => ({ value: compute() }),
}));

// Импорт после мока: модуль тянет Reanimated на верхнем уровне.
const { useAnchorListItemVisibility } =
  require("../useAnchorListItemVisibility") as {
    useAnchorListItemVisibility: () => SharedValue<number>;
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

let observed: number | undefined;

const Row = () => {
  observed = useAnchorListItemVisibility().value;

  return null;
};

interface IRenderOptions {
  position: number;
  size: number;
  scroll?: number;
  insetEnd?: number;
  shift?: number;
}

/** Ячейка внутри списка с заданной геометрией. */
const renderCell = ({
  position,
  size,
  scroll = 0,
  insetEnd,
  shift,
}: IRenderOptions) => {
  observed = undefined;

  const context: IAnchorListContextValue = {
    store: new ListStore(),
    runtime: {} as IAnchorListContextValue["runtime"],
    scrollOffset: sharedValue(scroll),
    sticky: [],
    stickyPinned: { start: sharedValue(-1), end: sharedValue(-1) },
    horizontal: false,
    layout: {
      scrollLength: sharedValue(500),
      contentOrigin: sharedValue(0),
      insetEnd: insetEnd === undefined ? undefined : sharedValue(insetEnd),
      alignOffset: sharedValue(0),
    },
  };

  act(() => {
    TestRenderer.create(
      createElement(
        ListContextProvider,
        { value: context },
        createElement(
          ListItemKeyProvider,
          { value: "a" },
          createElement(
            ListItemFrameProvider,
            {
              value: {
                position,
                size,
                shift: shift === undefined ? undefined : sharedValue(shift),
              },
            },
            createElement(Row),
          ),
        ),
      ),
    );
  });

  return observed;
};

describe("useAnchorListItemVisibility", () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("отдаёт долю строки во вьюпорте", () => {
    expect(renderCell({ position: 450, size: 100 })).toBe(0.5);
  });

  it("считает от живого смещения скролла", () => {
    expect(renderCell({ position: 0, size: 100, scroll: 25 })).toBe(0.75);
  });

  it("вычитает нижний отступ списка: под панелью ввода строки не видно", () => {
    expect(renderCell({ position: 250, size: 100, insetEnd: 200 })).toBe(0.5);
  });

  it("учитывает сдвиг прилипшего якоря", () => {
    expect(renderCell({ position: 600, size: 100, shift: -200 })).toBe(1);
  });

  it("не работает вне ячейки списка", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Та же строка, но без контекстов ячейки: узел отрисован вне списка.
    expect(() => {
      act(() => {
        TestRenderer.create(createElement(Row));
      });
    }).toThrow("useAnchorListItemVisibility");
  });
});
