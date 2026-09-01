# Прилипание

Якоря, останавливающиеся у кромки вьюпорта: заголовки дат сверху, аватары групп
снизу, обе кромки одновременно.

## Конфигурация

```ts
interface IAnchorListStickyConfig<TItem = unknown> {
  edge: "start" | "end";
  indices: number[];
  offset?: SharedValue<number>;
  mode?: "container" | "offset";
  size?: number;
  groupStarts?: number[];
  limitInset?: number;
  renderOverlay?: (item: TItem, index: number) => ReactNode;
}
```

`sticky` — массив таких наборов. **На каждой кромке — не более одного набора.**

```tsx
const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [{ edge: "start", indices: dayIndices }],
  [dayIndices],
);

<AnchorList sticky={sticky} ... />;
```

Массив и объекты внутри сравниваются по ссылке — мемоизируйте.

## Индексы

`indices` — индексы якорных строк в **текущих** данных, **по возрастанию**.

Считает их тот, кто строит данные. Спиннер сверху сдвигает все индексы на
единицу:

```tsx
const dayIndices = useMemo(
  () => (loadingStart ? indices.map(index => index + 1) : indices),
  [indices, loadingStart],
);
```

## Отступ кромки

`offset` — отступ от кромки: навбар сверху, панель ввода, клавиатура и
безопасная зона снизу. Тип — shared value, чтобы якорь ехал вместе с клавиатурой
в один кадр.

**У конечной кромки можно не задавать:** подставится
[`insetEnd`](props.md#insetend-sharedvaluenumber) списка. Свой `offset`
приоритетнее.

У начальной кромки умолчания нет.

```tsx
const topOffset = useSharedValue(0);

topOffset.value = navbarHeight;
```

---

## Режим `container`

По умолчанию. Прилипает вся строка целиком.

```tsx
const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [{ edge: "start", indices: dayIndices, offset: topOffset }],
  [dayIndices, topOffset],
);
```

Прилипшая копия по умолчанию берётся из `renderItem`.

### Поведение якоря

У начальной кромки якорь сдвигается вниз ровно настолько, насколько кромка его
обогнала, и упирается в **предел** — точку, где подъезжающий снизу следующий
якорь выталкивает его за кромку.

У конечной кромки зеркально: якорь поднимается, когда его низ уходит ниже кромки,
и не поднимается выше начала своей группы.

Предел считается из геометрии соседей и от позиции скролла не зависит.

---

## Режим `offset`

Строка остаётся на месте, прилипает **объект внутри неё**.

```tsx
const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [
    {
      edge: "end",
      indices: avatarIndices,
      offset: bottomOffset,
      mode: "offset",
      size: AVATAR_SIZE,
      groupStarts,
      limitInset: MESSAGE_GAP,
      renderOverlay: item => <PinnedAvatar row={item} />,
    },
  ],
  [avatarIndices, groupStarts, bottomOffset],
);
```

Смещение приходит в `renderItem` shared value — ячейка применяет его к нужному
узлу:

```tsx
const renderItem = useCallback(
  ({ item, stickyOffset, stickyPinned }: IAnchorListRenderItemProps<ChatRow>) => (
    <ChatRow row={item} stickyOffset={stickyOffset} stickyPinned={stickyPinned} />
  ),
  [],
);
```

```tsx
const style = useAnimatedStyle(() => ({
  opacity: stickyPinned?.value ? 0 : 1,
  transform: [{ translateY: stickyOffset?.value ?? 0 }],
}));

<Animated.View style={style}>
  <Avatar name={row.author} />
</Animated.View>;
```

### `size`

Высота прилипающего объекта, а не всей строки: от неё зависит, докуда объект
поднимается. По умолчанию берётся высота строки.

### `groupStarts`

Индекс первой строки группы для каждого якоря — **параллельно `indices`**, той же
длины и в том же порядке. Задаёт границу, выше которой объект не поднимается. Без
него границей считается строка сразу за предыдущим якорем.

```tsx
// indices:     [3, 7, 12]  — хвосты групп, где рисуется аватар
// groupStarts: [1, 5,  9]  — первые сообщения тех же групп
```

### `limitInset`

Сдвиг верхней границы группы вниз, px. Нужен, когда зазор между строками задан
отступом внутри них: если у пузыря сообщения `marginTop: 8` — `limitInset: 8`.

### `renderOverlay`

В режиме `offset` **обязателен**: у кромки стоит не строка, а объект внутри неё.
Горизонтальные отступы копии обязаны повторять слот объекта в строке.

```tsx
const PinnedAvatar = ({ row }) => (
  // paddingLeft и width повторяют слот аватара в ChatRow
  <View style={{ paddingLeft: 12, width: 56 }}>
    <Avatar name={row.author} size={36} />
  </View>
);
```

В режиме `container` необязателен.

---

## Слой прилипших копий

У прилипания три состояния:

| Состояние | Трансформ | Кто везёт элемент |
| --- | --- | --- |
| Якорь ещё не доехал до кромки | Постоянен (`0`) | Нативный скролл |
| Якорь стоит у кромки | Меняется каждый кадр | Покадровая компенсация |
| Якорь выталкивается следующим | Постоянен (упёрся в предел) | Нативный скролл |

Среднее состояние рисует отдельный слой поверх списка — снаружи `ScrollView`, на
постоянной позиции. Копия внутри контента в этот момент прячется, оставаясь на
месте для касаний.

`stickyPinned` означает «слой уже нарисовал копию». Прятать свою нужно
**прозрачностью, а не размонтированием** — иначе поедет раскладка строки и
пропадут касания:

```tsx
opacity: stickyPinned?.value ? 0 : 1  // да
{!stickyPinned?.value && <Avatar />}  // нет
```

Сверка идёт по факту отрисовки слоем, а не по факту доезда до кромки.

---

## Активный якорь наружу

```tsx
const activeStickyStartIndex = useSharedValue(-1);

<AnchorList
  sticky={sticky}
  sharedValues={useMemo(
    () => ({ activeStickyStartIndex }),
    [activeStickyStartIndex],
  )}
/>;
```

`-1` — якорей нет. То же доступно через `state`:
`useAnchorListValue(state, "activeStickyStartIndex")`.

---

## Стоимость

Прилипающий элемент оборачивается в компонент с мапперами Reanimated, обычный —
в простую `View`.

Соседей активного якоря список держит смонтированными по обе стороны, даже за
пределами видимого диапазона.

Цена прилипания на проходе — строка `стики` встроенного замера.

## Если что-то идёт не так

Прилипание считается в трёх местах: ядро, привязка контейнера, worklet. Все три
печатает диагностика:
[Симптомы](troubleshooting.md#прилипание-ведёт-себя-странно-а-причина-не-видна).

## Проверить руками

Стенд «Прилипание» в [`example/`](../example): даты у верхней кромки и аватарки
групп у нижней, оба режима одновременно, каждый отключается тумблером.

## Дальше

- [Отрисовка строк](rendering.md) — где взять `stickyOffset` и `stickyPinned`
- [Отступы и клавиатура](insets.md) — что передавать в `offset`
