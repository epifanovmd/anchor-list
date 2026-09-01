# Подгрузка

Пороги достижения начала и конца списка.

```tsx
<AnchorList
  data={rows}
  onStartReached={loadOlder}
  onStartReachedThreshold={0.4}
  onEndReached={loadNewer}
  onEndReachedThreshold={0.4}
  maintainVisibleContentPosition={{ data: true, size: true }}
  ...
/>
```

| Проп | По умолчанию | Что делает |
| --- | --- | --- |
| `onStartReached` | — | Скролл подошёл к началу контента |
| `onStartReachedThreshold` | `0.5` | Порог в долях длины вьюпорта |
| `onEndReached` | — | Скролл подошёл к концу контента |
| `onEndReachedThreshold` | `0.5` | Порог в долях длины вьюпорта |

Порог `0.5` — «за половину экрана до кромки».

Колбэк получает текущее расстояние:

```tsx
onEndReached={({ distanceFromEnd }) => {
  console.log(`до конца ${Math.round(distanceFromEnd)}px`);
  loadNewer();
}}
```

## Поведение порогов

**Один раз на жест.** Повторно колбэк не вызывается, пока пользователь не оторвал
палец и не двинулся в другую сторону. Свой флаг «уже гружу» всё равно нужен —
жест может закончиться и начаться снова раньше ответа:

```tsx
const handleStartReached = useCallback(() => {
  if (loading || reachedOldest) return;

  setLoading(true);
  loadOlder().finally(() => setLoading(false));
}, [loading, reachedOldest]);
```

**Гистерезис у границы.** Выход за порог засчитывается с запасом 1.3×. Кромка,
достигнутая точно, не покидается никогда.

**Одна кромка на жест.** После срабатывания одной кромки вторая молчит до нового
жеста; направление жеста решает, какая разблокируется. Гейт открывается сам,
когда обе кромки далеко за порогами.

**Молчат во время программного скролла.** Пока идёт `initialScroll`, программный
скролл или автоприлипание к концу, пороги не проверяются.

## Расстояния

`distanceFromEnd` считается **без отступа конца**: распорки `anchoredEndSpace` и
`alignItemsAtEnd` в него не входят.

Те же расстояния доступны непрерывно:

```tsx
const distanceFromEnd = useSharedValue(0);
const isNearEnd = useSharedValue(false);

<AnchorList
  sharedValues={useMemo(
    () => ({ distanceFromEnd, isNearEnd }),
    [distanceFromEnd, isNearEnd],
  )}
/>;
```

Сигналы кромок обновляются всегда, даже когда колбэки подавлены. См.
[Состояние списка](state.md#кромки).

## Спиннеры

Спиннер — обычная строка данных, поэтому он участвует в раскладке:

```tsx
const data = useMemo(() => {
  const rows: ChatRow[] = [...messages];

  if (loadingStart) rows.unshift({ type: "spinner", key: "spinner-start" });
  if (loadingEnd) rows.push({ type: "spinner", key: "spinner-end" });

  return rows;
}, [messages, loadingStart, loadingEnd]);
```

Три требования:

**1. Ключ спиннера постоянный.**

**2. Высота спиннера объявлена:**

```tsx
getFixedItemSize={row => (row.type === "spinner" ? 56 : undefined)}
```

**3. Индексы прилипания сдвинуты** — спиннер сверху сдвигает всё под собой:

```tsx
const dayIndices = useMemo(
  () => (loadingStart ? indices.map(index => index + 1) : indices),
  [indices, loadingStart],
);
```

Альтернатива — `ListHeaderComponent` и `ListFooterComponent`: спиннер не попадает
в данные и индексы не двигает, но и в раскладку элементов не входит.

## Подгрузка вверх

Вставка выше вьюпорта требует удержания позиции:

```tsx
<AnchorList
  onStartReached={loadOlder}
  maintainVisibleContentPosition={{ data: true, size: true }}
/>
```

Разбор — [Удержание позиции](maintain-position.md).

## Конец данных

Список не знает, кончились ли данные:

```tsx
const handleStartReached = useCallback(() => {
  if (loading || !hasMoreOlder) return;
  // ...
}, [loading, hasMoreOlder]);
```

Порог продолжит срабатывать на каждом жесте у кромки.

## Целиком

```tsx
const useHistory = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasOlder) return;

    setLoadingOlder(true);

    try {
      const page = await api.history({ before: messages[0]?.id });

      setMessages(current => [...page.items, ...current]);
      setHasOlder(page.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasOlder, messages]);

  const rows = useMemo<ChatRow[]>(
    () =>
      loadingOlder
        ? [{ type: "spinner", key: "spinner-start" }, ...messages]
        : messages,
    [messages, loadingOlder],
  );

  return { rows, loadOlder };
};
```

```tsx
<AnchorList
  data={rows}
  renderItem={renderItem}
  keyExtractor={row => row.key ?? row.id}
  getItemType={row => row.type}
  getFixedItemSize={row => (row.type === "spinner" ? 56 : undefined)}
  estimatedItemSize={92}
  maintainVisibleContentPosition={{ data: true, size: true }}
  onStartReached={loadOlder}
  onStartReachedThreshold={0.4}
  recycleItems
  style={{ flex: 1 }}
/>
```

## Проверить руками

Стенд «Подгрузка с обеих сторон» в [`example/`](../example): спиннеры на обеих
кромках, удержание позиции отключается тумблером.
