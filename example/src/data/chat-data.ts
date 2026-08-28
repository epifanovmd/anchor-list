/** Строка-сообщение. */
export interface IChatMessage {
  type: "message";
  key: string;
  /** Порядковый номер — по нему видно, куда уехал список. */
  seq: number;
  text: string;
  /** Заданная высота: раскладка предсказуема, ошибки видно глазом. */
  height: number;
  author: string;
  /** День, к которому относится сообщение. */
  day: string;
  /** Последнее сообщение автора в группе — под ним рисуется аватар. */
  isGroupTail: boolean;
}

/** Строка примера: сообщение, разделитель даты или спиннер подгрузки. */
export type ChatRowData =
  | IChatMessage
  | { type: "day"; key: string; day: string }
  | { type: "spinner"; key: string; edge: "start" | "end" };

const AUTHORS = ["Аня", "Борис", "Вера", "Глеб"];
const HEIGHTS = [56, 84, 120, 68, 160, 92];

/** Высота и автор берутся детерминированно: прогоны сравнимы между собой. */
const authorOf = (seq: number) =>
  AUTHORS[Math.floor(seq / 3) % AUTHORS.length]!;
const heightOf = (seq: number) => HEIGHTS[seq % HEIGHTS.length]!;
const dayOf = (seq: number) => `День ${Math.floor(seq / 12) + 1}`;

export const createMessage = (seq: number): IChatMessage => ({
  type: "message",
  key: `m${seq}`,
  seq,
  text: `Сообщение ${seq}`,
  height: heightOf(seq),
  author: authorOf(seq),
  day: dayOf(seq),
  // Группа — три подряд сообщения одного автора; хвост несёт аватар.
  isGroupTail: seq % 3 === 2,
});

/** Диапазон сообщений `[from, to)`. */
export const createMessages = (from: number, to: number): IChatMessage[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, index) =>
    createMessage(from + index),
  );

/** Что получается после расстановки разделителей дат. */
export interface IChatFeed {
  rows: ChatRowData[];
  /** Индексы разделителей — якоря прилипания к верхней кромке. */
  dayIndices: number[];
  /** Индексы хвостов групп — якоря прилипания к нижней кромке. */
  avatarIndices: number[];
  /** Первая строка группы для каждого якоря; параллельно `avatarIndices`. */
  groupStarts: number[];
}

/**
 * Вставка разделителей дат между сообщениями разных дней.
 *
 * Возвращает и сами строки, и индексы якорей: список адресует прилипающие
 * элементы индексами, поэтому считать их обязан тот, кто строит данные.
 */
export const withDaySeparators = (messages: IChatMessage[]): IChatFeed => {
  const rows: ChatRowData[] = [];
  const dayIndices: number[] = [];
  const avatarIndices: number[] = [];
  const groupStarts: number[] = [];

  let previousDay: string | undefined;
  // Первая строка текущей группы: до неё аватар подниматься не должен.
  let groupStart: number | undefined;

  for (const message of messages) {
    if (message.day !== previousDay) {
      previousDay = message.day;
      // Разделитель разрывает группу: следующее сообщение начинает новую.
      groupStart = undefined;
      dayIndices.push(rows.length);
      rows.push({ type: "day", key: `d-${message.day}`, day: message.day });
    }

    if (groupStart === undefined) groupStart = rows.length;

    if (message.isGroupTail) {
      avatarIndices.push(rows.length);
      groupStarts.push(groupStart);
      groupStart = undefined;
    }

    rows.push(message);
  }

  return { rows, dayIndices, avatarIndices, groupStarts };
};

/** Ключ строки: переживает вставку и удаление, в отличие от индекса. */
export const chatRowKey = (row: ChatRowData): string => row.key;

/** Тип контейнера: строки разной формы не должны переиспользовать друг друга. */
export const chatRowType = (row: ChatRowData): string =>
  row.type === "message" && row.isGroupTail ? "message-tail" : row.type;

/** Высота известна заранее для всех строк примера. */
export const chatRowHeight = (row: ChatRowData): number | undefined => {
  if (row.type === "day") return DAY_ROW_HEIGHT;
  if (row.type === "spinner") return SPINNER_ROW_HEIGHT;

  return row.height;
};

/** Зазор между сообщениями; создаётся отступом сверху пузыря. */
export const MESSAGE_GAP = 8;

export const DAY_ROW_HEIGHT = 44;
export const SPINNER_ROW_HEIGHT = 56;
/** Высота аватара: до неё список доводит подъём у верха группы. */
export const AVATAR_SIZE = 36;
/** Стартовая оценка размера строки — с неё начинается раскладка. */
export const ESTIMATED_ROW_SIZE = 92;
