# Видимость элементов

Отметка о прочтении, догрузка картинки, запуск видео — по факту того, что элемент
на экране.

## Использование

```tsx
const viewabilityPairs = useMemo<IAnchorListViewabilityPair<IMessage>[]>(
  () => [
    {
      config: { itemVisiblePercentThreshold: 50, minimumViewTime: 300 },
      onViewableItemsChanged: ({ viewableItems, changed }) => {
        for (const token of changed) {
          if (token.isViewable) markRead(token.item.id);
        }
      },
    },
  ],
  [markRead],
);

<AnchorList viewabilityPairs={viewabilityPairs} ... />;
```

Массив и объекты внутри сравниваются по ссылке — мемоизируйте. Пара, выбывшая из
массива, снимает свои ожидающие таймеры.

## Типы

```ts
interface IAnchorListViewabilityPair<TItem> {
  config: IAnchorListViewabilityConfig;
  onViewableItemsChanged: (info: IAnchorListViewabilityCallbackInfo<TItem>) => void;
}

interface IAnchorListViewabilityConfig {
  id?: string;
  itemVisiblePercentThreshold?: number;
  viewAreaCoveragePercentThreshold?: number;
  minimumViewTime?: number;
}

interface IAnchorListViewabilityCallbackInfo<TItem> {
  viewableItems: IAnchorListViewToken<TItem>[];
  changed: IAnchorListViewToken<TItem>[];
}

interface IAnchorListViewToken<TItem> {
  item: TItem;
  key: string;
  index: number;
  isViewable: boolean;
}
```

| Поле события | Что в нём |
| --- | --- |
| `viewableItems` | **Все** элементы, проходящие порог сейчас |
| `changed` | Только те, у кого видимость изменилась с прошлого события |

## Два вида порогов

### `itemVisiblePercentThreshold`

Доля **самого элемента**, попавшая во вьюпорт.

```tsx
config: { itemVisiblePercentThreshold: 50 }  // видно половину строки
```

Для ячейки крупнее экрана этот порог недостижим.

### `viewAreaCoveragePercentThreshold`

Доля **вьюпорта**, занятая элементом — вариант для крупных ячеек.

```tsx
config: { viewAreaCoveragePercentThreshold: 60 }  // элемент занял 60% экрана
```

### Приоритет

Если заданы оба, работает `viewAreaCoveragePercentThreshold`. Если не задан ни
один — порог `0`, видимым считается любое пересечение с вьюпортом.

## `minimumViewTime`

Сколько элемент должен пробыть видимым, мс.

```tsx
config: { itemVisiblePercentThreshold: 50, minimumViewTime: 500 }
```

Элемент, ушедший до истечения выдержки, в колбэк не попадает: таймер снимается.
Выдержка — условие появления, а не исчезновения: об уходе элемента сообщается
сразу.

## Несколько наборов

```tsx
const viewabilityPairs = useMemo<IAnchorListViewabilityPair<IPost>[]>(
  () => [
    {
      // Прочитано: половина карточки, полсекунды.
      config: {
        id: "read",
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 500,
      },
      onViewableItemsChanged: handleRead,
    },
    {
      // Автоплей: видео заняло большую часть экрана.
      config: { id: "autoplay", viewAreaCoveragePercentThreshold: 70 },
      onViewableItemsChanged: handleAutoplay,
    },
  ],
  [handleRead, handleAutoplay],
);
```

Каждая пара ведётся отдельно: один элемент может быть видимым по одному порогу и
невидимым по другому. `id` — имя набора для логов, на поведение не влияет.

## Что не является видимостью

**Диапазон отрисовки.** `getVisibleRange()` и сигналы `firstVisibleIndex` /
`lastVisibleIndex` отвечают на вопрос «какие элементы пересекают вьюпорт» —
достаточно одного пикселя, порог не применяется.

**Буферизованный диапазон.** `startBuffered` / `endBuffered` — смонтированные
строки, включая запас за пределами экрана.

Видимость считается только внутри буферизованного диапазона.

## Стоимость

Без единой пары видимость не считается. С парами пересчёт идёт при каждом сдвиге
диапазона, колбэк вызывается только при смене набора видимых.

## Ограничения

**Элемент, исчезнувший из данных, в токен не попадает** — ни в `changed`, ни в
`viewableItems`.

**Таймеры выдержки снимаются при размонтировании списка.**

## Проверить руками

Стенд «Состояние списка» в [`example/`](../example) показывает счётчик элементов,
проходящих порог, рядом с видимым диапазоном.
