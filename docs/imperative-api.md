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
которых работает `contentOffset` нативного скролла. Высота шапки в них входит.

---

## Скролл

### `scrollToIndex`

```ts
scrollToIndex(params: {
  index: number;
  animated?: boolean;
  viewPosition?: number;
  viewOffset?: number;
}): void
```

Скролл к элементу по индексу.

| Параметр | Что делает |
| --- | --- |
| `index` | Индекс в текущих данных |
| `animated` | Доводить анимацией |
| `viewPosition` | Куда прижать элемент во вьюпорте: `0` — к началу, `1` — к концу, `0.5` — по центру |
| `viewOffset` | Поправка в пикселях поверх `viewPosition` |

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
}): boolean
```

Скролл к элементу по ключу. Возвращает `false`, если элемента с таким ключом в
данных нет.

Ключ переживает вставки и удаления, а индекс — нет: после подгрузки сверху тот же
элемент лежит на другом индексе. Для перехода к сообщению, сохранённому раньше,
это единственный правильный способ.

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

Скролл к концу контента — вместе с подвалом и распорками. Именно к концу
контента, а не к последнему элементу: если в подвале лежит распорка под панель
ввода, последняя строка окажется над панелью, а не под ней.

Если при первом переезде виртуализация уточнила размеры только что
смонтированных последних строк, список автоматически повторяет доводку до новой
границы. Повторно вызывать `scrollToEnd` вручную не нужно; жест пользователя
отменяет ожидающую доводку.

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

Полная высота контента: элементы плюс шапка, подвал и распорки.

### `getScrollLength`

```ts
getScrollLength(): number
```

Размер вьюпорта вдоль оси скролла.

### `getVelocity`

```ts
getVelocity(): number
```

Скорость скролла, px/мс. Положительная — к концу списка.

Считается по недавней истории смещений, а не по последнему кадру: одиночная
дельта слишком шумная, чтобы по ней что-то решать.

---

## Когда ref, а когда состояние

`IAnchorListRef` отвечает на вопрос «как дела прямо сейчас» — по запросу, в
момент вызова. Он не уведомляет об изменениях.

Если значение нужно **следить**, а не спросить один раз:

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

## Полный пример: сохранение и восстановление позиции

```tsx
const savePosition = useCallback(() => {
  const list = listRef.current;

  if (!list) return;

  const topIndex = list.getVisibleRange().start;
  const position = list.getPositionAtIndex(topIndex);
  const row = data[topIndex];

  if (position === undefined || !row) return;

  // Смещение со знаком: отрицательное означает, что строка уходит за кромку —
  // именно оно возвращает её ровно тем же куском, каким она была.
  storage.write({
    key: keyExtractor(row),
    offset: position - list.getScrollOffset(),
  });
}, [data]);
```

Восстанавливается это уже пропом `initialScroll`, а не методом ref: скролл нужен
к первому кадру, а не после монтирования — см.
[Скролл и позиционирование](scrolling.md#стартовая-позиция).
