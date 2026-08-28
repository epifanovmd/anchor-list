import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { getEdgeGeometry, getEdgeState } from "../core";
import type { IAnchorListSharedValues } from "../types";

/** Геометрия контента на UI-потоке; меняется на раскладке, а не покадрово. */
export interface IEdgeGeometryValues {
  contentSize: SharedValue<number>;
  scrollLength: SharedValue<number>;
  /** Распорка у конца: расстоянием до кромки не считается. */
  anchoredEndSpaceSize: SharedValue<number>;
}

/** Пороги кромок долями вьюпорта — как их задаёт вызывающий. */
export interface IEdgeThresholdFractions {
  startThreshold: number;
  endThreshold: number;
  maintainScrollAtEndThreshold: number;
}

/**
 * Расстояния до кромок и флаги — покадрово, на UI-потоке.
 *
 * Зачем нужно: всё это выводится из смещения скролла и геометрии контента, а
 * смещение попадает на UI-поток каждым кадром. Гонять такой расчёт через JS
 * незачем — и вредно: переход в JS идёт шагами (`scrollThrottleDistance`), и
 * значения обновлялись бы ступенями. Тень под навбаром, свой скроллбар и
 * кнопка «вниз» дёргались бы вместе с ними.
 *
 * Какую проблему решает: единственного писателя. Те же величины публикуются в
 * сигналы стора для канала `state` — там они ступенчаты и такими остаются,
 * потому что рендер React непрерывным быть и не должен. А в `sharedValues` их
 * пишет только этот расчёт: два писателя на одно значение давали бы мигание,
 * когда следом за свежим кадром приходит отставший проход JS.
 *
 * Пересчитывается и при изменении геометрии: контент вырос — расстояние до
 * конца изменилось, хотя палец не двигался.
 */
export const useEdgeSharedValues = (
  scrollOffset: SharedValue<number>,
  sharedValues: IAnchorListSharedValues | undefined,
  geometry: IEdgeGeometryValues,
  thresholds: IEdgeThresholdFractions,
): void => {
  const { startThreshold, endThreshold, maintainScrollAtEndThreshold } =
    thresholds;

  useDerivedValue(() => {
    if (!sharedValues) return 0;

    const scrollLength = geometry.scrollLength.value;
    const state = getEdgeState(
      getEdgeGeometry({
        scroll: scrollOffset.value,
        scrollLength,
        contentSize: geometry.contentSize.value,
        contentInsetEnd: geometry.anchoredEndSpaceSize.value,
      }),
      // Доли вьюпорта переводятся в пиксели здесь же: вьюпорт известен, а
      // считать это в JS значило бы снова ждать его прохода.
      {
        startThreshold: startThreshold * scrollLength,
        endThreshold: endThreshold * scrollLength,
        maintainScrollAtEndThreshold:
          maintainScrollAtEndThreshold * scrollLength,
      },
    );

    if (sharedValues.distanceFromStart) {
      sharedValues.distanceFromStart.value = state.distanceFromStart;
    }
    if (sharedValues.distanceFromEnd) {
      sharedValues.distanceFromEnd.value = state.distanceFromEnd;
    }
    if (sharedValues.isAtStart) {
      sharedValues.isAtStart.value = state.isAtStart;
    }
    if (sharedValues.isAtEnd) {
      sharedValues.isAtEnd.value = state.isAtEnd;
    }
    if (sharedValues.isNearStart) {
      sharedValues.isNearStart.value = state.isNearStart;
    }
    if (sharedValues.isNearEnd) {
      sharedValues.isNearEnd.value = state.isNearEnd;
    }
    if (sharedValues.isWithinMaintainScrollAtEndThreshold) {
      sharedValues.isWithinMaintainScrollAtEndThreshold.value =
        state.isWithinMaintainScrollAtEndThreshold;
    }

    return state.distanceFromEnd;
  });
};
