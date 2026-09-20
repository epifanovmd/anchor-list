# Прилипание

Строка, доехавшая до кромки вьюпорта, останавливается у неё и стоит, пока
следующая такая же строка её не вытолкнет. Заголовки дат сверху, аватар группы
снизу, обе кромки одновременно.

## Включение

```tsx
const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [{ edge: "start", indices: dayIndices }],
  [dayIndices],
);

<AnchorList sticky={sticky} ... />;
```

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

| Поле | Что задаёт |
| --- | --- |
| `edge` | Кромка: `start` — начало списка, `end` — конец |
| `indices` | Индексы прилипающих строк в текущих данных, по возрастанию |
| `offset` | Отступ от кромки: навбар сверху, панель ввода снизу |
| `mode` | Прилипает вся строка (`container`, по умолчанию) или объект внутри неё (`offset`) |
| `size`, `groupStarts`, `limitInset`, `renderOverlay` | Только для режима `offset`, см. ниже |

`sticky` — массив наборов, **не более одного на кромку**. Массив и объекты
внутри сравниваются по ссылке — мемоизируйте.

## Индексы

`indices` — индексы прилипающих строк в **текущих** данных, **по возрастанию**.
Считает их тот, кто строит данные. Если сверху появился спиннер, все индексы
сдвигаются на единицу:

```tsx
const dayIndices = useMemo(
  () => (loadingStart ? indices.map(index => index + 1) : indices),
  [indices, loadingStart],
);
```

Как собрать индексы из сообщений — [Рецепты](recipes.md#прилипающие-заголовки-дат).

## Отступ кромки

`offset` — расстояние от кромки вьюпорта, на котором останавливается якорь.
Сверху это навбар, снизу — панель ввода, клавиатура и безопасная зона. Тип —
shared value, чтобы якорь ехал вместе с клавиатурой в один кадр.

У конечной кромки `offset` можно не задавать: подставится
[`insetEnd`](insets.md) списка. У начальной кромки умолчания нет — высоту
навбара знает только вызывающий.

```tsx
const topOffset = useSharedValue(navbarHeight);

const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [{ edge: "start", indices: dayIndices, offset: topOffset }],
  [dayIndices, topOffset],
);
```

---

## Режим `container`

По умолчанию. Прилипает вся строка целиком, копия у кромки рисуется тем же
`renderItem`. Ничего сверх `edge`, `indices` и `offset` задавать не нужно.

У начальной кромки якорь останавливается у отступа и стоит, пока следующий
якорь, подъезжая снизу, не вытолкнет его за кромку. У конечной кромки —
зеркально: якорь останавливается у нижнего отступа и не поднимается выше начала
своей группы.

---

## Режим `offset`

Строка остаётся на месте, а прилипает **объект внутри неё** — например, аватар
в последнем сообщении группы, который должен стоять у нижней кромки, пока
группа не прокрутится.

```tsx
const sticky = useMemo<IAnchorListStickyConfig<ChatRow>[]>(
  () => [
    {
      edge: "end",
      indices: avatarIndices,
      mode: "offset",
      size: AVATAR_SIZE,
      groupStarts,
      renderOverlay: item => <PinnedAvatar row={item} />,
    },
  ],
  [avatarIndices, groupStarts],
);
```

Смещение приходит в `renderItem` shared value, и ячейка сама применяет его к
нужному узлу:

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

Высота прилипающего объекта, а не всей строки. От неё зависит, докуда объект
поднимается. По умолчанию берётся высота строки.

### `groupStarts`

Индекс первой строки группы для каждого якоря — параллельно `indices`, той же
длины и в том же порядке. Выше этой строки объект не поднимается. Без него
границей считается строка сразу за предыдущим якорем.

```tsx
// indices:     [3, 7, 12]  — хвосты групп, где рисуется аватар
// groupStarts: [1, 5,  9]  — первые сообщения тех же групп
```

### `limitInset`

Сдвиг верхней границы группы вниз, px. Нужен только когда зазор между строками
задан отступом **внутри** строки: если у пузыря сообщения `marginTop: 8`,
укажите `limitInset: 8`, иначе объект поднимется в этот зазор. С зазором на
уровне списка — [`gap`](props.md#gap-number) — границы группы и так совпадают
с краями пузырей, и проп не нужен.

### `renderOverlay`

В режиме `offset` **обязателен**: у кромки стоит не строка, а объект внутри неё,
и список не знает, как его нарисовать. Отступы копии поперёк оси должны
повторять слот объекта в строке — горизонтальные в вертикальном списке,
вертикальные при `horizontal`. Копия растянута на весь вьюпорт поперёк оси, как
и строка, поэтому выравнивание считается от тех же кромок.

```tsx
const PinnedAvatar = ({ row }) => (
  // paddingLeft и width повторяют слот аватара в ChatRow
  <View style={{ paddingLeft: 12, width: 56 }}>
    <Avatar name={row.author} size={36} />
  </View>
);
```

---

## Копия у кромки и `stickyPinned`

Пока якорь стоит у кромки, его рисует отдельный слой поверх списка, снаружи
`ScrollView`: так у стоящего якоря нет покадрового трансформа, и он не дрожит.
Оригинал внутри контента в этот момент нужно спрятать, оставив на месте для
касаний. `stickyPinned` означает «слой уже нарисовал копию».

Прятать оригинал нужно **прозрачностью, а не размонтированием** — иначе поедет
раскладка строки и пропадут касания:

```tsx
opacity: stickyPinned?.value ? 0 : 1  // да
{!stickyPinned?.value && <Avatar />}  // нет
```

В режиме `container` это происходит само: копию и оригинал рисует список.

---

## Активный якорь наружу

Индекс якоря, который сейчас стоит у кромки, отдаётся сигналом:

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

`-1` — якорей нет. То же в React:
`useAnchorListValue(state, "activeStickyEndIndex")`.

## Стоимость

Прилипающая строка оборачивается в компонент с мапперами Reanimated, обычная —
в простую `View`. Соседей активного якоря список держит смонтированными по обе
стороны, даже за пределами буфера. Цена на проходе видна в строке `стики`
встроенного [замера](performance.md#встроенный-замер).

## Если что-то идёт не так

[Симптомы](troubleshooting.md#прилипающие-заголовки-липнут-не-там): устаревшие
индексы, не заданный `renderOverlay`, аватар выше своей группы, копия не на
своём месте. Если причина не видна, диагностика печатает все три места, где
прилипание считается: `setAnchorListDebug("sticky")`.

## Проверить руками

Стенд «Прилипание» в [`example/`](../example): даты у верхней кромки и аватарки
групп у нижней, оба режима одновременно, каждый отключается тумблером. Стенд
«Прилипание по горизонтали» — то же на горизонтальной оси.

Как прилипание сделано внутри — [Механика](mechanics.md#6-прилипание).
