# Императивный API

Всё, что нельзя выразить пропами: разовый скролл и вопросы о текущей геометрии.

```tsx
import type { IAnchorListRef } from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import { useRef } from "react";

const listRef = useRef<IAnchorListRef>(null);

<AnchorList ref={listRef} ... />;

listRef.current?.scrollToIndex({ index: 42, animated: true });
```

**Координаты.** Позиции и размеры отдаются в координатах контента — тех же, в
которых работает `contentOffset` нативного скролла. Размер шапки в них входит.

---

## Скролл

### `scrollToIndex`

```ts
scrollToIndex(params: {
  index: number;
  animated?: boolean;
  viewPosition?: number;
  viewOffset?: number;
  highlight?: boolean | { duration?: number; fade?: number };
}): void
```

Скролл к элементу по индексу.

| Параметр | Что делает |
| --- | --- |
| `index` | Индекс в текущих данных |
| `animated` | Доводить анимацией |
| `viewPosition` | Куда прижать элемент во вьюпорте: `0` — к началу, `1` — к концу, `0.5` — по центру |
| `viewOffset` | Поправка в пикселях поверх `viewPosition` |
| `highlight` | Подсветить элемент, когда он окажется в кадре — см. [Подсветка](#подсветка) |

```tsx
// Элемент встаёт у верхней кромки, на 12px ниже неё.
listRef.current?.scrollToIndex({ index: 42, viewPosition: 0, viewOffset: 12 });

// Элемент по центру экрана.
listRef.current?.scrollToIndex({ index: 42, viewPosition: 0.5, animated: true });
```

Если элемент ещё не измерен, его позиция оценочная — скролл придёт примерно
туда. Для точного попадания в дальнюю строку задавайте её размер через
`getFixedItemSize`.

### `scrollToKey`

```ts
scrollToKey(params: {
  key: string;
  animated?: boolean;
  viewPosition?: number;
  viewOffset?: number;
  highlight?: boolean | { duration?: number; fade?: number };
}): boolean
```

Скролл к элементу по ключу. Возвращает `false`, если элемента с таким ключом в
данных нет.

Ключ переживает вставки и удаления, индекс — нет: после подгрузки сверху тот же
элемент лежит на другом индексе.

```tsx
const found = listRef.current?.scrollToKey({
  key: quotedMessageId,
  viewPosition: 0,
  animated: true,
});

if (!found) loadContextAround(quotedMessageId);
```

### `scrollToOffset`

```ts
scrollToOffset(params: { offset: number; animated?: boolean }): void
```

Скролл к прямому смещению в координатах контента.

### `scrollToEnd`

```ts
scrollToEnd(params?: { animated?: boolean }): void
```

Скролл к концу контента — вместе с подвалом и распорками, а не к последнему
элементу.

Если измерения последних строк сдвинули границу, список повторяет доводку сам.
Жест пользователя отменяет ожидающую доводку.

---

## Подсветка

Переход к цитате без подсветки — прыжок, после которого пользователь ищет
глазами, куда его привели. `highlight` у `scrollToIndex` и `scrollToKey`
подсвечивает цель; как подсветка выглядит, решает сама строка.

```tsx
// Список: перейти и подсветить.
listRef.current?.scrollToKey({ key, animated: true, highlight: true });
listRef.current?.scrollToKey({ key, highlight: { duration: 2000, fade: 300 } });

// Строка: как именно подсветиться.
const MessageRow = ({ row }: { row: ChatRow }) => {
  const { progress } = useAnchorListItemHighlight();

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [BASE, ACCENT]),
  }));

  return <Animated.View style={style}>…</Animated.View>;
};
```

| Параметр | По умолчанию | Что делает |
| --- | --- | --- |
| `duration` | `1200` | Сколько держать подсветку после появления, мс |
| `fade` | `200` | Плавность появления и угасания, мс |

**Момент.** Подсветка ждёт, пока строка не окажется в видимой части экрана, а
не момента вызова: на анимированном переезде она иначе угасла бы раньше, чем
строка доехала. Строка, которая уже на экране, загорается сразу. Жест
пользователя во время переезда отменяет ожидающую подсветку — цели он уже не
увидит; горящую жест не трогает.

**Строка.** `useAnchorListItemHighlight()` внутри компонента, который вернул
`renderItem`, отдаёт `progress` — shared value 0…1 для `useAnimatedStyle` — и
`isHighlighted` для стилей в React. Подписка адресная: чужая подсветка строку
не будит. Смена ключа под тем же контейнером гасит подсветку — она адресована
строке, а не месту.

Та же подсветка у [стартовой позиции](scrolling.md#стартовая-позиция): открыть
переписку на непрочитанном и показать его — `initialScroll: { type: "key",
key, highlight: true }`.

### `highlightKey`

```ts
highlightKey(key: string, options?: { duration?: number; fade?: number }): boolean
```

Подсветить строку без перехода к ней: ответ на своё сообщение уже в кадре,
или к строке перешли своими средствами. Строка на экране загорается сразу, за
кадром — когда доедет. Возвращает `false`, если ключа нет в данных.

### `clearHighlight`

```ts
clearHighlight(): void
```

Погасить горящую подсветку и забыть ожидающую.

---

## Геометрия элементов

### `getPositionAtIndex`

```ts
getPositionAtIndex(index: number): number | undefined
```

Позиция элемента в координатах контента. `undefined` — индекс вне данных.

### `getSizeAtIndex`

```ts
getSizeAtIndex(index: number): number | undefined
```

Размер элемента. **До измерения это оценка, а не факт** — проверить, измерена ли
строка, снаружи нельзя.

### `getPositionByKey`

```ts
getPositionByKey(key: string): number | undefined
```

Позиция элемента по ключу. `undefined` — ключа нет в данных.

### `getIndexByKey`

```ts
getIndexByKey(key: string): number | undefined
```

Индекс элемента по ключу. `undefined` — ключа нет в данных.

### `getScrollAnchor`

```ts
getScrollAnchor(): { key: string; offset: number } | undefined
```

Снимок позиции для восстановления: ключ строки, пересекающей начальную кромку,
и смещение её начала от кромки. Отрицательное смещение — строка уходит за
кромку; именно оно вернёт её тем же куском. `undefined` — видимых строк нет.

Снимок передаётся обратно как `initialScroll: { type: "key", key, viewOffset:
offset }`. Ключ переживает подгрузку истории и перезагрузку данных, поэтому
снимок годится и после того, как индексы уехали.

Снимается по последнему обработанному событию скролла: во время инерции он
может отставать на шаг `scrollThrottleDistance`. Снимайте его, когда список
стоит, — в `onScrollEndDrag` и по смене видимого диапазона.

---

## Состояние скролла

### `getVisibleRange`

```ts
getVisibleRange(): {
  start: number;
  end: number;
  startBuffered: number;
  endBuffered: number;
}
```

Текущий видимый диапазон и его буферизованные границы.

| Поле | Что это |
| --- | --- |
| `start` / `end` | Первый и последний элементы, пересёкшие вьюпорт |
| `startBuffered` / `endBuffered` | Границы диапазона отрисовки: сюда входит `drawDistance` и запас по скорости |

На пустом списке `end < start`.

Это не то же, что видимость из `viewabilityPairs`: здесь достаточно любого
пересечения с вьюпортом, там — проход через заданный порог.

### `getScrollOffset`

```ts
getScrollOffset(): number
```

Смещение скролла в координатах контента.

### `getContentSize`

```ts
getContentSize(): number
```

Полная длина контента вдоль оси: элементы плюс шапка, подвал и распорки.

### `getScrollLength`

```ts
getScrollLength(): number
```

Размер вьюпорта вдоль оси скролла.

### `getVelocity`

```ts
getVelocity(): number
```

Скорость скролла, px/мс. Положительная — к концу списка. Считается по недавней
истории смещений, а не по последнему кадру.

---

## Когда ref, а когда состояние

`IAnchorListRef` отвечает по запросу, в момент вызова, и не уведомляет об
изменениях. Если за значением нужно следить:

- для анимаций — [`sharedValues`](state.md#sharedvalues);
- для React — [`state` и `useAnchorListValue`](state.md#state).

```tsx
// нет: значение устареет к следующему кадру
const offset = listRef.current?.getScrollOffset();

// да, для анимации
const scrollOffset = useSharedValue(0);
<AnchorList sharedValues={{ scrollOffset }} />;

// да, для React
const state = useAnchorListState();
const firstVisible = useAnchorListValue(state, "firstVisibleIndex");
```

## Пример: снимок позиции для восстановления

`getScrollAnchor` даёт ключ строки у кромки и её смещение. Восстанавливается
позиция пропом `initialScroll` типа `key`, а не методом ref: скролл нужен к
первому кадру. Полный код — [Рецепты](recipes.md#восстановление-позиции).
