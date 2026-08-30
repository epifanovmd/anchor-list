import type {
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet } from "react-native";

import type { ChatRowData } from "../data";
import {
  AVATAR_SIZE,
  chatRowKey,
  chatRowType,
  createMessages,
  ESTIMATED_ROW_SIZE,
  MESSAGE_GAP,
  withDaySeparators,
} from "../data";
import { ChatRow, PinnedAvatar } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  useBottomInset,
} from "../ui";

const MESSAGE_COUNT = 1000;

interface IPinnedAnchorsDemoProps {
  onBack: () => void;
}

/**
 * Стенд прилипания.
 *
 * Две кромки одновременно и с разным поведением: даты прилипают к верхней —
 * уходящая вверх шапка задерживается у кромки, пока её не вытолкнет следующая;
 * аватарки прилипают к нижней — аватар группы остаётся у нижнего края, пока
 * видна хоть часть группы, и не поднимается выше её начала.
 */
export const PinnedAnchorsDemo: FC<IPinnedAnchorsDemoProps> = ({ onBack }) => {
  const bottomInset = useBottomInset();

  const [stickyDays, setStickyDays] = useState(true);
  const [stickyAvatars, setStickyAvatars] = useState(true);

  const { rows, dayIndices, avatarIndices, groupStarts } = useMemo(
    () => withDaySeparators(createMessages(0, MESSAGE_COUNT)),
    [],
  );

  const sticky = useMemo<IAnchorListStickyConfig<ChatRowData>[]>(() => {
    const configs: IAnchorListStickyConfig<ChatRowData>[] = [];

    if (stickyDays) {
      // Отступ не задан: список начинается уже под заголовком экрана, и сверху
      // его вьюпорт ничем не занят.
      configs.push({ edge: "start", indices: dayIndices });
    }

    if (stickyAvatars) {
      // Прилипает только аватар: сообщение остаётся на своём месте.
      configs.push({
        edge: "end",
        indices: avatarIndices,
        // Отступ конечной кромки не задан намеренно: список подставит сюда
        // свой `insetEnd` — тот же, каким снизу ограничены контент и индикатор
        // скролла. Аватар останавливается над домашним индикатором, а не под
        // ним, и на одной линии с последней строкой.
        mode: "offset",
        size: AVATAR_SIZE,
        groupStarts,
        limitInset: MESSAGE_GAP,
        // Пока аватар стоит у кромки, его рисует слой поверх списка: там у него
        // нет покадрового трансформа и нечему дрожать.
        renderOverlay: item => <PinnedAvatar row={item} />,
      });
    }

    return configs;
  }, [stickyDays, stickyAvatars, dayIndices, avatarIndices, groupStarts]);

  const renderItem = useCallback(
    ({
      item,
      stickyOffset,
      stickyPinned,
    }: IAnchorListRenderItemProps<ChatRowData>) => (
      <ChatRow
        row={item}
        withAvatar
        stickyOffset={stickyOffset}
        stickyPinned={stickyPinned}
      />
    ),
    [],
  );

  return (
    <Screen title={"Прилипание на двух кромках"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Даты прилипают сверху"}
          value={stickyDays}
          onChange={setStickyDays}
        />
        <ToggleRow
          title={"Аватарки прилипают снизу"}
          value={stickyAvatars}
          onChange={setStickyAvatars}
        />
        <StatusLine
          text={`дат: ${dayIndices.length} · групп: ${avatarIndices.length}`}
        />
        <DebugToggles channels={["sticky", "layout"]} />
      </ControlPanel>

      {/* Высоты намеренно измеряются. Увеличенный буфер даёт строкам уточнить
          оценку до входа в кадр на быстром броске. */}
      <AnchorList
        data={rows}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        drawDistance={600}
        sticky={sticky}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

PinnedAnchorsDemo.displayName = "PinnedAnchorsDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
