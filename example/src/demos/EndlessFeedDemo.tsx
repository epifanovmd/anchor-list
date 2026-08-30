import type { IAnchorListRef } from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";

import type { ChatRowData } from "../data";
import {
  chatRowHeight,
  chatRowKey,
  chatRowType,
  createMessages,
  ESTIMATED_ROW_SIZE,
} from "../data";
import { ChatRow } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  useBottomInset,
} from "../ui";

const INITIAL_FROM = 500;
const INITIAL_TO = 540;
const PAGE_SIZE = 20;
const LOAD_DELAY_MS = 700;

interface IEndlessFeedDemoProps {
  onBack: () => void;
}

/**
 * Стенд подгрузки в обе стороны.
 *
 * Подгрузка вверх — тот случай, ради которого нужно удержание позиции: список
 * вырастает выше вьюпорта, и без компенсации контент уезжает вниз на высоту
 * добавленного. Переключатель показывает разницу вживую.
 */
export const EndlessFeedDemo: FC<IEndlessFeedDemoProps> = ({ onBack }) => {
  const bottomInset = useBottomInset();

  const listRef = useRef<IAnchorListRef>(null);

  const [range, setRange] = useState({ from: INITIAL_FROM, to: INITIAL_TO });
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);
  const [keepPosition, setKeepPosition] = useState(true);
  const [status, setStatus] = useState("готово");

  const data = useMemo<ChatRowData[]>(() => {
    const rows: ChatRowData[] = createMessages(range.from, range.to);

    if (loadingStart) {
      rows.unshift({ type: "spinner", key: "spinner-start", edge: "start" });
    }

    if (loadingEnd) {
      rows.push({ type: "spinner", key: "spinner-end", edge: "end" });
    }

    return rows;
  }, [range, loadingStart, loadingEnd]);

  const handleStartReached = useCallback(() => {
    if (loadingStart || range.from <= 0) return;

    setLoadingStart(true);
    setStatus("подгрузка сверху…");

    setTimeout(() => {
      setRange(current => ({
        ...current,
        from: Math.max(0, current.from - PAGE_SIZE),
      }));
      setLoadingStart(false);
      setStatus(`добавлено ${PAGE_SIZE} сверху`);
    }, LOAD_DELAY_MS);
  }, [loadingStart, range.from]);

  const handleEndReached = useCallback(() => {
    if (loadingEnd) return;

    setLoadingEnd(true);
    setStatus("подгрузка снизу…");

    setTimeout(() => {
      setRange(current => ({ ...current, to: current.to + PAGE_SIZE }));
      setLoadingEnd(false);
      setStatus(`добавлено ${PAGE_SIZE} снизу`);
    }, LOAD_DELAY_MS);
  }, [loadingEnd]);

  const maintainVisibleContentPosition = useMemo(
    () => (keepPosition ? { data: true, size: true } : undefined),
    [keepPosition],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRowData }) => <ChatRow row={item} />,
    [],
  );

  return (
    <Screen title={"Подгрузка с обеих сторон"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Удерживать позицию при вставке"}
          value={keepPosition}
          onChange={setKeepPosition}
        />
        <StatusLine text={`диапазон ${range.from}…${range.to} · ${status}`} />
        <StatusLine
          text={"Долистайте вверх: с выключенным удержанием контент прыгнет"}
        />
        <DebugToggles channels={["edges", "mvcp"]} />
      </ControlPanel>

      <AnchorList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        getFixedItemSize={chatRowHeight}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        maintainVisibleContentPosition={maintainVisibleContentPosition}
        onStartReached={handleStartReached}
        onStartReachedThreshold={0.4}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

EndlessFeedDemo.displayName = "EndlessFeedDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
