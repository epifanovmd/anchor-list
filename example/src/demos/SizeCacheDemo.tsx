import type {
  AnchorListInitialScroll,
  IAnchorListRef,
  IAnchorListScrollAnchor,
} from "@epifanovmd/anchor-list";
import {
  AnchorList,
  createAnchorListSizeCache,
  useAnchorListState,
  useAnchorListValue,
} from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";

import type { ChatRowData } from "../data";
import {
  chatRowKey,
  chatRowType,
  createMessages,
  ESTIMATED_ROW_SIZE,
  MESSAGE_GAP,
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

const SCREEN_ID = "size-cache";
const MESSAGE_COUNT = 300;
/** Глубоко в списке: у начала оценки не промахиваются, и разницы не видно. */
const DEFAULT_START_INDEX = Math.floor(MESSAGE_COUNT / 2);

/**
 * Кэш живёт в модуле, а не в компоненте: он и должен пережить уход с экрана.
 * В приложении это модуль экрана или стор рядом с данными переписки.
 */
const sizeCache = createAnchorListSizeCache();

/** Тумблер кэша — тоже переживает экран, иначе его не проверить. */
let cacheEnabled = true;

interface ISizeCacheDemoProps {
  onBack: () => void;
}

/**
 * Стенд кэша измерений.
 *
 * Строки здесь **измеряются**, а не объявляются: `getFixedItemSize` нарочно
 * не задан, иначе кэшировать было бы нечего. При первом открытии список
 * меряет видимые строки и доводит стартовую позицию по оценкам — канал
 * `initial` печатает попытки. Уход на витрину и возврат с включённым кэшем
 * открывает список на той же строке с первой попытки: размеры уже известны.
 * С выключенным — всё заново.
 *
 * Строка состояния показывает, за сколько список показался, и сколько строк
 * в кэше.
 */
export const SizeCacheDemo: FC<ISizeCacheDemoProps> = ({ onBack }) => {
  const bottomInset = useBottomInset();
  const listRef = useRef<IAnchorListRef>(null);
  const listState = useAnchorListState();
  const data = useMemo(() => createMessages(0, MESSAGE_COUNT), []);
  const [enabled, setEnabled] = useState(cacheEnabled);
  const [cachedCount, setCachedCount] = useState(sizeCache.size);
  /** Момент создания экрана: от него считается время до показа. */
  const [mountedAt] = useState(() => Date.now());
  const [revealMs, setRevealMs] = useState<number | undefined>(undefined);

  // Читается один раз, к первому рендеру: дальше позиция живёт в списке.
  const [savedPosition] = useState<IAnchorListScrollAnchor | undefined>(() =>
    positionStore.read(SCREEN_ID),
  );

  const initialScroll = useMemo<AnchorListInitialScroll>(
    () =>
      savedPosition
        ? {
            type: "key",
            key: savedPosition.key,
            viewOffset: savedPosition.offset,
          }
        : { type: "index", index: DEFAULT_START_INDEX },
    [savedPosition],
  );

  const snapshot = useRef<IAnchorListScrollAnchor | undefined>(undefined);

  const capturePosition = useCallback(() => {
    const anchor = listRef.current?.getScrollAnchor();

    if (anchor) snapshot.current = anchor;
  }, []);

  // Снимок уходит в хранилище при уходе с экрана: в этот момент ref уже пуст,
  // поэтому копится он заранее — см. стенд «Стартовая позиция».
  useEffect(
    () => () => {
      if (snapshot.current) positionStore.write(SCREEN_ID, snapshot.current);
    },
    [],
  );

  // Состав видимых строк сменился — позиция уехала как минимум на строку;
  // смещение внутри строки досылает `onScrollEndDrag`.
  const firstVisible = useAnchorListValue(listState, "firstVisibleIndex");

  useEffect(() => {
    capturePosition();
  }, [firstVisible, capturePosition]);

  const handleLoad = useCallback(() => {
    setRevealMs(Date.now() - mountedAt);
    setCachedCount(sizeCache.size);
  }, [mountedAt]);

  const handleEnabledChange = useCallback((value: boolean) => {
    cacheEnabled = value;
    setEnabled(value);
  }, []);

  const handleClear = useCallback(() => {
    sizeCache.clear();
    setCachedCount(0);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatRowData }) => <ChatRow row={item} />,
    [],
  );

  const status =
    revealMs === undefined
      ? "список ещё не показан"
      : `показан через ${revealMs} мс · в кэше ${cachedCount} строк`;

  return (
    <Screen title={"Кэш измерений"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Использовать кэш при следующем открытии"}
          value={enabled}
          onChange={handleEnabledChange}
        />
        <StatusLine text={status} />
        <StatusLine
          text={
            "Уйдите на витрину и вернитесь: с кэшем список встаёт на место с " +
            "первой попытки, без него — меряет строки заново"
          }
        />
        <ChipRow>
          <ActionChip title={"Очистить кэш"} onPress={handleClear} />
        </ChipRow>
        <DebugToggles
          channels={["initial", "layout"]}
          defaultEnabled={["initial"]}
        />
      </ControlPanel>

      <AnchorList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        // Размеры нарочно не объявлены: кэш хранит только измеренное.
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        gap={MESSAGE_GAP}
        sizeCache={cacheEnabled ? sizeCache : undefined}
        initialScroll={initialScroll}
        state={listState}
        onLoad={handleLoad}
        onScrollEndDrag={capturePosition}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

SizeCacheDemo.displayName = "SizeCacheDemo";

const ss = StyleSheet.create({
  list: { flex: 1 },
});
