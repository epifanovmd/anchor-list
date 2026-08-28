# Видимость элементов

Отметить сообщение прочитанным, догрузить картинку, запустить видео — всё это
привязано к тому, что элемент действительно на экране.

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

Обычно нужен `changed`: он отвечает на вопрос «что произошло», а `viewableItems` —
на «как сейчас».

## Два вида порогов

«Элемент виден» — не одно условие, а два разных, и выбор между ними зависит от
размера ячейки.

### `itemVisiblePercentThreshold`

Доля **самого элемента**, попавшая во вьюпорт. Годится для обычных строк.

```tsx
config: { itemVisiblePercentThreshold: 50 }  // видно половину строки
```

Для крупной ячейки, не помещающейся в экран целиком, этот порог недостижим в
принципе: сколько её ни показывай, 100 % не наберётся.

### `viewAreaCoveragePercentThreshold`

Доля **вьюпорта**, занятая элементом. Для крупных ячеек — единственный рабочий
вариант.

```tsx
config: { viewAreaCoveragePercentThreshold: 60 }  // элемент занял 60% экрана
```

### Приоритет

Заданный порог покрытия имеет приоритет: если указаны оба, работает
`viewAreaCoveragePercentThreshold`. Если не задан ни один — порогом считается `0`,
то есть видимым признаётся любое пересечение с вьюпортом.

## `minimumViewTime`

Сколько элемент должен пробыть видимым, мс. Отсекает элементы, мелькнувшие при
быстром скролле.

```tsx
config: { itemVisiblePercentThreshold: 50, minimumViewTime: 500 }
```

Если элемент ушёл до истечения выдержки — таймер снимается, и колбэка не будет
вовсе.

**Выдержка — условие появления, а не исчезновения.** Об уходе элемента
сообщается сразу, без ожидания.

## Несколько наборов

Аналитике и автовоспроизведению нужны разные пороги на одном и том же списке:

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

Каждая пара ведётся отдельно: один и тот же элемент может быть видимым по одному
порогу и невидимым по другому. `id` — имя набора, с ним удобнее различать события
в логах; на поведение оно не влияет.

## Что не является видимостью

**Диапазон отрисовки.** `getVisibleRange()` и сигналы `firstVisibleIndex` /
`lastVisibleIndex` отвечают на вопрос «какие элементы пересекают вьюпорт» —
достаточно одного пикселя. Порог там не применяется.

**Буферизованный диапазон.** `startBuffered` / `endBuffered` — это смонтированные
строки, включая запас за пределами экрана. Пользователь их не видит.

Видимость считается **только** внутри буферизованного диапазона: за его пределами
элементы не смонтированы и видимыми быть не могут по определению.

## Стоимость

Без единой пары видимость не считается вовсе — проп можно смело не передавать.

С парами пересчёт идёт при каждом сдвиге диапазона, но колбэк наружу вызывается
только когда набор видимых элементов реально стал другим. События «состояние на
каждом кадре» здесь нет.

## Ограничения

**Элемент, исчезнувший из данных, в токен не попадает.** Если между пересчётом и
колбэком элемент удалён, токена для него не будет — ни в `changed`, ни в
`viewableItems`.

**Таймеры выдержки снимаются при размонтировании списка.** Отложенные события не
доедут.

## Проверить руками

Стенд «Состояние списка» в [`example/`](../example) показывает счётчик элементов,
проходящих порог, рядом с видимым диапазоном — разницу между ними видно сразу.
