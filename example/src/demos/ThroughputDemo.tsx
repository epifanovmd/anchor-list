import type {
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "@epifanovmd/anchor-list";
import {
  AnchorList,
  anchorListPerf,
  useAnchorListPerf,
} from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";

import type { ChatRowData } from "../data";
import {
  chatRowKey,
  chatRowType,
  ESTIMATED_ROW_SIZE,
  useFeedPagination,
} from "../data";
import { ChatRow } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  useBottomInset,
} from "../ui";

interface IThroughputDemoProps {
  onBack: () => void;
}

/**
 * Стенд нагрузки.
 *
 * Ни настроек, ни экранных счётчиков: тысяча сообщений, подгрузка в обе стороны,
 * высоты меряются, даты прилипают к верхней кромке. Всё, что могло бы повлиять
 * на замер помимо самого списка, из кадра убрано.
 *
 * Замер пишется в консоль пачкой раз в секунду, пока экран открыт; строка
 * `стики` показывает, во что обходится прилипание на каждом проходе.
 */
export const ThroughputDemo: FC<IThroughputDemoProps> = ({ onBack }) => {
  const bottomInset = useBottomInset();

  const { rows, dayIndices, onStartReached, onEndReached } =
    useFeedPagination();

  useAnchorListPerf("throughput");

  const sticky = useMemo<IAnchorListStickyConfig<ChatRowData>[]>(
    () => [{ edge: "start", indices: dayIndices }],
    [dayIndices],
  );

  const renderItem = useCallback(
    ({ item }: IAnchorListRenderItemProps<ChatRowData>) => {
      anchorListPerf.count("renderItem");

      return <ChatRow row={item} />;
    },
    [],
  );

  return (
    <Screen title={"Нагрузка"} onBack={onBack}>
      <ControlPanel>
        <StatusLine
          text={"Замер пишется в консоль раз в секунду, пока экран открыт"}
        />
        {/* Диагностика и замер спорят за одни и те же кадры: включённая
            печать растягивает их сильнее, чем то, что замер меряет. Здесь она
            нужна, только когда числа замера уже показали, куда смотреть. */}
        <DebugToggles channels={["layout", "scroll"]} />
      </ControlPanel>

      <AnchorList
        data={rows}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        sticky={sticky}
        maintainVisibleContentPosition={{ data: true, size: true }}
        onStartReached={onStartReached}
        onStartReachedThreshold={0.4}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

ThroughputDemo.displayName = "ThroughputDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
