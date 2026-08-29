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
  ActionChip,
  ChipRow,
  ControlPanel,
  Screen,
  StatusLine,
  useBottomInset,
} from "../ui";

const MESSAGE_COUNT = 300;
const QUOTED_SEQ = MESSAGE_COUNT / 2;

interface IJumpToMessageDemoProps {
  onBack: () => void;
}

/**
 * Стенд перехода к сообщению.
 *
 * `scrollToKey` адресует строку ключом, а не индексом: после подгрузки сверху
 * тот же элемент лежит на другом индексе, и индекс увёл бы не туда. Метод
 * возвращает `false`, если строки с таким ключом в данных нет, — по нему видно,
 * что цитату нужно сначала подтянуть.
 *
 * Рядом — остальной императивный интерфейс: скролл к индексу, к концу контента
 * и разовый опрос геометрии.
 */
export const JumpToMessageDemo: FC<IJumpToMessageDemoProps> = ({ onBack }) => {
  const bottomInset = useBottomInset();
  const listRef = useRef<IAnchorListRef>(null);
  const data = useMemo(() => createMessages(0, MESSAGE_COUNT), []);

  const [status, setStatus] = useState(
    "прокрутите список и вернитесь к цитате",
  );

  const quotedIndex = useMemo(
    () => data.findIndex(row => row.seq === QUOTED_SEQ),
    [data],
  );

  const jumpToQuoted = useCallback(() => {
    const key = chatRowKey(data[quotedIndex]!);
    // Ключ переживает вставки и удаления, индекс — нет.
    const found = listRef.current?.scrollToKey({
      key,
      animated: true,
      viewPosition: 0,
    });

    setStatus(found ? `переход к ${key}` : `строки ${key} нет в данных`);
  }, [data, quotedIndex]);

  const jumpToStart = useCallback(() => {
    listRef.current?.scrollToIndex({ index: 0, animated: true });
    setStatus("переход к началу");
  }, []);

  const jumpToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setStatus("переход к концу");
  }, []);

  const reportGeometry = useCallback(() => {
    const list = listRef.current;

    if (!list) return;

    setStatus(
      `скролл ${Math.round(list.getScrollOffset())} · контент ${Math.round(
        list.getContentSize(),
      )} · вьюпорт ${Math.round(list.getScrollLength())}`,
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatRowData }) => <ChatRow row={item} />,
    [],
  );

  return (
    <Screen title={"Переход к сообщению"} onBack={onBack}>
      <ControlPanel>
        <StatusLine text={status} />
        <ChipRow>
          <ActionChip
            title={`К сообщению ${QUOTED_SEQ}`}
            onPress={jumpToQuoted}
          />
          <ActionChip title={"В начало"} onPress={jumpToStart} />
          <ActionChip title={"В конец"} onPress={jumpToEnd} />
          <ActionChip title={"Геометрия"} onPress={reportGeometry} />
        </ChipRow>
      </ControlPanel>

      <AnchorList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        getFixedItemSize={chatRowHeight}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

JumpToMessageDemo.displayName = "JumpToMessageDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
