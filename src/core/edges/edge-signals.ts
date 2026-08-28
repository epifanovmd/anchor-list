import type { ListStore } from "../../model";
import type { IEdgeGeometry } from "./edge-geometry";

/** Расстояние, в пределах которого кромка считается достигнутой точно. */
const EDGE_EPSILON = 1;

/** Пороги кромок в пикселях — уже переведённые из долей вьюпорта. */
export interface IEdgeSignalThresholds {
  /** Пороги в пикселях: доля вьюпорта уже применена. */
  startThreshold: number;
  endThreshold: number;
  maintainScrollAtEndThreshold: number;
}

/**
 * Публикация состояния кромок в сигналы.
 *
 * Зачем нужна: сигналы читают и панель ввода, и автоприлипание к концу, и
 * внешний код через `sharedValues`. Считать «близко ли к концу» каждому из них
 * самостоятельно — значит получить три расходящихся ответа.
 *
 * Обновляются всегда, даже когда колбэки подгрузки подавлены: подавление
 * касается вызовов наружу, а состояние списка от этого не перестаёт быть
 * правдой.
 */
export const publishEndSignals = (
  store: ListStore,
  { distanceFromEnd, isContentShorter }: IEdgeGeometry,
  { endThreshold, maintainScrollAtEndThreshold }: IEdgeSignalThresholds,
): void => {
  store.set("distanceFromEnd", distanceFromEnd);
  store.set("isAtEnd", isContentShorter || distanceFromEnd <= EDGE_EPSILON);
  store.set("isNearEnd", isContentShorter || distanceFromEnd <= endThreshold);
  store.set(
    "isWithinMaintainScrollAtEndThreshold",
    isContentShorter || distanceFromEnd <= maintainScrollAtEndThreshold,
  );
};

/** Состояние начальной кромки; см. {@link publishEndSignals}. */
export const publishStartSignals = (
  store: ListStore,
  { distanceFromStart }: IEdgeGeometry,
  { startThreshold }: IEdgeSignalThresholds,
): void => {
  store.set("distanceFromStart", distanceFromStart);
  store.set("isAtStart", distanceFromStart <= EDGE_EPSILON);
  store.set("isNearStart", distanceFromStart <= startThreshold);
};
