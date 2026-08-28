import { useCallback, useMemo, useState } from "react";

import type { ChatRowData } from "./chat-data";
import { createMessages, withDaySeparators } from "./chat-data";

/** Сколько сообщений в списке на старте. */
const INITIAL_FROM = 1000;
const INITIAL_TO = 2000;
/** Сколько добавляет одна подгрузка. */
const PAGE_SIZE = 40;
/** Задержка ответа: подгрузка обязана приходить посреди скролла, как в жизни. */
const LOAD_DELAY_MS = 400;

export interface IFeedPagination {
  rows: ChatRowData[];
  /** Индексы разделителей дат — якоря прилипания. */
  dayIndices: number[];
  from: number;
  to: number;
  onStartReached: () => void;
  onEndReached: () => void;
}

/**
 * Данные стенда нагрузки: тысяча сообщений и подгрузка в обе стороны.
 *
 * Спиннер сверху сдвигает всё под собой на строку, поэтому индексы якорей здесь
 * же и правятся: адресация прилипания идёт индексами, и без поправки якорями
 * оказались бы соседние строки.
 */
export const useFeedPagination = (): IFeedPagination => {
  const [range, setRange] = useState({ from: INITIAL_FROM, to: INITIAL_TO });
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);

  const feed = useMemo(
    () => withDaySeparators(createMessages(range.from, range.to)),
    [range],
  );

  const rows = useMemo<ChatRowData[]>(() => {
    if (!loadingStart && !loadingEnd) return feed.rows;

    const data: ChatRowData[] = [...feed.rows];

    if (loadingStart) {
      data.unshift({ type: "spinner", key: "spinner-start", edge: "start" });
    }

    if (loadingEnd) {
      data.push({ type: "spinner", key: "spinner-end", edge: "end" });
    }

    return data;
  }, [feed, loadingStart, loadingEnd]);

  const dayIndices = useMemo(
    () =>
      loadingStart ? feed.dayIndices.map(index => index + 1) : feed.dayIndices,
    [feed, loadingStart],
  );

  const onStartReached = useCallback(() => {
    if (loadingStart || range.from <= 0) return;

    setLoadingStart(true);
    setTimeout(() => {
      setRange(current => ({
        ...current,
        from: Math.max(0, current.from - PAGE_SIZE),
      }));
      setLoadingStart(false);
    }, LOAD_DELAY_MS);
  }, [loadingStart, range.from]);

  const onEndReached = useCallback(() => {
    if (loadingEnd) return;

    setLoadingEnd(true);
    setTimeout(() => {
      setRange(current => ({ ...current, to: current.to + PAGE_SIZE }));
      setLoadingEnd(false);
    }, LOAD_DELAY_MS);
  }, [loadingEnd]);

  return {
    rows,
    dayIndices,
    from: range.from,
    to: range.to,
    onStartReached,
    onEndReached,
  };
};
