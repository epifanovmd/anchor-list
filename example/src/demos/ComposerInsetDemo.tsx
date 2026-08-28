import type { IAnchorListRef } from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

import type { ChatRowData } from "../data";
import {
  chatRowHeight,
  chatRowKey,
  chatRowType,
  createMessage,
  createMessages,
  ESTIMATED_ROW_SIZE,
} from "../data";
import { ChatRow, JumpToEndButton } from "../rows";
import {
  ControlPanel,
  Screen,
  StatusLine,
  ToggleRow,
  Txt,
  useKeyboardInset,
  useKeyboardScrollCompensation,
  useTheme,
} from "../ui";

const INITIAL_COUNT = 120;
/** Высота строки ввода без безопасной зоны под ней. */
const COMPOSER_HEIGHT = 56;

interface IComposerInsetDemoProps {
  onBack: () => void;
}

/**
 * Стенд нижнего отступа.
 *
 * Панель ввода и клавиатура съедают низ вьюпорта. Отступ отдаётся списку
 * распоркой в подвале, а контент поднимается вместе с клавиатурой — этим
 * занимается {@link useKeyboardScrollCompensation}: одной распорки мало, она
 * добавляется в конец контента и видимые строки не двигает.
 *
 * Положение клавиатуры берётся у `react-native-keyboard-controller`: он отдаёт
 * его покадрово и сразу shared value, поэтому распорка, скролл, индикатор и
 * кнопка возврата едут с клавиатурой в один кадр, а не догоняют её через рендер.
 *
 * Проверяется так: встать у нижней строки и открыть клавиатуру — строка должна
 * остаться видимой, а не уехать под панель. Отдельно проверяется самый низ
 * списка: там место под распорку нужно зарезервировать заранее, иначе сдвиг
 * упрётся в ещё не выросший диапазон скролла.
 */
export const ComposerInsetDemo: FC<IComposerInsetDemoProps> = ({ onBack }) => {
  const { palette } = useTheme();
  const listRef = useRef<IAnchorListRef>(null);

  const [rows, setRows] = useState<ChatRowData[]>(() =>
    createMessages(0, INITIAL_COUNT),
  );
  const [text, setText] = useState("");
  const [compensate, setCompensate] = useState(true);
  const [stickToEnd, setStickToEnd] = useState(true);

  /** Список у нижнего края: по нему кнопка возврата решает, показываться ли. */
  const isAtEnd = useSharedValue(true);

  // С выключенной компенсацией отступ застывает на закрытом положении: список
  // не узнаёт о клавиатуре, и видно, как контент уходит под неё.
  const isCompensating = useSharedValue(compensate);

  useEffect(() => {
    isCompensating.value = compensate;
  }, [compensate, isCompensating]);

  const composerHeight = useSharedValue(COMPOSER_HEIGHT);
  const keyboard = useKeyboardInset(composerHeight);

  /** Перекрытие при закрытой клавиатуре — панель плюс безопасная зона. */
  const closedInset = useDerivedValue(
    () =>
      COMPOSER_HEIGHT +
      Math.max(
        0,
        keyboard.occludedBottom.value - keyboard.keyboardHeight.value,
      ),
  );

  const contentInset = useDerivedValue(() =>
    isCompensating.value ? keyboard.contentInset.value : closedInset.value,
  );
  const reservedInset = useDerivedValue(() =>
    isCompensating.value ? keyboard.reservedInset.value : closedInset.value,
  );

  const compensation = useKeyboardScrollCompensation(
    contentInset,
    reservedInset,
  );

  const composerStyle = useAnimatedStyle(() => ({
    // Безопасная зона гасится ровно настолько, насколько её перекрыла
    // клавиатура: иначе между строкой ввода и клавишами остаётся пустая полоса.
    paddingBottom:
      keyboard.occludedBottom.value - keyboard.keyboardHeight.value,
    transform: [{ translateY: -keyboard.keyboardHeight.value }],
  }));

  const listFooter = useMemo(
    () => (
      <Animated.View style={compensation.spacerStyle} pointerEvents={"none"} />
    ),
    [compensation.spacerStyle],
  );

  const handleSend = useCallback(() => {
    setRows(current => {
      const next = createMessage(30000 + current.length);

      return [...current, { ...next, text: text || next.text }];
    });
    setText("");
  }, [text]);

  const maintainScrollAtEnd = useMemo(
    () => (stickToEnd ? { onlyWhenAtEnd: true, animated: true } : undefined),
    [stickToEnd],
  );

  const sharedValues = useMemo(
    () => ({ isWithinMaintainScrollAtEndThreshold: isAtEnd }),
    [isAtEnd],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRowData }) => <ChatRow row={item} />,
    [],
  );

  const handleJumpToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <Screen title={"Нижний отступ"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Компенсировать клавиатуру и панель"}
          value={compensate}
          onChange={setCompensate}
        />
        <ToggleRow
          title={"Прилипать к концу при отправке"}
          value={stickToEnd}
          onChange={setStickToEnd}
        />
        <StatusLine text={"Встаньте у нижней строки и откройте клавиатуру"} />
      </ControlPanel>

      <View style={ss.body}>
        <AnchorList
          ref={listRef}
          // Компенсация двигает скролл с UI-потока — ей нужен тот же ScrollView.
          refScrollView={compensation.scrollRef}
          onLayout={compensation.onLayout}
          onContentSizeChange={compensation.onContentSizeChange}
          // Пока палец на экране, позицией управляет жест.
          onScrollBeginDrag={compensation.onScrollBeginDrag}
          onScrollEndDrag={compensation.onScrollEndDrag}
          data={rows}
          renderItem={renderItem}
          keyExtractor={chatRowKey}
          getItemType={chatRowType}
          getFixedItemSize={chatRowHeight}
          estimatedItemSize={ESTIMATED_ROW_SIZE}
          alignItemsAtEnd
          initialScroll={{ type: "end" }}
          maintainScrollAtEnd={maintainScrollAtEnd}
          maintainVisibleContentPosition={{ data: true, size: true }}
          // Высота той же распорки: индикатор скролла и якорь конечной кромки
          // обязаны кончаться на одной линии с последней строкой.
          insetEnd={compensation.contentInset}
          sharedValues={sharedValues}
          ListFooterComponent={listFooter}
          recycleItems
          style={ss.list}
        />

        {/* Кнопка держится над панелью ввода и поднимается вместе с
            клавиатурой. Отступ берётся живой, а не зарезервированный: резерв
            прыгает к цели сразу, и кнопка уехала бы вверх раньше клавиатуры, а
            при закрытии повисла бы наверху до конца анимации. */}
        <JumpToEndButton
          bottomInset={contentInset}
          isAtEnd={isAtEnd}
          onPress={handleJumpToEnd}
        />

        <Animated.View
          style={[
            ss.composer,
            composerStyle,
            {
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
            },
          ]}
        >
          <View style={ss.composerRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={"Сообщение"}
              placeholderTextColor={palette.textMuted}
              style={[
                ss.input,
                { backgroundColor: palette.bubble, color: palette.text },
              ]}
            />
            <Pressable onPress={handleSend} style={ss.send} hitSlop={8}>
              <Txt role={"body"} style={{ color: palette.accent }}>
                {"Отпр."}
              </Txt>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
};

ComposerInsetDemo.displayName = "ComposerInsetDemo";

const ss = StyleSheet.create({
  body: { flex: 1 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  composerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    height: COMPOSER_HEIGHT,
    paddingHorizontal: 12,
  },
  input: { borderRadius: 10, flex: 1, height: 38, paddingHorizontal: 12 },
  list: { flex: 1 },
  send: { paddingHorizontal: 4 },
});
