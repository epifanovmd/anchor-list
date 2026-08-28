import type { IContainerRequest } from "../../model";
import type { AnchorListStickyEdge } from "../../types";

/** Что должно попасть в набор запрошенных строк. */
export interface IContainerRequestParams {
  startBuffered: number;
  endBuffered: number;
  /** Прилипшие якоря: держатся смонтированными и за пределами буфера. */
  pinned: number[];
  /** Ожидающие измерения: без отрисовки их нечем измерить. */
  pending: number[];
  getKey: (index: number) => string | undefined;
  getType: (index: number) => string;
  getStickyEdge: (index: number) => AnchorListStickyEdge | null;
}

/**
 * Набор элементов, которым нужны контейнеры.
 *
 * Зачем нужен: диапазона отрисовки для этого мало. Смонтированными обязаны
 * оставаться ещё две категории:
 * - прилипшие якоря — иначе шапка исчезает с экрана, стоит её группе уйти за
 *   буфер;
 * - элементы, ожидающие первого измерения — их слот схлопнут в ноль, сами в
 *   диапазон они не попадут и останутся нулевыми навсегда.
 *
 * Какую проблему решает: дедупликацию. Один и тот же индекс приходит из
 * нескольких источников, а повторяющийся ключ — из самих данных. Контейнер у
 * ключа один, и попытка разложить его дважды кончилась бы перестановкой позиции
 * на каждом проходе: место достаётся первому, о повторе в данных сообщает
 * отдельная диагностика.
 */
export const collectContainerRequests = ({
  startBuffered,
  endBuffered,
  pinned,
  pending,
  getKey,
  getType,
  getStickyEdge,
}: IContainerRequestParams): IContainerRequest[] => {
  const requests: IContainerRequest[] = [];
  const requestedIndices = new Set<number>();
  const requestedKeys = new Set<string>();

  const addRequest = (index: number) => {
    const key = getKey(index);

    if (key === undefined || requestedIndices.has(index)) return;
    if (requestedKeys.has(key)) return;

    requestedIndices.add(index);
    requestedKeys.add(key);
    requests.push({
      index,
      key,
      type: getType(index),
      stickyEdge: getStickyEdge(index),
    });
  };

  for (let index = startBuffered; index <= endBuffered; index++) {
    addRequest(index);
  }

  for (const index of pinned) addRequest(index);
  for (const index of pending) addRequest(index);

  return requests;
};
