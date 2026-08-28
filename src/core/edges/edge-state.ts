import type { IEdgeGeometry } from "./edge-geometry";

/** Расстояние, в пределах которого кромка считается достигнутой точно. */
const EDGE_EPSILON = 1;

/** Пороги кромок в пикселях — уже переведённые из долей вьюпорта. */
export interface IEdgeSignalThresholds {
  startThreshold: number;
  endThreshold: number;
  maintainScrollAtEndThreshold: number;
}

/** Состояние обеих кромок на текущей позиции. */
export interface IEdgeState {
  distanceFromStart: number;
  distanceFromEnd: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  isNearStart: boolean;
  isNearEnd: boolean;
  isWithinMaintainScrollAtEndThreshold: boolean;
}

/**
 * Состояние кромок из геометрии и порогов.
 *
 * Worklet: считается и в JS — для сигналов стора, — и на UI-потоке, где то же
 * состояние публикуется покадрово. Формула обязана быть одна: две копии
 * разошлись бы на границах порогов, и «близко к концу» отвечало бы по-разному
 * в зависимости от того, кто спросил.
 *
 * Короткий контент — отдельный случай: когда его меньше вьюпорта, конец
 * достигнут при любом смещении, и расстояние до него тут ничего не решает.
 */
export const getEdgeState = (
  { distanceFromStart, distanceFromEnd, isContentShorter }: IEdgeGeometry,
  {
    startThreshold,
    endThreshold,
    maintainScrollAtEndThreshold,
  }: IEdgeSignalThresholds,
): IEdgeState => {
  "worklet";

  return {
    distanceFromStart,
    distanceFromEnd,
    isAtStart: distanceFromStart <= EDGE_EPSILON,
    isAtEnd: isContentShorter || distanceFromEnd <= EDGE_EPSILON,
    isNearStart: distanceFromStart <= startThreshold,
    isNearEnd: isContentShorter || distanceFromEnd <= endThreshold,
    isWithinMaintainScrollAtEndThreshold:
      isContentShorter || distanceFromEnd <= maintainScrollAtEndThreshold,
  };
};
