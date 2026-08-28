/** Счётчики окна: сколько раз событие произошло. */
export type ListPerfCounter =
  | "scrollEvents"
  | "rangeCalc"
  | "passDeferred"
  | "passMerged"
  | "bind"
  | "bindCached"
  | "bindSkipped"
  | "rebind"
  | "release"
  | "containerNew"
  | "measure"
  | "measureApplied"
  | "measureSkipped"
  | "flush"
  | "mvcpCapture"
  | "mvcpRestore"
  | "mvcpByData"
  | "mvcpBySize"
  | "mvcpClamped"
  | "mvcpNoAnchor"
  | "mvcpFallbackAnchor"
  | "mvcpMissed"
  | "blankFrames"
  | "blankAfterBind"
  | "stickyPinned"
  | "cellRender"
  | "renderItem";

/** Величины окна: копятся суммой, средним и максимумом. */
export type ListPerfStat =
  | "scrollPx"
  | "velocity"
  | "lagPx"
  | "scrollMs"
  | "rangeMs"
  | "windowItems"
  | "containers"
  | "blankPx"
  | "blankAfterPx"
  | "stickyMs"
  | "flushMs"
  | "flushDelayMs"
  | "resizePx"
  | "mvcpShiftPx"
  | "mvcpLostPx"
  | "mvcpErrorPx";

const COUNTERS: ListPerfCounter[] = [
  "scrollEvents",
  "rangeCalc",
  "passDeferred",
  "passMerged",
  "bind",
  "bindCached",
  "bindSkipped",
  "rebind",
  "release",
  "containerNew",
  "measure",
  "measureApplied",
  "measureSkipped",
  "flush",
  "mvcpCapture",
  "mvcpRestore",
  "mvcpByData",
  "mvcpBySize",
  "mvcpClamped",
  "mvcpNoAnchor",
  "mvcpFallbackAnchor",
  "mvcpMissed",
  "blankFrames",
  "blankAfterBind",
  "stickyPinned",
  "cellRender",
  "renderItem",
];

const STATS: ListPerfStat[] = [
  "scrollPx",
  "velocity",
  "lagPx",
  "scrollMs",
  "rangeMs",
  "windowItems",
  "containers",
  "blankPx",
  "blankAfterPx",
  "stickyMs",
  "flushMs",
  "flushDelayMs",
  "resizePx",
  "mvcpShiftPx",
  "mvcpLostPx",
  "mvcpErrorPx",
];

/** Накопленная величина: сколько замеров, их сумма и максимум. */
export interface IListPerfStatValue {
  count: number;
  sum: number;
  max: number;
}

/** Накопленные за окно замера числа. */
export interface IListPerfWindow {
  counters: Record<ListPerfCounter, number>;
  stats: Record<ListPerfStat, IListPerfStatValue>;
}

/** Пустое окно: все счётчики и величины обнулены. */
export const createListPerfWindow = (): IListPerfWindow => {
  const counters = {} as Record<ListPerfCounter, number>;
  const stats = {} as Record<ListPerfStat, IListPerfStatValue>;

  for (const name of COUNTERS) counters[name] = 0;
  for (const name of STATS) stats[name] = { count: 0, sum: 0, max: 0 };

  return { counters, stats };
};

/** Слить окно в накопитель сессии: суммы складываются, максимумы берутся большим. */
export const mergeListPerfWindow = (
  target: IListPerfWindow,
  source: IListPerfWindow,
): void => {
  for (const name of COUNTERS) target.counters[name] += source.counters[name];

  for (const name of STATS) {
    const to = target.stats[name];
    const from = source.stats[name];

    to.count += from.count;
    to.sum += from.sum;
    to.max = Math.max(to.max, from.max);
  }
};

/** Часы замера: монотонные, если движок их даёт. */
export const perfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
