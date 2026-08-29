import type {
  IAnchorListRenderItemProps,
  IAnchorListSharedValues,
  IAnchorListStickyConfig,
  IAnchorListViewabilityCallbackInfo,
  IAnchorListViewabilityPair,
} from "@epifanovmd/anchor-list";
import {
  AnchorList,
  useAnchorListState,
  useAnchorListValue,
} from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatRowData } from "../data";
import {
  AVATAR_SIZE,
  chatRowHeight,
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
  LiveNumber,
  MeterBar,
  Screen,
  SignalDot,
  StatusLine,
  Txt,
  useBottomInset,
  useTheme,
} from "../ui";

const MESSAGE_COUNT = 400;
/**
 * Потолок шкалы скорости, px/мс.
 *
 * Обычный бросок пальцем укладывается сюда с запасом; упереть полосу можно
 * разве что рывком через весь экран. Точное значение и достигнутый пик всё
 * равно стоят цифрами рядом — полоса нужна только для порядка величины.
 */
const VELOCITY_SCALE = 12;

const round = (value: number | undefined) =>
  value === undefined ? "—" : Math.round(value).toLocaleString("ru-RU");

/** У активного якоря -1 означает «на этой кромке никто не прилип». */
const anchor = (index: number | undefined) =>
  index === undefined || index < 0 ? "—" : `#${index}`;

interface ILiveStateDemoProps {
  onBack: () => void;
}

/**
 * Стенд состояния списка.
 *
 * Показывает оба способа читать состояние и, главное, разницу в цене:
 *
 * - верхняя половина панели живёт на `sharedValues`. Полосы, цифры и точки
 *   пересчитываются на каждом кадре скролла и не вызывают ни одного рендера;
 * - нижняя читает то же самое через `state` и `useAnchorListValue`. Счётчик
 *   рядом показывает, во сколько рендеров панели это обходится.
 *
 * Прокрутите список и сравните: картинка сверху двигается непрерывно, а число
 * рендеров внизу растёт ровно на изменения значений, которые туда подписаны.
 *
 * Здесь же собраны все значения, которые список отдаёт наружу. Ради части из
 * них на экране заведены шапка, подвал и прилипающие элементы: без них
 * соответствующие сигналы стояли бы в нуле и показывать было бы нечего.
 */
export const LiveStateDemo: FC<ILiveStateDemoProps> = ({ onBack }) => {
  const { palette } = useTheme();
  const { bottom: inset } = useSafeAreaInsets();
  const bottomInset = useBottomInset();

  const { rows, dayIndices, avatarIndices, groupStarts } = useMemo(
    () => withDaySeparators(createMessages(0, MESSAGE_COUNT)),
    [],
  );

  // ── UI-поток ──────────────────────────────────────────────────────────────
  const scrollOffset = useSharedValue(0);
  const maxScroll = useSharedValue(0);
  const velocity = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const isMomentum = useSharedValue(false);
  const isAtStart = useSharedValue(true);
  const isAtEnd = useSharedValue(false);
  const isNearStart = useSharedValue(true);
  const isNearEnd = useSharedValue(false);
  const isWithinStickThreshold = useSharedValue(false);

  /**
   * Наибольшая скорость за сеанс.
   *
   * Полоса упирается в потолок и о том, насколько его перебили, молчит. Пик
   * отвечает на это прямо — и заодно показывает, какой потолок здесь вообще
   * уместен.
   */
  const velocityPeak = useSharedValue(0);

  useAnimatedReaction(
    () => velocity.value,
    current => {
      // Сравнение по модулю, а запоминается со знаком: бросок вверх и бросок
      // вниз — разные события, и по одному модулю их не различить.
      if (Math.abs(current) > Math.abs(velocityPeak.value))
        velocityPeak.value = current;
    },
  );

  const sharedValues = useMemo<IAnchorListSharedValues>(
    () => ({
      scrollOffset,
      maxScroll,
      velocity,
      isDragging,
      isMomentum,
      isAtStart,
      isAtEnd,
      isNearStart,
      isNearEnd,
      isWithinMaintainScrollAtEndThreshold: isWithinStickThreshold,
    }),
    [
      scrollOffset,
      maxScroll,
      velocity,
      isDragging,
      isMomentum,
      isAtStart,
      isAtEnd,
      isNearStart,
      isNearEnd,
      isWithinStickThreshold,
    ],
  );

  // ── React ─────────────────────────────────────────────────────────────────
  // Объект состояния создаётся вне списка и живёт дольше него: подписаться
  // можно до того, как список смонтируется.
  const listState = useAnchorListState();

  const firstVisible = useAnchorListValue(listState, "firstVisibleIndex");
  const lastVisible = useAnchorListValue(listState, "lastVisibleIndex");
  const numContainers = useAnchorListValue(listState, "numContainers");
  const contentSize = useAnchorListValue(listState, "contentSize");
  const totalSize = useAnchorListValue(listState, "totalSize");
  const headerSize = useAnchorListValue(listState, "headerSize");
  const footerSize = useAnchorListValue(listState, "footerSize");
  const endSpace = useAnchorListValue(listState, "anchoredEndSpaceSize");
  const scrollSize = useAnchorListValue(listState, "scrollSize");
  const scrollLength = useAnchorListValue(listState, "scrollLength");
  const distanceFromStart = useAnchorListValue(listState, "distanceFromStart");
  const distanceFromEnd = useAnchorListValue(listState, "distanceFromEnd");
  const stickyStart = useAnchorListValue(listState, "activeStickyStartIndex");
  const stickyEnd = useAnchorListValue(listState, "activeStickyEndIndex");
  const scrollAdjust = useAnchorListValue(listState, "scrollAdjust");
  const contentOrigin = useAnchorListValue(listState, "contentOrigin");
  const readyToRender = useAnchorListValue(listState, "readyToRender");

  /**
   * Сколько раз панель перерисовалась.
   *
   * Ref, а не состояние: счётчик считает рендеры, а не вызывает их. Растёт он
   * только из-за подписок ниже — верхняя половина панели в него не вносит
   * ничего.
   */
  /** Всё, что список добавляет к элементам: шапка, подвал и распорки. */
  const trim = (headerSize ?? 0) + (footerSize ?? 0) + (endSpace ?? 0) + inset;

  const renderCount = useRef(0);

  renderCount.current += 1;

  const [viewableCount, setViewableCount] = useState(0);

  const handleViewableItemsChanged = useCallback(
    (info: IAnchorListViewabilityCallbackInfo<ChatRowData>) =>
      setViewableCount(info.viewableItems.length),
    [],
  );

  const viewabilityPairs = useMemo<IAnchorListViewabilityPair<ChatRowData>[]>(
    () => [
      {
        // Строка считается видимой, когда её видно наполовину и она пробыла
        // такой хотя бы кадр: иначе события сыпались бы на каждом кадре броска.
        config: { itemVisiblePercentThreshold: 50, minimumViewTime: 100 },
        onViewableItemsChanged: handleViewableItemsChanged,
      },
    ],
    [handleViewableItemsChanged],
  );

  // Прилипание заведено ради двух сигналов активных якорей: без якорей на обеих
  // кромках они стояли бы в -1. Как его настраивать — стенд «Прилипание».
  const sticky = useMemo<IAnchorListStickyConfig<ChatRowData>[]>(
    () => [
      { edge: "start", indices: dayIndices },
      {
        edge: "end",
        indices: avatarIndices,
        mode: "offset",
        size: AVATAR_SIZE,
        groupStarts,
        limitInset: MESSAGE_GAP,
        renderOverlay: item => <PinnedAvatar row={item} />,
      },
    ],
    [dayIndices, avatarIndices, groupStarts],
  );

  // Шапка нужна тому же — сигналу `headerSize`. Заодно видно, чем полная высота
  // контента отличается от суммы элементов.
  const listHeader = useMemo(
    () => (
      <View style={[ss.header, { borderBottomColor: palette.border }]}>
        <Txt role={"caption"} muted>
          {"Шапка входит в контент, но не в сумму элементов"}
        </Txt>
      </View>
    ),
    [palette.border],
  );

  // Аватар рисует сама строка, а прилипание отдаёт ей смещение и признак
  // «сейчас вместо меня рисует слой поверх». Без этого аватара в строках нет
  // вовсе, и на экране виден только тот, что рисует слой у нижней кромки.
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
    <Screen title={"Состояние списка"} onBack={onBack}>
      <ControlPanel>
        <Txt role={"caption"}>{"sharedValues · UI-поток, без рендеров"}</Txt>

        {/* Числа рядом с полосами тоже идут с UI-потока: полоса даёт порядок,
            цифры — точность, и ни то ни другое не стоит рендера. */}
        <View style={ss.meters}>
          <MeterBar
            label={"смещение, px"}
            value={scrollOffset}
            max={maxScroll}
            readout={<LiveNumber value={scrollOffset} digits={0} />}
          />
          <MeterBar
            label={"скорость, px/мс (знак — направление)"}
            value={velocity}
            max={VELOCITY_SCALE}
            origin={"center"}
            readout={
              <View style={ss.readout}>
                <LiveNumber value={velocityPeak} digits={2} prefix={"пик "} />
                <LiveNumber value={velocity} digits={2} />
              </View>
            }
          />
        </View>

        <View style={ss.dots}>
          <SignalDot label={"палец"} value={isDragging} />
          <SignalDot label={"инерция"} value={isMomentum} />
          <SignalDot label={"у начала"} value={isAtStart} />
          <SignalDot label={"у конца"} value={isAtEnd} />
          <SignalDot label={"близко к началу"} value={isNearStart} />
          <SignalDot label={"близко к концу"} value={isNearEnd} />
          {/* Порог свой, отдельный от подгрузки: «пора прилипать к концу» и
              «пора подгружать» — разные расстояния. */}
          <SignalDot
            label={"порог прилипания"}
            value={isWithinStickThreshold}
          />
        </View>

        <View style={ss.divider} />

        <Txt role={"caption"}>
          {`state · React, рендеров панели: ${renderCount.current}`}
        </Txt>

        <StatusLine
          text={`видимые: ${firstVisible ?? -1}…${lastVisible ?? -1} · проходят порог: ${viewableCount} · контейнеров: ${numContainers ?? 0}`}
        />
        {/* Слагаемые вынесены на свою строку: в одну они складывались в
            полотно, которое глазом уже не читается. */}
        <StatusLine
          text={`контент ${round(contentSize)} = элементы ${round(totalSize)} + обвязка ${round(trim)}`}
        />
        <StatusLine
          text={`обвязка: шапка ${round(headerSize)} · подвал ${round(footerSize)} · распорки ${round((endSpace ?? 0) + inset)}`}
        />
        {/* Вьюпорт отдаётся и целиком, и вдоль оси скролла: прилипанию нужна
            вторая величина, а вертикальному списку она равна высоте. */}
        <StatusLine
          text={`вьюпорт ${round(scrollSize?.width)}×${round(scrollSize?.height)} · вдоль оси ${round(scrollLength)}`}
        />
        <StatusLine
          text={`до начала ${round(distanceFromStart)} · до конца ${round(distanceFromEnd)}`}
        />
        {/* Две поправки к координатам. Начало элементов — это высота шапки: на
            неё нативное смещение скролла отличается от позиций строк, и всё,
            что переводит одно в другое, обязано её снимать. */}
        <StatusLine
          text={`начало элементов ${round(contentOrigin)} · компенсация ${round(scrollAdjust)}`}
        />
        <StatusLine
          text={`прилипло: сверху ${anchor(stickyStart)} · снизу ${anchor(stickyEnd)}`}
        />
        <StatusLine
          text={`первый кадр: ${readyToRender ? "отрисован" : "нет"}`}
        />
      </ControlPanel>

      <AnchorList
        data={rows}
        renderItem={renderItem}
        keyExtractor={chatRowKey}
        getItemType={chatRowType}
        getFixedItemSize={chatRowHeight}
        estimatedItemSize={ESTIMATED_ROW_SIZE}
        sticky={sticky}
        sharedValues={sharedValues}
        state={listState}
        viewabilityPairs={viewabilityPairs}
        ListHeaderComponent={listHeader}
        insetEnd={bottomInset}
        recycleItems
        style={ss.list}
      />
    </Screen>
  );
};

LiveStateDemo.displayName = "LiveStateDemo";

const ss = StyleSheet.create({
  divider: {
    backgroundColor: "rgba(128,128,128,0.25)",
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  list: { flex: 1 },
  meters: { gap: 8, marginTop: 6 },
  readout: { alignItems: "center", flexDirection: "row", gap: 10 },
});
