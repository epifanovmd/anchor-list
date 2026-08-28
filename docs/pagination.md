# Подгрузка

Пороги достижения начала и конца списка.

## Базовое использование

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

Порог `0.5` означает «за половину экрана до кромки». Подгрузка обязана начаться
заранее — иначе пользователь упрётся в конец и увидит пустоту.

Колбэк получает текущее расстояние:

```tsx
onEndReached={({ distanceFromEnd }) => {
  console.log(`до конца ${Math.round(distanceFromEnd)}px`);
  loadNewer();
}}
```

## Гарантии

### Один раз на жест

Порог срабатывает ровно один раз за жест: пока пользователь не оторвал палец и не
двинулся в другую сторону, повторно колбэк не вызывается. Сеть на каждое событие
скролла не рассчитана.

Это значит, что **свой флаг «уже гружу» всё равно нужен** — жест может
закончиться и начаться снова раньше, чем придёт ответ:

```tsx
const handleStartReached = useCallback(() => {
  if (loading || reachedOldest) return;

  setLoading(true);
  loadOlder().finally(() => setLoading(false));
}, [loading, reachedOldest]);
```

### Гистерезис у границы

Выход за порог засчитывается с запасом (1.3×). Без него достаточно дрогнуть на
границе порога, чтобы защёлка снялась и подгрузка ушла повторно.

Кромка, достигнутая точно, не покидается никогда: стоять у самого конца короткого
контента и «выйти за порог» нельзя.

### Одна кромка на жест

На коротком контенте начало и конец одновременно оказываются в пороговой зоне, и
подгрузка вверх и вниз выстреливают вместе. Пользователь при этом двигался в одну
сторону — вторая подгрузка ему не нужна.

После срабатывания одной кромки вторая молчит до нового жеста, а **направление
жеста** решает, какая из них разблокируется. Гейт открывается сам, когда обе
кромки далеко за порогами: держать его закрытым посреди списка не от чего.

### Пороги молчат во время программного скролла

Пока идёт начальный скролл (`initialScroll`), программный скролл или
автоприлипание к концу, пороги не проверяются. Иначе открытие списка у конца сразу
вызывало бы подгрузку.

## Расстояния

`distanceFromEnd` считается **без отступа конца**: распорка `anchoredEndSpace` и
распорка `alignItemsAtEnd` в него не входят. Иначе подгрузка срабатывала бы на
пустом месте, приняв распорку за непрочитанный контент.

Те же расстояния доступны непрерывно, а не только в момент срабатывания:

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

Сигналы кромок обновляются **всегда**, даже когда колбэки подавлены: подавление
касается вызовов наружу, а состояние списка от этого не перестаёт быть правдой.

См. [Состояние списка](state.md#кромки).

## Спиннеры

Спиннер — обычная строка данных. Так он участвует в раскладке, и высота под него
резервируется честно:

```tsx
const data = useMemo(() => {
  const rows: ChatRow[] = [...messages];

  if (loadingStart) rows.unshift({ type: "spinner", key: "spinner-start" });
  if (loadingEnd) rows.push({ type: "spinner", key: "spinner-end" });

  return rows;
}, [messages, loadingStart, loadingEnd]);
```

Три вещи, которые при этом придётся не забыть:

**1. Ключ спиннера постоянный.** Он появляется и исчезает — но пока он есть, он
один и тот же элемент.

**2. Высота спиннера объявлена.** Иначе на кадр появления он занимает оценочную
высоту, а рисуется своей:

```tsx
getFixedItemSize={row => (row.type === "spinner" ? 56 : undefined)}
```

**3. Индексы прилипания сдвинулись.** Спиннер сверху сдвигает всё под собой:

```tsx
const dayIndices = useMemo(
  () => (loadingStart ? indices.map(index => index + 1) : indices),
  [indices, loadingStart],
);
```

Альтернатива — `ListHeaderComponent` и `ListFooterComponent`: спиннер не попадает
в данные и индексы не двигает, но и в раскладку элементов не входит, а
удерживается компенсацией как часть шапки.

## Подгрузка вверх

Это тот случай, ради которого нужно удержание позиции. Список вырастает выше
вьюпорта, и без компенсации контент уезжает вниз на высоту добавленного:

```tsx
<AnchorList
  onStartReached={loadOlder}
  maintainVisibleContentPosition={{ data: true, size: true }}
/>
```

Разбор — [Удержание позиции](maintain-position.md).

## Конец данных

Список не знает, кончились ли данные, — это знаете только вы:

```tsx
const handleStartReached = useCallback(() => {
  if (loading || !hasMoreOlder) return;
  // ...
}, [loading, hasMoreOlder]);
```

Порог продолжит срабатывать на каждом жесте у кромки; отсекать нужно самому.

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
кромках, удержание позиции отключается тумблером — видно, что происходит без него.
