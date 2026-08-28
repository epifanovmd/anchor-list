import type { ListStore } from "../../model";
import type { IEdgeGeometry } from "./edge-geometry";
import type { IEdgeSignalThresholds } from "./edge-state";
import { getEdgeState } from "./edge-state";

export type { IEdgeSignalThresholds };

/**
 * Публикация состояния кромок в сигналы.
 *
 * Зачем нужна: сигналы читают и панель ввода, и автоприлипание к концу, и
 * внешний код через `state`. Считать «близко ли к концу» каждому из них
 * самостоятельно — значит получить три расходящихся ответа.
 *
 * Само состояние считает {@link getEdgeState} — тот же расчёт идёт на
 * UI-потоке, где оно публикуется покадрово. Здесь остаётся только запись.
 *
 * Обновляются всегда, даже когда колбэки подгрузки подавлены: подавление
 * касается вызовов наружу, а состояние списка от этого не перестаёт быть
 * правдой.
 */
export const publishEndSignals = (
  store: ListStore,
  geometry: IEdgeGeometry,
  thresholds: IEdgeSignalThresholds,
): void => {
  const state = getEdgeState(geometry, thresholds);

  store.set("distanceFromEnd", state.distanceFromEnd);
  store.set("isAtEnd", state.isAtEnd);
  store.set("isNearEnd", state.isNearEnd);
  store.set(
    "isWithinMaintainScrollAtEndThreshold",
    state.isWithinMaintainScrollAtEndThreshold,
  );
};

/** Состояние начальной кромки; см. {@link publishEndSignals}. */
export const publishStartSignals = (
  store: ListStore,
  geometry: IEdgeGeometry,
  thresholds: IEdgeSignalThresholds,
): void => {
  const state = getEdgeState(geometry, thresholds);

  store.set("distanceFromStart", state.distanceFromStart);
  store.set("isAtStart", state.isAtStart);
  store.set("isNearStart", state.isNearStart);
};
