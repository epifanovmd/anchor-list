import type {
  IAnchorListRef,
  IAnchorListRenderItemProps,
} from "@epifanovmd/anchor-list";
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
  MESSAGE_GAP,
} from "../data";
import type { HighlightStyle } from "../rows";
import { HighlightedChatRow } from "../rows";
import {
  ActionChip,
  ChipRow,
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  useBottomInset,
} from "../ui";

const MESSAGE_COUNT = 300;
const QUOTED_SEQ = MESSAGE_COUNT / 2;
/** Варианты подсветки по кругу: стиль решает строка, а не список. */
const HIGHLIGHT_STYLES: HighlightStyle[] = ["background", "outline", "pulse"];

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
 * Переход подсвечивает цель: `highlight: true` загорается, когда строка
 * доехала до кадра, а не в момент вызова. Как подсветка выглядит, решает
 * строка — здесь три варианта по кругу. `highlightKey` подсвечивает строку
 * без перехода: так отмечают ответ, который уже на экране.
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
  const [highlight, setHighlight] = useState(true);
  const [styleIndex, setStyleIndex] = useState(0);
  const highlightStyle = HIGHLIGHT_STYLES[styleIndex]!;

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
      // Подсветка загорится, когда строка окажется в кадре, — не раньше.
      highlight,
    });

    setStatus(found ? `переход к ${key}` : `строки ${key} нет в данных`);
  }, [data, quotedIndex, highlight]);

  /** Подсветить строку, которая уже на экране, — без перехода. */
  const highlightVisible = useCallback(() => {
    const list = listRef.current;

    if (!list) return;

    const index = list.getVisibleRange().start + 1;
    const row = data[index];

    if (!row) return;

    list.highlightKey(chatRowKey(row), { duration: 2000 });
    setStatus(`подсвечена ${chatRowKey(row)} без перехода`);
  }, [data]);

  const nextStyle = useCallback(() => {
    setStyleIndex(index => (index + 1) % HIGHLIGHT_STYLES.length);
  }, []);

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
    ({ item }: IAnchorListRenderItemProps<ChatRowData>) => (
      <HighlightedChatRow row={item} variant={highlightStyle} />
    ),
    [highlightStyle],
  );

  return (
    <Screen title={"Переход к сообщению"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Подсвечивать цель перехода"}
          value={highlight}
          onChange={setHighlight}
        />
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
        <ChipRow>
          <ActionChip title={"Подсветить видимую"} onPress={highlightVisible} />
          <ActionChip title={`Стиль: ${highlightStyle}`} onPress={nextStyle} />
        </ChipRow>
        <DebugToggles channels={["scroll", "initial"]} />
      </ControlPanel>

      <AnchorList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        getFixedItemSize={chatRowHeight}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        gap={MESSAGE_GAP}
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
