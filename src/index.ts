/**
 * `AnchorList` — виртуализированный список для React Native.
 *
 * Удерживает видимую позицию при изменениях выше вьюпорта, прилипает якорями к
 * обеим кромкам и отдаёт своё состояние на UI-поток.
 *
 * Наружу выходит только то, чем списком пользуются: сам компонент, его типы,
 * два способа читать состояние списка — `sharedValues` для UI-потока и
 * `useAnchorListState` для JS — и состояние отдельной ячейки,
 * `useAnchorListItemState`, переживающее переработку контейнера. Внутренности (контейнеры, пул, метрики, стор,
 * компенсация позиции) остаются внутри: они меняются вместе с реализацией, и
 * опираться на них нельзя.
 */
export { AnchorList } from "./components";
export {
  useAnchorListItemState,
  useAnchorListState,
  useAnchorListValue,
} from "./hooks";
export type {
  AnchorListSignalMap,
  AnchorListSignalName,
  IAnchorListSignals,
} from "./model";
export { AnchorListState } from "./model";
export * from "./types";

/**
 * Диагностика прилипания: печатает выбор якоря, его геометрию у контейнера и
 * состояние worklet-а смещения. Выключена по умолчанию.
 */
export { anchorListStickyDebug } from "./debug";
export { setStickyDebug } from "./debug/sticky-debug-flag";

/**
 * Замер производительности списка.
 *
 * Выключен по умолчанию и стоит одной проверки флага на точку замера. Включается
 * на время стенда: `anchorListPerf.start(label)` или `useAnchorListPerf(label)`.
 */
export type {
  ListPerfCounter as AnchorListPerfCounter,
  ListPerfStat as AnchorListPerfStat,
  IFrameStats as IAnchorListFrameStats,
  IListPerfReport as IAnchorListPerfReport,
  IListPerfStatValue as IAnchorListPerfStatValue,
  IListPerfWindow as IAnchorListPerfWindow,
} from "./perf";
export {
  listPerf as anchorListPerf,
  useListPerf as useAnchorListPerf,
} from "./perf";
