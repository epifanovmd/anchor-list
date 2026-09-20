import type {
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
} from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ChatRowData } from "../data";
import {
  chatRowHeight,
  chatRowKey,
  chatRowType,
  createMessages,
  ESTIMATED_ROW_SIZE,
  MESSAGE_GAP,
  withDaySeparators,
} from "../data";
import { FadingChatRow } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  Txt,
  useBottomInset,
  useTheme,
} from "../ui";

const MESSAGE_COUNT = 300;
/** Высота панели, которой стенд закрывает низ списка вместо клавиатуры. */
const PANEL_HEIGHT = 180;

interface IItemVisibilityDemoProps {
  onBack: () => void;
}

/**
 * Стенд видимости строки.
 *
 * Каждая строка гасится и сжимается по мере ухода за кромку — доля строки во
 * вьюпорте приходит из `useAnchorListItemVisibility` shared value, и вся
 * анимация идёт на UI-потоке без рендеров. Полоса у правого края каждой
 * строки показывает ту же долю.
 *
 * Две вещи, ради которых хук отличается от «пересёк ли вьюпорт»:
 *
 * - **панель снизу** — тумблер поднимает `insetEnd` на высоту панели, и строки
 *   под ней гаснут: они внутри ScrollView, но пользователю не видны;
 * - **прилипший заголовок дня** — его видимость считается от места, где он
 *   стоит у кромки, а не где лежит в контенте.
 */
export const ItemVisibilityDemo: FC<IItemVisibilityDemoProps> = ({
  onBack,
}) => {
  const { palette } = useTheme();
  const bottomInset = useBottomInset();
  const feed = useMemo(
    () => withDaySeparators(createMessages(0, MESSAGE_COUNT)),
    [],
  );
  const [fade, setFade] = useState(true);
  const [panelShown, setPanelShown] = useState(false);

  // Панель едет как клавиатура: величина на UI-потоке, анимацией, и список
  // получает её тем же пропом `insetEnd`.
  const panelHeight = useSharedValue(0);

  useEffect(() => {
    panelHeight.value = withTiming(panelShown ? PANEL_HEIGHT : 0, {
      duration: 250,
    });
  }, [panelShown, panelHeight]);

  const insetEnd = useDerivedValue(() => bottomInset.value + panelHeight.value);

  const panelStyle = useAnimatedStyle(() => ({
    height: insetEnd.value,
    opacity: panelHeight.value > 0 ? 1 : 0,
  }));

  const sticky = useMemo<IAnchorListStickyConfig<ChatRowData>[]>(
    () => [{ edge: "start", indices: feed.dayIndices }],
    [feed.dayIndices],
  );

  const renderItem = useCallback(
    ({ item }: IAnchorListRenderItemProps<ChatRowData>) => (
      <FadingChatRow row={item} fade={fade} />
    ),
    [fade],
  );

  return (
    <Screen title={"Видимость строки"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Гасить строки у кромок"}
          value={fade}
          onChange={setFade}
        />
        <ToggleRow
          title={"Панель снизу (insetEnd)"}
          value={panelShown}
          onChange={setPanelShown}
        />
        <StatusLine
          text={
            "Полоса справа — доля строки во вьюпорте. Под панелью она падает " +
            "до нуля, у прилипшего заголовка держится единицей"
          }
        />
        <DebugToggles channels={["view", "insets"]} />
      </ControlPanel>

      <View style={ss.body}>
        <AnchorList
          data={feed.rows}
          renderItem={renderItem}
          keyExtractor={chatRowKey}
          getItemType={chatRowType}
          getFixedItemSize={chatRowHeight}
          estimatedItemSize={ESTIMATED_ROW_SIZE}
          gap={MESSAGE_GAP}
          sticky={sticky}
          insetEnd={insetEnd}
          recycleItems
          style={ss.list}
        />

        <Animated.View
          pointerEvents={"none"}
          style={[ss.panel, panelStyle, { backgroundColor: palette.surface }]}
        >
          <Txt role={"caption"} muted>
            {"Панель: строки под ней не видны"}
          </Txt>
        </Animated.View>
      </View>
    </Screen>
  );
};

ItemVisibilityDemo.displayName = "ItemVisibilityDemo";

const ss = StyleSheet.create({
  body: { flex: 1 },
  list: { flex: 1 },
  panel: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
});
