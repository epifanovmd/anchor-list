/**
 * Каталог метрик замера.
 *
 * Устроен по тому же принципу, что и диагностика: величина существует ровно в
 * одном месте и подписана — что считает и о чём говорит. Из каталога берутся и
 * тип метрики, и пустое окно, и справка, поэтому список метрик не может
 * разойтись с тем, что печатает отчёт.
 *
 * Замер отвечает на другой вопрос, чем диагностика. Диагностика показывает, что
 * произошло в конкретном кадре; замер — сколько это стоило за окно, и сравнимо
 * ли это с прошлым прогоном. Поэтому здесь нет ни одной величины «на событие»:
 * всё копится числами и печатается пачкой.
 */

/** Счётчики: сколько раз событие произошло за окно. */
export const LIST_PERF_COUNTERS = {
  scrollEvents:
    "сколько событий скролла обработано. Знаменатель почти всего остального: работу списка меряют на событие, а не на секунду",
  rangeCalc:
    "проходов расчёта диапазона. Больше числа событий — раскладку пересчитывает что-то помимо скролла",
  passDeferred:
    "проходов, отложенных на кадр: событие пришло раньше, чем прошлый проход успел устояться",
  passMerged: "событий, слитых в один проход — сэкономленные проходы",
  passOverrun:
    "проходов без запаса по скорости: список идёт быстрее, чем успевает монтировать. Растёт на скрабе полосой",
  bind: "раздач контейнеров",
  bindCached:
    "раздач, где набор запросов повторил прошлый и пересобирать его не пришлось",
  bindSkipped:
    "раздач, не тронувших ни одного сигнала: изменилась только подрезка",
  rebind:
    "контейнеров, сменивших элемент. Это и есть цена прокрутки для React — перерисовка поддерева",
  release:
    "контейнеров, оставшихся без элемента и уведённых за пределы контента",
  containerNew:
    "созданных контейнеров. Растёт всю сессию — пул не переиспользует, и виртуализация не окупается",
  measure: "замеров строк, пришедших от раскладки",
  measureApplied: "замеров, изменивших размер: только они двигают контент",
  measureSkipped: "замеров, отброшенных как совпавшие с известным размером",
  flush: "проходов применения накопленных изменений раскладки",
  mvcpCapture: "снятых якорей компенсации",
  mvcpRestore: "восстановлений позиции",
  mvcpSecondPass:
    "восстановлений, потребовавших второго прохода раскладки: сдвиг разошёлся с предсказанным. Самый дорогой проход из всех",
  mvcpSkippedFast:
    "замеров, не компенсированных по скорости: на броске компенсация не окупается",
  mvcpByData: "восстановлений после смены данных",
  mvcpBySize: "восстановлений после замера строки",
  mvcpClamped:
    "сдвигов, обрезанных границей контента: у края списка двигать дальше некуда",
  mvcpNoAnchor:
    "изменений, прошедших без опоры вовсе. Каждое — контент, уехавший под пользователем",
  mvcpFallbackAnchor:
    "восстановлений по запасной опоре: первая видимая строка не пережила изменение",
  mvcpMissed:
    "восстановлений, где строка всё же сместилась больше чем на пиксель. Это то, что видно глазом",
  blankFrames:
    "проходов, начатых с незакрытым вьюпортом: расчёт не поспел за скроллом",
  blankAfterBind:
    "проходов, где вьюпорт остался незакрытым и после раздачи: строк на это место у списка нет вовсе",
  stickyPinned: "проходов, на которых был хотя бы один прилипший якорь",
  cellRender: "перерисовок ячеек",
  renderItem:
    "вызовов renderItem. Главное число переработки: сколько раз приложение рисовало содержимое строки",
} as const;

/** Величины: копятся суммой, средним и максимумом. */
export const LIST_PERF_STATS = {
  scrollPx: {
    about:
      "пройденное расстояние. Знаменатель для «на 1000px»: только так прогоны разной длины сравнимы между собой",
    digits: 0,
  },
  velocity: { about: "скорость скролла, px/мс", digits: 1 },
  lagPx: {
    about:
      "отставание представления списка от нативного смещения. Пустота в кадре начинается там, где оно перерастает буфер отрисовки",
    digits: 0,
  },
  scrollMs: {
    about: "время обработки события скролла в JS — цена одного прохода",
    digits: 2,
  },
  rangeMs: { about: "время расчёта диапазона", digits: 2 },
  windowItems: {
    about:
      "сколько элементов в буферизованном диапазоне: столько их смонтировано",
    digits: 0,
  },
  containers: {
    about: "сколько контейнеров существует — верхняя граница монтирования",
    digits: 0,
  },
  blankPx: { about: "высота незакрытой полосы до раздачи", digits: 0 },
  blankAfterPx: { about: "высота незакрытой полосы после раздачи", digits: 0 },
  stickyMs: { about: "время расчёта прилипания за проход", digits: 2 },
  flushMs: { about: "время применения накопленных изменений", digits: 2 },
  flushDelayMs: {
    about: "задержка между накоплением замеров и их применением",
    digits: 1,
  },
  resizePx: {
    about:
      "на сколько замер разошёлся с оценкой. Ровно это и уезжает под пользователем, если компенсация не сработала",
    digits: 0,
  },
  mvcpShiftPx: { about: "величина применённого сдвига", digits: 0 },
  mvcpLostPx: {
    about: "сколько сдвига обрезала граница контента",
    digits: 0,
  },
  mvcpErrorPx: {
    about:
      "на сколько опорная строка всё же уехала. Главное число качества удержания: в идеале ноль",
    digits: 0,
  },
} as const;

/** Счётчик окна. */
export type ListPerfCounter = keyof typeof LIST_PERF_COUNTERS;

/** Величина окна. */
export type ListPerfStat = keyof typeof LIST_PERF_STATS;

const COUNTERS = Object.keys(LIST_PERF_COUNTERS) as ListPerfCounter[];
const STATS = Object.keys(LIST_PERF_STATS) as ListPerfStat[];

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

/** Разрядность величины в отчёте — из каталога, а не по месту печати. */
export const getStatDigits = (name: ListPerfStat): number =>
  LIST_PERF_STATS[name].digits;

/** Справка по метрикам: что каждая считает и о чём говорит. */
export const describeListPerfMetrics = (): string => {
  const lines = ["счётчики — сколько раз произошло:"];

  for (const name of COUNTERS) {
    lines.push(`  ${name.padEnd(20)} ${LIST_PERF_COUNTERS[name]}`);
  }

  lines.push("", "величины — среднее и максимум за окно:");

  for (const name of STATS) {
    lines.push(`  ${name.padEnd(20)} ${LIST_PERF_STATS[name].about}`);
  }

  return lines.join("\n");
};

/** Часы замера: монотонные, если движок их даёт. */
export const perfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
