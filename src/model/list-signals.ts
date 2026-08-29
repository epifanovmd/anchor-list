import type { AnchorListStickyEdge, IAnchorListScrollSize } from "../types";

/**
 * Именованные сигналы состояния списка — общие для всего списка.
 *
 * Зачем нужны: расчётное ядро живёт вне React, а дереву нужно узнавать о его
 * решениях. Сигнал — самая узкая связь между ними: подписка адресная, поэтому
 * изменение одного значения перерисовывает только тех, кто именно его и читал.
 */
export interface IAnchorListSignals {
  /** Суммарная высота элементов, без шапки, подвала и распорок. */
  totalSize: number;
  /** Полная высота контента: элементы плюс шапка, подвал и распорки. */
  contentSize: number;
  /** Граница скролла: `contentSize - scrollLength`, но не меньше нуля. */
  maxScroll: number;
  /** Высота шапки списка. */
  headerSize: number;
  /**
   * Начало координат элементов внутри контента.
   *
   * Раскладка элементов идёт от нуля, а в контенте над ними лежит шапка, и
   * нативное смещение скролла больше на её высоту. Всё, что переводит одно в
   * другое, обязано брать поправку отсюда, а не складывать её самостоятельно.
   */
  contentOrigin: number;
  /** Высота подвала списка. */
  footerSize: number;
  /** Распорка у конца, поднимающая якорный элемент к верхней кромке. */
  anchoredEndSpaceSize: number;
  /** Сколько контейнеров существует; ими и ограничен рендер списка. */
  numContainers: number;
  /** Размер вьюпорта целиком; вдоль оси скролла — `scrollLength`. */
  scrollSize: IAnchorListScrollSize;
  /** Размер вьюпорта вдоль оси скролла — нужен прилипанию к конечной кромке. */
  scrollLength: number;
  /** Список отрисовал стартовый кадр и применил начальный скролл. */
  readyToRender: boolean;

  /** Скролл упёрся в начало контента. */
  isAtStart: boolean;
  /** Скролл упёрся в конец контента. */
  isAtEnd: boolean;
  /** Начало в пределах порога подгрузки. */
  isNearStart: boolean;
  /** Конец в пределах порога подгрузки. */
  isNearEnd: boolean;
  /** Конец в пределах порога автоприлипания — отдельный порог от подгрузки. */
  isWithinMaintainScrollAtEndThreshold: boolean;
  /**
   * Расстояние до начала контента.
   *
   * Флаги кромок отвечают «да/нет», а плавным эффектам — тени под навбаром,
   * подтягиванию кнопки — нужна величина.
   */
  distanceFromStart: number;
  /** Расстояние до конца контента, без учёта отступа конца. */
  distanceFromEnd: number;

  /**
   * Скорость скролла, px/мс: положительная — к концу списка.
   *
   * Считается по недавней истории смещений, а не по последнему кадру: одиночная
   * дельта слишком шумная, чтобы по ней что-то решать.
   */
  velocity: number;
  /** Первый элемент, пересёкший вьюпорт; -1 — видимых нет. */
  firstVisibleIndex: number;
  /** Последний элемент, пересёкший вьюпорт; -1 — видимых нет. */
  lastVisibleIndex: number;

  /**
   * Накопленная компенсация позиции.
   *
   * Ею сдвигается невидимая распорка в начале контента; нативное удержание
   * позиции видит смещение её кадра и само правит `contentOffset`.
   */
  scrollAdjust: number;
  /** Индекс прилипшего элемента у начальной кромки, -1 — нет. */
  activeStickyStartIndex: number;
  /** Индекс прилипшего элемента у конечной кромки, -1 — нет. */
  activeStickyEndIndex: number;
}

/**
 * Шаблонные сигналы — по одному набору на контейнер.
 *
 * Адресность здесь и есть весь смысл: смещение одного контейнера при скролле не
 * должно перерисовывать остальные, поэтому у каждого свой сигнал позиции, а не
 * общий массив.
 */
type ContainerSignals = {
  [K in `containerPosition${number}`]: number;
} & {
  [K in `containerItemKey${number}`]: string;
} & {
  [K in `containerItemIndex${number}`]: number;
} & {
  [K in `containerItemData${number}`]: unknown;
} & {
  [K in `containerItemType${number}`]: string;
} & {
  [K in `containerItemSize${number}`]: number;
} & {
  /** Кромка прилипания контейнера; null — обычный элемент. */
  [K in `containerSticky${number}`]: AnchorListStickyEdge | null;
} & {
  /** Предел смещения прилипшего элемента; undefined — не ограничен. */
  [K in `containerStickyLimit${number}`]: number | undefined;
} & {
  /** Содержимое подрезается по записанной высоте: элемент вне вьюпорта. */
  [K in `containerClipped${number}`]: boolean;
};

/** Все сигналы списка: общие плюс адресные сигналы каждого контейнера. */
export type AnchorListSignalMap = IAnchorListSignals & ContainerSignals;
/** Имя любого сигнала — им адресуются чтение, запись и подписка. */
export type AnchorListSignalName = keyof AnchorListSignalMap & string;

/**
 * Позиция контейнера, выведенного за пределы вьюпорта.
 *
 * Контейнер без привязки не размонтируется — он ждёт следующего элемента, —
 * поэтому его просто уводят туда, куда скролл не доходит.
 */
export const POSITION_OUT_OF_VIEW = -10000000;

/** Значения сигналов до первой раскладки. */
export const INITIAL_SIGNALS: Partial<AnchorListSignalMap> = {
  totalSize: 0,
  contentSize: 0,
  maxScroll: 0,
  headerSize: 0,
  contentOrigin: 0,
  footerSize: 0,
  anchoredEndSpaceSize: 0,
  numContainers: 0,
  scrollSize: { width: 0, height: 0 },
  scrollLength: 0,
  readyToRender: false,
  isAtStart: true,
  isAtEnd: false,
  isNearStart: true,
  isNearEnd: false,
  isWithinMaintainScrollAtEndThreshold: false,
  distanceFromStart: 0,
  distanceFromEnd: 0,
  velocity: 0,
  firstVisibleIndex: -1,
  lastVisibleIndex: -1,
  scrollAdjust: 0,
  activeStickyStartIndex: -1,
  activeStickyEndIndex: -1,
};
