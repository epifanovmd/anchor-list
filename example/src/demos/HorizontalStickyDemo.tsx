import type {
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RailRowData } from "../data";
import {
  CARD_GAP,
  createCards,
  ESTIMATED_CARD_WIDTH,
  GROUP_TAG_WIDTH,
  RAIL_HEIGHT,
  railRowKey,
  railRowType,
  railRowWidth,
  withMonthMarkers,
} from "../data";
import { PinnedRailTag, RailCard } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
} from "../ui";

const CARD_COUNT = 600;

interface IHorizontalStickyDemoProps {
  onBack: () => void;
}

/**
 * Стенд прилипания на горизонтальной оси.
 *
 * Зеркало стенда «Прилипание на двух кромках»: метки месяцев прилипают к левой
 * кромке — уходящая влево метка задерживается у края, пока её не вытолкнет
 * следующая; метки групп прилипают к правой — метка остаётся у правого края,
 * пока видна хоть часть группы, и не уходит левее её начала.
 *
 * Что здесь проверяется помимо самого прилипания: слой прилипших копий живёт
 * снаружи `ScrollView`, в координатах вьюпорта, и прижимать копию он обязан к
 * кромке оси, а не к верху экрана. На вертикали ошибка в этом месте не видна —
 * там обе кромки совпадают.
 */
export const HorizontalStickyDemo: FC<IHorizontalStickyDemoProps> = ({
  onBack,
}) => {
  const [stickyMonths, setStickyMonths] = useState(true);
  const [stickyTags, setStickyTags] = useState(true);

  const { rows, monthIndices, tagIndices, groupStarts } = useMemo(
    () => withMonthMarkers(createCards(0, CARD_COUNT)),
    [],
  );

  const sticky = useMemo<IAnchorListStickyConfig<RailRowData>[]>(() => {
    const configs: IAnchorListStickyConfig<RailRowData>[] = [];

    if (stickyMonths) {
      // Отступ не задан: слева вьюпорт ленты ничем не занят.
      configs.push({ edge: "start", indices: monthIndices });
    }

    if (stickyTags) {
      // Прилипает только метка: карточка остаётся на своём месте.
      configs.push({
        edge: "end",
        indices: tagIndices,
        mode: "offset",
        size: GROUP_TAG_WIDTH,
        groupStarts,
        limitInset: CARD_GAP,
        // Пока метка стоит у кромки, её рисует слой поверх списка: там у неё
        // нет покадрового трансформа и нечему дрожать.
        renderOverlay: item => <PinnedRailTag row={item} />,
      });
    }

    return configs;
  }, [stickyMonths, stickyTags, monthIndices, tagIndices, groupStarts]);

  const renderItem = useCallback(
    ({
      item,
      stickyOffset,
      stickyPinned,
    }: IAnchorListRenderItemProps<RailRowData>) => (
      <RailCard
        row={item}
        withTag
        stickyOffset={stickyOffset}
        stickyPinned={stickyPinned}
      />
    ),
    [],
  );

  return (
    <Screen title={"Прилипание по горизонтали"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Месяцы прилипают слева"}
          value={stickyMonths}
          onChange={setStickyMonths}
        />
        <ToggleRow
          title={"Метки групп прилипают справа"}
          value={stickyTags}
          onChange={setStickyTags}
        />
        <StatusLine
          text={`месяцев: ${monthIndices.length} · групп: ${tagIndices.length}`}
        />
        <DebugToggles channels={["sticky", "layout"]} />
      </ControlPanel>

      {/* Лента занимает свою высоту, а не весь экран: поперёк оси размер
          задаёт стенд. Обёртка ставит её по центру остатка — иначе под лентой
          остаётся пустое поле, и стенд выглядит недорисованным. */}
      <View style={ss.stage}>
        <AnchorList
          horizontal
          data={rows}
          renderItem={renderItem}
          keyExtractor={railRowKey}
          getItemType={railRowType}
          getFixedItemSize={railRowWidth}
          estimatedItemSize={ESTIMATED_CARD_WIDTH}
          drawDistance={600}
          sticky={sticky}
          recycleItems
          style={ss.list}
        />
      </View>
    </Screen>
  );
};

HorizontalStickyDemo.displayName = "HorizontalStickyDemo";

const ss = StyleSheet.create({
  list: { height: RAIL_HEIGHT },
  stage: { flex: 1, justifyContent: "center" },
});
