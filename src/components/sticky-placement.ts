import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";

import { POSITION_OUT_OF_VIEW } from "../model";
import type {
  AnchorListStickyEdge,
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "../types";

/** Ниже этой позиции контейнер считается уведённым за пределы контента. */
const PARKED_THRESHOLD = POSITION_OUT_OF_VIEW / 2;

/** Что и как прилипает у конкретного контейнера. */
export interface IStickyPlacement {
  /**
   * `container` — прилипает вся строка целиком (заголовки, разделители дат).
   * `offset` — строка остаётся на месте, а смещение уходит в ячейку.
   */
  mode: "container" | "offset";
  /** Отступ кромки: навбар сверху, панель ввода и клавиатура снизу. */
  edgeOffset: SharedValue<number> | undefined;
  /** Высота того, что реально прилипает; по умолчанию — высота строки. */
  stickySize: number;
  /**
   * Прилипшую копию рисует слой поверх списка.
   *
   * Пока копия видна, узел внутри контента прячется — иначе на кромке стояли бы
   * два одинаковых элемента.
   */
  hasOverlay: boolean;
}

/**
 * Разбор конфигурации прилипания под один контейнер.
 *
 * Зачем нужен: наборы прилипающих элементов объявлены по кромкам, а контейнеру
 * нужен ответ про себя — прилипает он целиком или отдаёт смещение внутрь ячейки,
 * и от какой высоты считать предел подъёма.
 *
 * Обычная строка сюда тоже попадает: у неё нет кромки, и весь разбор сводится к
 * значениям по умолчанию.
 */
export const resolveStickyPlacement = (
  configs: IAnchorListStickyConfig[],
  edge: AnchorListStickyEdge | null | undefined,
  size: number,
): IStickyPlacement => {
  const config = edge ? configs.find(item => item.edge === edge) : undefined;

  const mode = config?.mode ?? "container";

  return {
    mode,
    edgeOffset: config?.offset,
    stickySize: config?.size ?? size,
    hasOverlay:
      config !== undefined &&
      (config.renderOverlay !== undefined || mode === "container"),
  };
};

/**
 * Слой отрисовки прилипающей строки.
 *
 * Зачем нужен: у контейнеров нет собственного порядка — пул раздаёт им номера
 * по мере надобности, а при равном `zIndex` именно номер и решает, кто поверх
 * кого. Пока все якоря делили один слой, порядок выходил случайным: дата,
 * выталкиваемая следующей, пряталась за непрозрачным пузырём сообщения, если
 * тому достался контейнер с бо́льшим номером. На одних датах это было видно, на
 * других нет — ровно по тому, как легли номера.
 *
 * Порядок задан ролью, а не номером: заголовок начальной кромки поверх всего,
 * якорь конечной кромки — поверх обычных строк (аватар поднимается над
 * сообщениями своей же группы), обычная строка — без слоя.
 */
export const STICKY_Z_INDEX: Record<AnchorListStickyEdge, number> = {
  start: 2,
  end: 1,
};

/** Стабильная пустая ссылка: без неё каждый рендер давал бы новый массив. */
const NO_STICKY: IAnchorListStickyConfig[] = [];

/**
 * Подстановка отступа кромки, объявленного самим списком.
 *
 * Зачем нужна: низ вьюпорта занимает одно и то же — панель ввода, клавиатура,
 * безопасная зона, — и список уже знает, насколько ({@link IAnchorListProps.insetEnd}).
 * Требовать то же число отдельно у каждого набора прилипания значит завести
 * второй источник правды: разойдясь, они поставят прилипший якорь не на ту
 * линию, где кончается контент.
 *
 * Подстановка — умолчание, а не запрет: свой `offset` у набора приоритетнее.
 * Начальной кромки это не касается — там отступ задаёт только вызывающий.
 */
export const withEdgeInset = (
  configs: IAnchorListStickyConfig[] | undefined,
  insetEnd: SharedValue<number> | undefined,
): IAnchorListStickyConfig[] => {
  if (!configs) return NO_STICKY;
  if (!insetEnd) return configs;

  let substituted = false;

  const next = configs.map(config => {
    if (config.edge !== "end" || config.offset) return config;

    substituted = true;

    return { ...config, offset: insetEnd };
  });

  return substituted ? next : configs;
};

/** Как слой рисует прилипшую копию; undefined — эта кромка слой не использует. */
export type ListOverlayRenderer = (
  props: IAnchorListRenderItemProps<unknown>,
) => ReactNode;

/**
 * Чем рисовать прилипшую копию якоря.
 *
 * В режиме `container` копия — это сама строка, поэтому по умолчанию берётся
 * `renderItem`. В режиме `offset` у кромки стоит объект внутри строки, и
 * нарисовать его может только вызывающий: без его рендера кромка остаётся на
 * старом механизме.
 */
export const resolveOverlayRenderer = (
  config: IAnchorListStickyConfig,
  renderItem: ListOverlayRenderer,
): ListOverlayRenderer | undefined => {
  const { renderOverlay } = config;

  if (renderOverlay) {
    return ({ item, index }) => renderOverlay(item, index);
  }

  return (config.mode ?? "container") === "container" ? renderItem : undefined;
};

/**
 * Контейнер уведён за пределы контента и ждёт новой привязки.
 *
 * Формула прилипания вернула бы для него позицию ровно на кромке — на экране
 * это вторая копия прилипшего элемента, срывающаяся при снятии флага.
 */
export const isContainerParked = (position: number): boolean => {
  "worklet";

  return position <= PARKED_THRESHOLD;
};
