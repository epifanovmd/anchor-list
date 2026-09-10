/**
 * Данные горизонтальной ленты.
 *
 * Отдельно от чата, а не поверх него: у сообщений вдоль оси идёт высота, и
 * растянуть их вбок значит проверять не ту раскладку. Здесь размер вдоль оси —
 * ширина карточки, и разной она сделана намеренно: список обязан мерить
 * карточки так же, как мерит строки, а на одинаковых ширинах ошибка замера не
 * видна вовсе.
 */

/** Карточка ленты. */
export interface IRailCard {
  type: "card";
  key: string;
  /** Порядковый номер — по нему видно, куда уехала лента. */
  seq: number;
  title: string;
  /** Заданная ширина: раскладка предсказуема, ошибки видно глазом. */
  width: number;
  /** Месяц, к которому относится карточка. */
  month: string;
  /** Последняя карточка месяца — под ней рисуется метка группы. */
  isGroupTail: boolean;
}

/** Элемент ленты: карточка, метка месяца или спиннер подгрузки. */
export type RailRowData =
  | IRailCard
  | { type: "month"; key: string; month: string }
  | { type: "spinner"; key: string; edge: "start" | "end" };

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
];
/** Ширины карточек; повторяются с периодом, взаимно простым с длиной группы. */
const WIDTHS = [132, 196, 108, 164, 240, 144, 180];

const widthOf = (seq: number) => WIDTHS[seq % WIDTHS.length]!;
const monthOf = (seq: number) => MONTHS[Math.floor(seq / 8) % MONTHS.length]!;

export const createCard = (seq: number): IRailCard => ({
  type: "card",
  key: `c${seq}`,
  seq,
  title: `Карточка ${seq}`,
  width: widthOf(seq),
  month: monthOf(seq),
  // Группа — четыре карточки подряд; хвост несёт метку.
  isGroupTail: seq % 4 === 3,
});

/** Диапазон карточек `[from, to)`. */
export const createCards = (from: number, to: number): IRailCard[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, index) =>
    createCard(from + index),
  );

/** Что получается после расстановки меток месяцев. */
export interface IRailFeed {
  rows: RailRowData[];
  /** Индексы меток месяцев — якоря прилипания к левой кромке. */
  monthIndices: number[];
  /** Индексы хвостов групп — якоря прилипания к правой кромке. */
  tagIndices: number[];
  /** Первая карточка группы для каждого якоря; параллельно `tagIndices`. */
  groupStarts: number[];
}

/**
 * Вставка меток месяцев между карточками.
 *
 * Возвращает и сами элементы, и индексы якорей: список адресует прилипающие
 * элементы индексами, поэтому считать их обязан тот, кто строит данные. Всё
 * зеркально `withDaySeparators` — механика прилипания от оси не зависит, и
 * данные для неё готовятся так же.
 */
export const withMonthMarkers = (cards: IRailCard[]): IRailFeed => {
  const rows: RailRowData[] = [];
  const monthIndices: number[] = [];
  const tagIndices: number[] = [];
  const groupStarts: number[] = [];

  let previousMonth: string | undefined;
  // Первая карточка текущей группы: до неё метка сдвигаться не должна.
  let groupStart: number | undefined;

  for (const card of cards) {
    if (card.month !== previousMonth) {
      previousMonth = card.month;
      // Метка разрывает группу: следующая карточка начинает новую.
      groupStart = undefined;
      monthIndices.push(rows.length);
      rows.push({ type: "month", key: `mo-${card.month}`, month: card.month });
    }

    if (groupStart === undefined) groupStart = rows.length;

    if (card.isGroupTail) {
      tagIndices.push(rows.length);
      groupStarts.push(groupStart);
      groupStart = undefined;
    }

    rows.push(card);
  }

  return { rows, monthIndices, tagIndices, groupStarts };
};

/** Ключ элемента: переживает вставку и удаление, в отличие от индекса. */
export const railRowKey = (row: RailRowData): string => row.key;

/** Тип контейнера: элементы разной формы не переиспользуют друг друга. */
export const railRowType = (row: RailRowData): string =>
  row.type === "card" && row.isGroupTail ? "card-tail" : row.type;

/** Ширина известна заранее для всех элементов примера. */
export const railRowWidth = (row: RailRowData): number | undefined => {
  if (row.type === "month") return MONTH_MARKER_WIDTH;
  if (row.type === "spinner") return RAIL_SPINNER_WIDTH;

  return row.width;
};

/** Зазор между карточками; создаётся отступом слева. */
export const CARD_GAP = 8;
/** Ширина метки месяца — она же прилипает к левой кромке. */
export const MONTH_MARKER_WIDTH = 92;
/** Ширина спиннера подгрузки. */
export const RAIL_SPINNER_WIDTH = 120;
/** Ширина метки группы: до неё список доводит сдвиг у начала группы. */
export const GROUP_TAG_WIDTH = 56;
/** Высота ленты: поперёк оси её задаёт стенд, а не список. */
export const RAIL_HEIGHT = 180;
/** Стартовая оценка ширины карточки — с неё начинается раскладка. */
export const ESTIMATED_CARD_WIDTH = 160;
