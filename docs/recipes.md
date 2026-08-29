# Рецепты

Законченные конфигурации под типовые задачи.

## Оглавление

- [Экран переписки](#экран-переписки)
- [Бесконечная лента](#бесконечная-лента)
- [Восстановление позиции](#восстановление-позиции)
- [Прилипающие заголовки дат](#прилипающие-заголовки-дат)
- [Кнопка «вниз»](#кнопка-вниз)
- [Переход к цитате](#переход-к-цитате)
- [Индикатор прокрутки](#индикатор-прокрутки)
- [Отметка о прочтении](#отметка-о-прочтении)

---

## Экран переписки

Всё сразу: история вверх, новые сообщения вниз, панель ввода, прилипающие даты.

```tsx
export const ChatScreen = ({ chatId }: { chatId: string }) => {
  const listRef = useRef<IAnchorListRef>(null);
  const { rows, dayIndices, loadOlder, send } = useChat(chatId);

  const isAtEnd = useSharedValue(true);

  // Одно перекрытие на всех: контент, скролл, индикатор, прилипание и кнопка.
  const composerHeight = useSharedValue(COMPOSER_HEIGHT);
  const keyboard = useKeyboardInset({ barHeight: composerHeight });

  const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
    () => [{ edge: "start", indices: dayIndices }],
    [dayIndices],
  );

  const sharedValues = useMemo(
    () => ({ isWithinMaintainScrollAtEndThreshold: isAtEnd }),
    [isAtEnd],
  );

  const maintainVisibleContentPosition = useMemo(
    () => ({ data: true, size: true }),
    [],
  );

  const maintainScrollAtEnd = useMemo(
    () => ({ onlyWhenAtEnd: true, animated: true }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: IAnchorListRenderItemProps<ChatRow>) => <ChatRowView row={item} />,
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <AnchorList
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={row => row.key}
        getItemType={row => row.type}
        getFixedItemSize={row => (row.type === "day" ? 44 : undefined)}
        estimatedItemSize={92}
        // Открыться внизу, у последнего сообщения.
        initialScroll={{ type: "end" }}
        // Пока сообщений меньше экрана — прижать к низу.
        alignItemsAtEnd
        // Новое сообщение приезжает само, если пользователь и так стоял внизу.
        maintainScrollAtEnd={maintainScrollAtEnd}
        // История, приезжающая сверху, не двигает то, что на экране.
        maintainVisibleContentPosition={maintainVisibleContentPosition}
        onStartReached={loadOlder}
        onStartReachedThreshold={0.4}
        sticky={sticky}
        // Распорка под панель, выравнивание, подъём смещения, отступ
        // индикатора и отступ якоря конечной кромки — всё отсюда.
        insetEnd={keyboard.contentInset}
        sharedValues={sharedValues}
        recycleItems
        style={{ flex: 1 }}
      />

      <JumpToEndButton
        bottomInset={keyboard.contentInset}
        isAtEnd={isAtEnd}
        onPress={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <Composer onSend={send} keyboard={keyboard} />
    </View>
  );
};
```

Хуки клавиатуры — в примере:
[`useKeyboardHeight`](../example/src/ui/useKeyboardHeight.ts) — сырая высота
покадрово, [`useKeyboardInset`](../example/src/ui/useKeyboardInset.ts) —
перекрытие, которое и уходит в `insetEnd`.

Разбор частей: [удержание позиции](maintain-position.md),
[подгрузка](pagination.md), [отступы](insets.md), [прилипание](sticky.md).

---

## Бесконечная лента

Растёт только вниз — компенсация не нужна и не включается.

```tsx
export const Feed = () => {
  const { posts, loadMore, loading, hasMore } = useFeed();

  const handleEndReached = useCallback(() => {
    if (loading || !hasMore) return;

    loadMore();
  }, [loading, hasMore, loadMore]);

  const renderItem = useCallback(
    ({ item }: { item: IPost }) => <PostCard post={item} />,
    [],
  );

  return (
    <AnchorList
      data={posts}
      renderItem={renderItem}
      keyExtractor={post => post.id}
      getItemType={post => post.layout}
      estimatedItemSize={220}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loading ? <FeedSpinner /> : null}
      recycleItems
      style={{ flex: 1 }}
    />
  );
};
```

---

## Восстановление позиции

Список открывается там, где его оставили, без видимого прыжка.

```tsx
const SCREEN_ID = "chat:42";

export const RestorableList = ({ data }: { data: ChatRow[] }) => {
  const listRef = useRef<IAnchorListRef>(null);

  // Чтение синхронное и ровно одно: позиция нужна к первому кадру.
  const [saved] = useState(() => storage.read(SCREEN_ID));

  const initialScroll = useMemo<AnchorListInitialScroll | undefined>(() => {
    if (!saved) return undefined;

    const index = data.findIndex(row => row.key === saved.key);

    // Строки уже нет — открываемся как обычно.
    if (index === -1) return undefined;

    return { type: "index", index, viewOffset: saved.offset };
  }, [data, saved]);

  const savePosition = useCallback(() => {
    const list = listRef.current;

    if (!list) return;

    const topIndex = list.getVisibleRange().start;
    const position = list.getPositionAtIndex(topIndex);
    const row = data[topIndex];

    if (position === undefined || !row) return;

    // Смещение со знаком: отрицательное значит, что строка уходит за кромку, —
    // именно оно вернёт её ровно тем же куском.
    storage.write(SCREEN_ID, {
      key: row.key,
      offset: position - list.getScrollOffset(),
    });
  }, [data]);

  // Снимок при уходе с экрана. Видимость сообщает только о смене состава строк,
  // поэтому доводка скролла внутри той же строки в неё не попала бы.
  useFocusEffect(useCallback(() => savePosition, [savePosition]));

  return (
    <AnchorList
      ref={listRef}
      data={data}
      initialScroll={initialScroll}
      // ...
    />
  );
};
```

**Хранилище должно быть синхронным** — MMKV, а не AsyncStorage: после
асинхронного чтения список успеет открыться сверху и дёрнется.

---

## Прилипающие заголовки дат

Индексы считает тот, кто строит данные:

```tsx
const buildRows = (messages: IMessage[]) => {
  const rows: ChatRow[] = [];
  const dayIndices: number[] = [];

  let previousDay: string | undefined;

  for (const message of messages) {
    if (message.day !== previousDay) {
      previousDay = message.day;
      dayIndices.push(rows.length);
      rows.push({ type: "day", key: `d-${message.day}`, day: message.day });
    }

    rows.push(message);
  }

  return { rows, dayIndices };
};
```

```tsx
const { rows, dayIndices } = useMemo(() => buildRows(messages), [messages]);

// Спиннер сверху сдвигает всё под собой — индексы нужно поправить.
const stickyIndices = useMemo(
  () => (loadingOlder ? dayIndices.map(index => index + 1) : dayIndices),
  [dayIndices, loadingOlder],
);

const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [{ edge: "start", indices: stickyIndices, offset: navbarHeight }],
  [stickyIndices, navbarHeight],
);
```

Прилипание аватаров групп к нижней кромке (режим `offset`) разобрано отдельно —
[Прилипание](sticky.md#режим-offset).

---

## Кнопка «вниз»

Полностью на UI-потоке: ни одного рендера при скролле.

```tsx
const isAtEnd = useSharedValue(true);

const sharedValues = useMemo(
  () => ({ isWithinMaintainScrollAtEndThreshold: isAtEnd }),
  [isAtEnd],
);

const style = useAnimatedStyle(() => ({
  opacity: withTiming(isAtEnd.value ? 0 : 1, { duration: 250 }),
  transform: [{ translateY: -(bottomInset.value + 12) }],
  // Видимость считается на UI-потоке, поэтому pointerEvents — стилем, а не
  // пропом: React не должен перехватывать тапы скрытой кнопки.
  pointerEvents: isAtEnd.value ? "none" : "auto",
}));

<AnchorList sharedValues={sharedValues} ... />;

<Animated.View style={[styles.fab, style]}>
  <Pressable onPress={() => listRef.current?.scrollToEnd({ animated: true })}>
    <ChevronDown />
  </Pressable>
</Animated.View>;
```

Порог «у конца» настраивается `maintainScrollAtEndThreshold` — он же используется
автоприлипанием, поэтому кнопка и прилипание согласованы по определению.

---

## Переход к цитате

```tsx
const [quotedKey, setQuotedKey] = useState<string | undefined>(undefined);

const quotedIndex = useMemo(
  () => (quotedKey ? rows.findIndex(row => row.key === quotedKey) : -1),
  [rows, quotedKey],
);

// Распорка даёт цитате у самого конца переписки подняться к верхней кромке.
const anchoredEndSpace = useMemo<IAnchorListAnchoredEndSpace | undefined>(
  () => (quotedIndex === -1 ? undefined : { anchorIndex: quotedIndex, anchorOffset: 12 }),
  [quotedIndex],
);

const jumpTo = useCallback(async (key: string) => {
  setQuotedKey(key);

  // Ключ переживает вставки и удаления, индекс — нет.
  const found = listRef.current?.scrollToKey({
    key,
    viewPosition: 0,
    viewOffset: 12,
    animated: true,
  });

  // Сообщения нет в загруженном окне — сначала подтянуть контекст вокруг него.
  if (!found) await loadContextAround(key);
}, []);

<AnchorList ref={listRef} anchoredEndSpace={anchoredEndSpace} ... />;
```

---

## Индикатор прокрутки

Полоса прогресса, двигающаяся на каждом кадре без единого рендера:

```tsx
const scrollOffset = useSharedValue(0);
const maxScroll = useSharedValue(0);

const sharedValues = useMemo(
  () => ({ scrollOffset, maxScroll }),
  [scrollOffset, maxScroll],
);

const progressStyle = useAnimatedStyle(() => ({
  width: `${
    maxScroll.value > 0
      ? Math.min(100, Math.max(0, (scrollOffset.value / maxScroll.value) * 100))
      : 0
  }%`,
}));

<AnchorList sharedValues={sharedValues} ... />;

<View style={styles.track}>
  <Animated.View style={[styles.bar, progressStyle]} />
</View>;
```

---

## Отметка о прочтении

```tsx
const handleViewableItemsChanged = useCallback(
  ({ changed }: IAnchorListViewabilityCallbackInfo<ChatRow>) => {
    const read = changed
      .filter(token => token.isViewable && token.item.type === "message")
      .map(token => token.item.id);

    if (read.length > 0) api.markRead(read);
  },
  [],
);

const viewabilityPairs = useMemo<IAnchorListViewabilityPair<ChatRow>[]>(
  () => [
    {
      // Полсекунды и половина строки: мелькнувшее при броске не считается.
      config: { itemVisiblePercentThreshold: 50, minimumViewTime: 500 },
      onViewableItemsChanged: handleViewableItemsChanged,
    },
  ],
  [handleViewableItemsChanged],
);

<AnchorList viewabilityPairs={viewabilityPairs} ... />;
```

---

## Дальше

- [`example/`](../example) — восемь работающих стендов
- [Диагностика](troubleshooting.md) — если что-то из этого повело себя не так
