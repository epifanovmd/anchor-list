import type { IAnchorListRef } from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
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
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
  Txt,
  useKeyboardInset,
  useTheme,
} from "../ui";

const INITIAL_COUNT = 4;
/** Высота строки ввода без безопасной зоны под ней. */
const COMPOSER_HEIGHT = 56;

interface IComposerInsetDemoProps {
  onBack: () => void;
}

/**
 * Стенд нижнего отступа.
 *
 * Панель ввода и клавиатура съедают низ вьюпорта. Стенду остаётся посчитать
 * перекрытие — сколько низа занято прямо сейчас — и отдать одно значение
 * пропом `insetEnd`. Распорку в конце контента, сдвиг короткого контента к
 * концу, подъём смещения под клавиатуру, отступ индикатора и отступ якоря
 * конечной кромки список делает сам и от этого же числа.
 *
 * Перекрытие собирает {@link useKeyboardInset}: положение клавиатуры он берёт у
 * `react-native-keyboard-controller` — покадрово и сразу shared value, поэтому
 * список, панель ввода и кнопка возврата едут с ней в один кадр, а не догоняют
 * её через рендер. Выключенный тумблер замораживает перекрытие на безопасной
 * зоне и высоте панели: список тогда о клавиатуре не знает, и видно, как
 * контент уходит под неё.
 *
 * Проверяется так: встать у нижней строки и открыть клавиатуру — строка должна
 * остаться видимой, а не уехать под панель. Отдельно — самый низ списка: там
 * контент двигает смещение, и заметно, если оно отстаёт от клавиатуры хоть на
 * кадр. И отдельно — короткий список: прокручивать в нём нечего, и подъём
 * целиком делает сдвиг выравнивания.
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

  const composerHeight = useSharedValue(COMPOSER_HEIGHT);
  // Выключенная компенсация замораживает перекрытие на закрытом положении:
  // список не узнаёт о клавиатуре, и видно, как контент уходит под неё.
  const keyboard = useKeyboardInset({
    barHeight: composerHeight,
    enabled: compensate,
  });

  const composerStyle = useAnimatedStyle(() => ({
    // Безопасная зона гасится ровно настолько, насколько её перекрыла
    // клавиатура: иначе между строкой ввода и клавишами остаётся пустая полоса.
    paddingBottom:
      keyboard.occludedBottom.value - keyboard.keyboardHeight.value,
    transform: [{ translateY: -keyboard.keyboardHeight.value }],
  }));

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
        <DebugToggles channels={["insets", "scroll"]} />
      </ControlPanel>

      <View style={ss.body}>
        <AnchorList
          ref={listRef}
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
          // Одно значение на весь низ: распорка в конце контента, сдвиг
          // короткого контента к концу, подъём смещения под клавиатуру,
          // индикатор скролла и якорь конечной кромки.
          insetEnd={keyboard.contentInset}
          sharedValues={sharedValues}
          recycleItems
          style={ss.list}
        />

        {/* Кнопка держится над панелью ввода и поднимается вместе с
            клавиатурой. Отступ берётся живой, а не зарезервированный: резерв
            прыгает к цели сразу, и кнопка уехала бы вверх раньше клавиатуры, а
            при закрытии повисла бы наверху до конца анимации. */}
        {/* Живое перекрытие: кнопка держится над панелью ввода, а та едет с
            клавиатурой и с выключенной компенсацией. */}
        <JumpToEndButton
          bottomInset={keyboard.liveInset}
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
