/*
 * Хук здесь не хук: Reanimated подменён, и `useDerivedValue` вызывает своё
 * тело сразу — правило про порядок вызова хуков проверяет несуществующее.
 */
/* eslint-disable react-hooks/rules-of-hooks */
import type { SharedValue } from "react-native-reanimated";

import { ListStore } from "../../model";
import type { IAnchorListSharedValues } from "../../types";
import type {
  IEdgeGeometryValues,
  IEdgeThresholdFractions,
} from "../useEdgeSharedValues";

/**
 * Reanimated в node не поднимается, а нужен здесь не он: проверяется то, что
 * пишет worklet. `useDerivedValue` подменяется на «выполнить сразу и вернуть
 * носитель значения» — ровно то, что он делает при первом проходе на устройстве.
 */
jest.mock("react-native-reanimated", () => ({
  useDerivedValue: <TValue>(compute: () => TValue) => ({ value: compute() }),
}));

// Импорт после мока: модуль тянет Reanimated на верхнем уровне.
const { useEdgeSharedValues } = require("../useEdgeSharedValues") as {
  useEdgeSharedValues: (
    scrollOffset: SharedValue<number>,
    sharedValues: IAnchorListSharedValues | undefined,
    geometry: IEdgeGeometryValues,
    thresholds: IEdgeThresholdFractions,
  ) => void;
};

const sharedValue = <T>(value: T) => ({ value }) as SharedValue<T>;

const VIEWPORT = 500;
const CONTENT = 4000;

const geometryOf = (
  overrides: Partial<Record<keyof IEdgeGeometryValues, number>> = {},
): IEdgeGeometryValues => ({
  contentSize: sharedValue(overrides.contentSize ?? CONTENT),
  scrollLength: sharedValue(overrides.scrollLength ?? VIEWPORT),
  anchoredEndSpaceSize: sharedValue(overrides.anchoredEndSpaceSize ?? 0),
});

/** Пороги долями вьюпорта: половина экрана до каждой кромки. */
const THRESHOLDS: IEdgeThresholdFractions = {
  startThreshold: 0.5,
  endThreshold: 0.5,
  maintainScrollAtEndThreshold: 0.1,
};

/** Все семь значений сразу — так видно, что расчёт согласован. */
const targets = () => ({
  distanceFromStart: sharedValue(-1),
  distanceFromEnd: sharedValue(-1),
  isAtStart: sharedValue(false),
  isAtEnd: sharedValue(false),
  isNearStart: sharedValue(false),
  isNearEnd: sharedValue(false),
  isWithinMaintainScrollAtEndThreshold: sharedValue(false),
});

const publish = (
  offset: number,
  overrides?: Partial<Record<keyof IEdgeGeometryValues, number>>,
) => {
  const values = targets();

  useEdgeSharedValues(
    sharedValue(offset),
    values,
    geometryOf(overrides),
    THRESHOLDS,
  );

  return values;
};

describe("useEdgeSharedValues", () => {
  it("считает расстояния до обеих кромок", () => {
    const values = publish(1000);

    expect(values.distanceFromStart.value).toBe(1000);
    // Контент 4000, вьюпорт 500: до конца остаётся 2500.
    expect(values.distanceFromEnd.value).toBe(2500);
  });

  it("не считает распорку конца расстоянием до кромки", () => {
    const values = publish(1000, { anchoredEndSpaceSize: 300 });

    expect(values.distanceFromEnd.value).toBe(2200);
  });

  it("переводит пороги из долей вьюпорта в пиксели", () => {
    // Половина вьюпорта — 250. На 240 от конца порог пройден, на 260 ещё нет.
    expect(publish(CONTENT - VIEWPORT - 240).isNearEnd.value).toBe(true);
    expect(publish(CONTENT - VIEWPORT - 260).isNearEnd.value).toBe(false);
  });

  it("зажигает флаги у самых кромок", () => {
    const atStart = publish(0);

    expect(atStart.isAtStart.value).toBe(true);
    expect(atStart.isAtEnd.value).toBe(false);

    const atEnd = publish(CONTENT - VIEWPORT);

    expect(atEnd.isAtEnd.value).toBe(true);
    expect(atEnd.isAtStart.value).toBe(false);
  });

  it("считает конец достигнутым, когда контента меньше вьюпорта", () => {
    const values = publish(0, { contentSize: 200 });

    expect(values.isAtEnd.value).toBe(true);
    expect(values.isNearEnd.value).toBe(true);
    expect(values.isWithinMaintainScrollAtEndThreshold.value).toBe(true);
  });

  /**
   * Та самая причина, ради которой расчёт переехал на UI-поток: переход в JS
   * идёт шагами, и значения, снятые со стора, обновлялись бы ступенями.
   * Здесь стор намеренно врёт — результат обязан зависеть только от смещения и
   * геометрии.
   */
  it("не берёт значения из стора", () => {
    const store = new ListStore();

    store.set("distanceFromEnd", 999999);
    store.set("isAtEnd", true);
    store.set("isNearEnd", true);

    const values = publish(0);

    expect(values.distanceFromEnd.value).toBe(3500);
    expect(values.isAtEnd.value).toBe(false);
    expect(values.isNearEnd.value).toBe(false);
  });

  it("пишет только объявленные значения", () => {
    const distanceFromEnd = sharedValue(-1);

    expect(() =>
      useEdgeSharedValues(
        sharedValue(1000),
        { distanceFromEnd },
        geometryOf(),
        THRESHOLDS,
      ),
    ).not.toThrow();

    expect(distanceFromEnd.value).toBe(2500);
  });

  it("ничего не делает без объявленных значений", () => {
    expect(() =>
      useEdgeSharedValues(
        sharedValue(1000),
        undefined,
        geometryOf(),
        THRESHOLDS,
      ),
    ).not.toThrow();
  });
});
