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
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  useBottomInset,
} from "../ui";

const SCREEN_ID = "restore-position";
const MESSAGE_COUNT = 300;

/**
 * Стартовая позиция для первого открытия — когда восстанавливать ещё нечего.
 *
 * Зачем середина, а не конец: стенд про то, что список открывается **ровно** на
 * заданной строке, а конец списка он взял бы и без стартовой позиции —
 * промахнуться там негде. Строка в глубине требует посчитать цель по метрикам и
 * довести её, и промах на ней виден сразу.
 */
const DEFAULT_START_INDEX = Math.floor(MESSAGE_COUNT / 2);

interface IRestorePositionDemoProps {
  onBack: () => void;
}

/**
 * Стенд стартовой позиции.
 *
 * Позиция читается один раз — до первого рендера, — поэтому список открывается
 * сразу там, где его оставили, без видимого прыжка. Проверяется уходом на
 * витрину и возвратом на этот экран.
 *
 * При первом открытии восстанавливать нечего, и список встаёт на
 * {@link DEFAULT_START_INDEX}: стартовая позиция здесь задана всегда, иначе
 * стенд на первом заходе ничем не отличался бы от обычного списка.
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
      : `сохранённой позиции нет — открыто на строке №${DEFAULT_START_INDEX}`,
  );

  /**
   * Стартовая позиция задана всегда: сохранённая, если она есть, и умолчание
   * при первом открытии. Без умолчания стенд открывался бы сверху, как обычный
   * список, и механику, ради которой он написан, было бы видно только со
   * второго захода.
   */
  const initialScroll = useMemo<AnchorListInitialScroll>(() => {
    if (savedPosition) {
      const index = data.findIndex(
        row => chatRowKey(row) === savedPosition.key,
      );

      if (index !== -1) {
        return { type: "index", index, viewOffset: savedPosition.offset };
      }
    }

    return { type: "index", index: DEFAULT_START_INDEX };
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
    setStatus(
      value
        ? "восстановление включено"
        : `восстановление выключено — откроется на строке №${DEFAULT_START_INDEX}`,
    );
  }, []);

  const handleClear = useCallback(() => {
    positionStore.clear(SCREEN_ID);
    // Снимок тоже сбрасывается: иначе уход с экрана тут же записал бы обратно
    // ту самую позицию, которую только что стёрли, и следующее открытие
    // выглядело бы так, будто сброс не сработал.
    snapshot.current = undefined;
    setStatus(`позиция сброшена — откроется на строке №${DEFAULT_START_INDEX}`);
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
        {/* Стартовую позицию тумблером не застать: к моменту, когда до него
            дотянутся, список давно показан. Канал включён с открытия стенда. */}
        <DebugToggles
          channels={["initial", "scroll"]}
          defaultEnabled={["initial"]}
        />
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
        insetEnd={bottomInset}
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
