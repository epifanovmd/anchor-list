/*
 * Хук здесь не хук: Reanimated подменён, реакции вызываются вручную — правило
 * про порядок вызова хуков проверяет несуществующее.
 */

import { act, createElement } from "react";
import type Animated from "react-native-reanimated";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";
import TestRenderer from "react-test-renderer";

/**
 * Реакции, заведённые хуком: тест вызывает их сам, кадрами.
 *
 * Префикс `mock` обязателен: только такие имена jest пускает внутрь фабрики
 * подмены модуля.
 */
const mockReactions: {
  prepare: () => unknown;
  react: (value: never) => void;
}[] = [];
const mockScrollTo = jest.fn();

/**
 * Reanimated в node не поднимается, а нужен здесь не он: проверяется решение
 * хука — просить ли у нативного скролла новое смещение. `useAnimatedReaction`
 * поэтому только запоминает пару, а кадры двигает тест.
 */
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {},
  makeMutable: <T>(value: T) => ({ value }),
  useSharedValue: <T>(value: T) => ({ value }),
  useAnimatedReaction: (
    prepare: () => unknown,
    react: (value: never) => void,
  ) => mockReactions.push({ prepare, react }),
  scrollTo: (...args: unknown[]) => mockScrollTo(...args),
}));

// Импорт после мока: модуль тянет Reanimated на верхнем уровне.
const { useInsetEnd } = require("../useInsetEnd") as {
  useInsetEnd: (options: Record<string, unknown>) => unknown;
};

const sharedValue = <T>(value: T) => ({ value }) as SharedValue<T>;

const VIEWPORT = 500;
/** Контента заметно больше экрана: подъём достаётся смещению, а не выравниванию. */
const CONTENT = 20000;
/** Домашний индикатор: столько прибавляется к отступу вторым кадром. */
const HOME_INDICATOR = 34;

const setup = (options: { inset?: number; revealed?: boolean } = {}) => {
  mockReactions.length = 0;
  mockScrollTo.mockClear();

  const insetEnd = sharedValue(options.inset ?? 0);
  const scrollOffset = sharedValue(0);
  const revealed = sharedValue(options.revealed ?? false);

  // Хук зовётся из дерева: внутри он держит `useMemo`, а тому нужен рендер.
  const Probe = () => {
    useInsetEnd({
      insetEnd,
      alignItemsAtEnd: false,
      totalSize: sharedValue(CONTENT),
      headerSize: sharedValue(0),
      footerSize: sharedValue(0),
      anchoredEndSpaceSize: sharedValue(0),
      scrollLength: sharedValue(VIEWPORT),
      contentSize: sharedValue(CONTENT),
      scrollRef: {} as AnimatedRef<Animated.ScrollView>,
      scrollOffset,
      isDragging: sharedValue(false),
      isMomentum: sharedValue(false),
      revealed,
    });

    return null;
  };

  act(() => {
    TestRenderer.create(createElement(Probe));
  });

  /** Кадр: реакция читает свои входы и решает, что с ними делать. */
  const frame = () => {
    for (const { prepare, react } of mockReactions) {
      react(prepare() as never);
    }
  };

  return { insetEnd, scrollOffset, revealed, frame };
};

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

describe("useInsetEnd", () => {
  beforeAll(() => {
    (globalThis as IActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
    silenceRendererNotice();
  });

  it("не двигает смещение от отступа, который не менялся", () => {
    // Безопасная зона известна с первого же кадра — так бывает чаще всего.
    const { frame } = setup({ inset: HOME_INDICATOR, revealed: true });

    // Первый кадр задаёт точку отсчёта, следующий приходит от замера строки:
    // отступ на нём тот же самый, и двигать список не от чего.
    frame();
    frame();

    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it("не двигает смещение, пока список не показан", () => {
    const { insetEnd, revealed, frame } = setup();

    // Первый кадр с вьюпортом: отступ ещё не известен приложению.
    frame();

    // Безопасная зона доехала до того, как список показался.
    revealed.value = false;
    insetEnd.value = HOME_INDICATOR;
    frame();

    // Показывать было нечего: видимого содержимого ещё нет, а смещение
    // принадлежит доводке стартовой позиции. Подъём здесь уводит первую строку
    // за верхнюю кромку — это и видно при открытии.
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it("поднимает смещение, когда отступ меняется у показанного списка", () => {
    const { insetEnd, revealed, frame } = setup();

    revealed.value = true;
    frame();

    insetEnd.value = HOME_INDICATOR;
    frame();

    expect(mockScrollTo).toHaveBeenCalledWith({}, 0, HOME_INDICATOR, false);
  });

  it("после показа считает отступ от того, каким он стал за время ожидания", () => {
    const { insetEnd, revealed, frame } = setup();

    frame();
    insetEnd.value = HOME_INDICATOR;
    frame();

    // Список показан, отступ с тех пор не менялся — двигать нечего.
    revealed.value = true;
    frame();

    expect(mockScrollTo).not.toHaveBeenCalled();
  });
});
