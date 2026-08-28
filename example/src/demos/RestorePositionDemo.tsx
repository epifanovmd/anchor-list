import type {
  AnchorListInitialScroll,
  IAnchorListRef,
} from "@epifanovmd/anchor-list";
import {
  AnchorList,
  useAnchorListState,
  useAnchorListValue,
} from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";

import type { ChatRowData, ISavedPosition } from "../data";
import {
  chatRowHeight,
  chatRowKey,
  chatRowType,
  createMessages,
  ESTIMATED_ROW_SIZE,
  positionStore,
} from "../data";
import { ChatRow } from "../rows";
import {
  ActionChip,
  ChipRow,
  ControlPanel,
  Screen,
  StatusLine,
  ToggleRow,
  useBottomInset,
} from "../ui";

const SCREEN_ID = "restore-position";
const MESSAGE_COUNT = 300;

interface IRestorePositionDemoProps {
  onBack: () => void;
}

/**
 * Стенд стартовой позиции.
 *
 * Позиция читается один раз — до первого рендера, — поэтому список открывается
 * сразу там, где его оставили, без видимого прыжка. Проверяется уходом на
 * витрину и возвратом на этот экран.
 */
export const RestorePositionDemo: FC<IRestorePositionDemoProps> = ({
  onBack,
}) => {
  const bottomInset = useBottomInset();
  const listRef = useRef<IAnchorListRef>(null);
  const listState = useAnchorListState();
  const data = useMemo(() => createMessages(0, MESSAGE_COUNT), []);

  const [restoreEnabled, setRestoreEnabled] = useState(() =>
    positionStore.isRestoreEnabled(),
  );

  // Читается ровно один раз: дальше позиция живёт в самом списке.
  const [savedPosition] = useState<ISavedPosition | undefined>(() =>
    positionStore.isRestoreEnabled()
      ? positionStore.read(SCREEN_ID)
      : undefined,
  );

  const [status, setStatus] = useState(() =>
    savedPosition
      ? `восстановлено: ${savedPosition.key}`
      : "сохранённой позиции нет",
  );

  const initialScroll = useMemo<AnchorListInitialScroll | undefined>(() => {
    if (!savedPosition) return undefined;

    const index = data.findIndex(row => chatRowKey(row) === savedPosition.key);

    if (index === -1) return undefined;

    return { type: "index", index, viewOffset: savedPosition.offset };
  }, [data, savedPosition]);

  /**
   * Последний снятый снимок.
   *
   * Копится в ref, а не пишется в хранилище сразу: писать на каждое движение
   * незачем, а к моменту ухода с экрана спросить список уже нельзя — см. ниже.
   */
  const snapshot = useRef<ISavedPosition | undefined>(undefined);

  /**
   * Снимок текущей позиции: верхняя видимая строка и её смещение относительно
   * кромки со знаком. Отрицательное смещение означает, что строка уходит за
   * кромку — именно оно возвращает её ровно тем же куском, каким она была.
   */
  const capturePosition = useCallback(() => {
    const list = listRef.current;

    if (!list) return;

    const topRowIndex = list.getVisibleRange().start;
    const position = list.getPositionAtIndex(topRowIndex);
    const row = data[topRowIndex];

    if (position === undefined || !row) return;

    snapshot.current = {
      key: chatRowKey(row),
      offset: position - list.getScrollOffset(),
    };
  }, [data]);

  /**
   * Снимок обновляется, пока экран жив, а в хранилище уходит при уходе с него.
   *
   * Спросить список в момент ухода нельзя: `useImperativeHandle` очищает ref в
   * фазе layout-эффектов, а очистка обычного `useEffect` идёт позже — к ней
   * `listRef.current` уже `null`, и снимок не снимался бы вовсе.
   */
  useEffect(
    () => () => {
      if (snapshot.current && positionStore.isRestoreEnabled()) {
        positionStore.write(SCREEN_ID, snapshot.current);
      }
    },
    [],
  );

  /**
   * Состав видимых строк изменился — позиция уехала как минимум на строку.
   * Покрывает и инерцию: во время неё диапазон меняется постоянно.
   */
  const firstVisible = useAnchorListValue(listState, "firstVisibleIndex");

  useEffect(() => {
    capturePosition();
  }, [firstVisible, capturePosition]);

  const handleRestoreChange = useCallback((value: boolean) => {
    setRestoreEnabled(value);
    positionStore.setRestoreEnabled(value);
    setStatus(value ? "восстановление включено" : "восстановление выключено");
  }, []);

  const handleClear = useCallback(() => {
    positionStore.clear(SCREEN_ID);
    setStatus("позиция сброшена");
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatRowData }) => <ChatRow row={item} />,
    [],
  );

  return (
    <Screen title={"Стартовая позиция"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Восстанавливать позицию"}
          value={restoreEnabled}
          onChange={handleRestoreChange}
        />
        <StatusLine text={status} />
        <StatusLine
          text={
            "Уйдите на витрину и вернитесь — список откроется на той же строке"
          }
        />
        <ChipRow>
          <ActionChip title={"Сбросить позицию"} onPress={handleClear} />
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
        initialScroll={initialScroll}
        state={listState}
        // Палец отпущен: смещение внутри той же строки в смену видимого
        // диапазона не попадает, а вернуть строку нужно тем же куском.
        onScrollEndDrag={capturePosition}
        ListFooterComponent={bottomInset.footer}
        insetEnd={bottomInset.inset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

RestorePositionDemo.displayName = "RestorePositionDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
