# Состояние списка

Список отдаёт состояние двумя способами. Значения одни и те же, разница — где
они оказываются.

| | `sharedValues` | `state` + `useAnchorListValue` |
| --- | --- | --- |
| Где живёт | UI-поток | JS-поток, React |
| Стоимость обновления | Запись в shared value | Рендер подписанного компонента |
| Для чего | Анимации, трансформы, непрерывные величины | Число на экране, флаг в пропе, ветка в разметке |
| Читается снаружи списка | Да | Да |
| Частота | Каждый кадр скролла | Каждое изменение значения |

Значение в анимацию — `sharedValues`, в разметку — `state`.

---

## `sharedValues`

Передайте объект с нужными полями: список публикует только запрошенное.

```tsx
import { useSharedValue, useAnimatedStyle } from "react-native-reanimated";

const scrollOffset = useSharedValue(0);
const isNearEnd = useSharedValue(false);

const sharedValues = useMemo(
  () => ({ scrollOffset, isNearEnd }),
  [scrollOffset, isNearEnd],
);

const shadowStyle = useAnimatedStyle(() => ({
  opacity: Math.min(1, scrollOffset.value / 24),
}));

<AnchorList sharedValues={sharedValues} ... />;
<Animated.View style={[styles.navbarShadow, shadowStyle]} />;
```

Объект сравнивается по ссылке — мемоизируйте.

### Скролл и жест

| Поле | Тип | Что это |
| --- | --- | --- |
| `scrollOffset` | `number` | Смещение скролла в координатах контента |
| `isDragging` | `boolean` | Палец на экране: позицией управляет жест |
| `isMomentum` | `boolean` | Идёт инерция после броска |
| `velocity` | `number` | Скорость скролла, px/мс; положительная — к концу списка |

«Список движется» — это `isDragging || isMomentum`. Отдельного признака нет:
программный скролл не порождает ни того, ни другого.

`velocity` сглажена по недавней истории смещений: на резком броске отстаёт
примерно на три кадра и пика не достигает, а после остановки возвращается к нулю
через десятые доли секунды. Момент отрыва пальца — это `isDragging`.

### Что обновляется покадрово, а что ступенями

| Значения | В `sharedValues` | В `state` |
| --- | --- | --- |
| `scrollOffset`, `isDragging`, `isMomentum` | каждый кадр | — |
| Расстояния до кромок и все флаги кромок | каждый кадр | ступенями |
| Размеры, распорки, `readyToRender` | на раскладке | на раскладке |
| `velocity`, видимый диапазон, активные якоря | ступенями | ступенями |

«Ступенями» — по мере того, как пересчёт уходит в JS, шагами по
[`scrollThrottleDistance`](props.md#scrollthrottledistance-number). У кромок контента шаг
не применяется.

Видимый диапазон и активные якоря считаются проходом по позициям строк, поэтому
непрерывными не бывают ни в одном канале.

### Размеры

| Поле | Тип | Что это |
| --- | --- | --- |
| `totalSize` | `number` | Суммарный размер элементов вдоль оси, без шапки, подвала и распорок |
| `contentSize` | `number` | Полная длина контента вдоль оси: элементы плюс шапка, подвал и распорки |
| `maxScroll` | `number` | Граница скролла: `contentSize - scrollLength`, но не меньше нуля |
| `scrollLength` | `number` | Размер вьюпорта вдоль оси скролла |
| `scrollSize` | `{ width, height }` | Размер вьюпорта целиком |
| `headerSize` | `number` | Размер шапки вдоль оси |
| `footerSize` | `number` | Размер подвала вдоль оси |
| `anchoredEndSpaceSize` | `number` | Распорка у конца |

Прогресс прокрутки — `scrollOffset / maxScroll`:

```tsx
const progressStyle = useAnimatedStyle(() => ({
  width: `${
    maxScroll.value > 0
      ? Math.min(100, (scrollOffset.value / maxScroll.value) * 100)
      : 0
  }%`,
}));
```

### Готовность

| Поле | Тип | Что это |
| --- | --- | --- |
| `readyToRender` | `boolean` | Список отрисовал стартовый кадр и применил начальный скролл |

### Кромки

| Поле | Тип | Что это |
| --- | --- | --- |
| `isAtStart` | `boolean` | Скролл упёрся в начало контента |
| `isAtEnd` | `boolean` | Скролл упёрся в конец контента |
| `isNearStart` | `boolean` | Начало в пределах `onStartReachedThreshold` |
| `isNearEnd` | `boolean` | Конец в пределах `onEndReachedThreshold` |
| `isWithinMaintainScrollAtEndThreshold` | `boolean` | Конец в пределах `maintainScrollAtEndThreshold` |
| `distanceFromStart` | `number` | Расстояние до начала контента |
| `distanceFromEnd` | `number` | Расстояние до конца контента, **без** учёта отступа конца |

Порог автоприлипания отдельный от порогов подгрузки.

Если контент короче вьюпорта, `isAtEnd`, `isNearEnd` и
`isWithinMaintainScrollAtEndThreshold` истинны при любом смещении.

### Видимый диапазон

| Поле | Тип | Что это |
| --- | --- | --- |
| `firstVisibleIndex` | `number` | Первый элемент, пересёкший вьюпорт; `-1` — видимых нет |
| `lastVisibleIndex` | `number` | Последний элемент, пересёкший вьюпорт; `-1` — видимых нет |

### Прилипание

| Поле | Тип | Что это |
| --- | --- | --- |
| `activeStickyStartIndex` | `number` | Индекс активного якоря начальной кромки; `-1` — якорей нет |
| `activeStickyEndIndex` | `number` | Индекс активного якоря конечной кромки; `-1` — якорей нет |

---

## Видимость строки на UI-потоке

`sharedValues` — про список целиком. Строке о себе отвечает хук внутри ячейки:

```tsx
import { useAnchorListItemVisibility } from "@epifanovmd/anchor-list";

const MessageRow = ({ row }: { row: ChatRow }) => {
  // Доля строки во вьюпорте, 0…1, каждым кадром и без рендера.
  const visibility = useAnchorListItemVisibility();

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * visibility.value,
    transform: [{ scale: 0.94 + 0.06 * visibility.value }],
  }));

  return <Animated.View style={style}>…</Animated.View>;
};
```

| Что учитывается | Почему |
| --- | --- |
| Живое смещение скролла | Значение идёт в такт кадру, а не через JS |
| Шапка списка | Позиции строк считаются от нуля, смещение — от начала контента |
| `insetEnd` | Строка под панелью ввода или клавиатурой не видна, хотя и внутри `ScrollView` |
| Сдвиг прилипшего якоря | В режиме `container` якорь стоит не там, где лежит |
| Прижатие к концу | `alignItemsAtEnd` сдвигает короткий контент целиком |

Считается доля **самой строки**, а не вьюпорта: строка длиннее экрана целиком
видна не бывает, и порог для неё выбирают ниже. За отметкой «прочитано» и
автовоспроизведением по порогу с выдержкой по-прежнему идут к
[`viewabilityPairs`](viewability.md): они отвечают «да/нет» в JS и умеют
`minimumViewTime`. Хук — для непрерывных эффектов: параллакс, затухание у
кромок, прогресс просмотра.

**Цена** — один worklet на строку, где хук вызван. Вызывайте его в тех строках,
где эффект нужен, а не во всех подряд. Вызывать можно только внутри
компонента, который вернул `renderItem`, как и `useAnchorListItemState`: при
переработке контейнера значение само переключается на новую строку.

Рядом живёт `useAnchorListItemHighlight()` — прогресс подсветки строки после
перехода к ней, тоже shared value; см.
[Подсветка](imperative-api.md#подсветка).

---

## `state`

Те же значения в React.

```tsx
import { useAnchorListState, useAnchorListValue } from "@epifanovmd/anchor-list";

const Screen = () => {
  // Объект стабилен и создаётся один раз.
  const listState = useAnchorListState();

  return (
    <>
      <Header listState={listState} />
      <AnchorList state={listState} ... />
    </>
  );
};

// Компонент снаружи списка — и всё равно видит его состояние.
const Header = ({ listState }: { listState: AnchorListState }) => {
  const firstVisible = useAnchorListValue(listState, "firstVisibleIndex");

  return <Text>Строка {(firstVisible ?? 0) + 1}</Text>;
};
```

`AnchorListState` держит подписки до монтирования списка и перевешивает их на его
стор, когда тот появится. До этого значения — `undefined`.

### `useAnchorListValue(state, name)`

Возвращает `AnchorListSignalMap[name] | undefined`. Подписка адресная: рендер
происходит только при изменении именно этого значения.

```tsx
const isNearEnd = useAnchorListValue(listState, "isNearEnd");
const totalSize = useAnchorListValue(listState, "totalSize");
```

`undefined` означает «список ещё не смонтирован».

### Какие имена доступны

Те же, что в `sharedValues`, плюс внутренние. Тип имени —
`AnchorListSignalName`, тип карты значений — `AnchorListSignalMap`.

Доступны только здесь:

| Имя | Тип | Что это |
| --- | --- | --- |
| `numContainers` | `number` | Сколько контейнеров существует |
| `scrollAdjust` | `number` | Накопленная компенсация позиции |
| `contentOrigin` | `number` | Начало координат элементов внутри контента |
| `highlight` | `{ key, duration, fade, seq } \| null` | Горящая подсветка строки; строке её отдаёт `useAnchorListItemHighlight` |

Эти четыре внутренние и меняются вместе с реализацией.

`contentOrigin` — разница между координатами элементов (от нуля) и координатами
контента (в них работает смещение скролла): она равна размеру шапки.

---

## Что выбрать

| Задача | Откуда брать | Почему |
| --- | --- | --- |
| Кнопка «вниз» | `sharedValues.isWithinMaintainScrollAtEndThreshold` | Видимость меняется на скролле, рендер не нужен — [рецепт](recipes.md#кнопка-вниз) |
| Тень под навбаром | `sharedValues.distanceFromStart` | Величина непрерывная, идёт в `opacity` |
| Индикатор прокрутки | `sharedValues.scrollOffset` и `maxScroll` | Каждый кадр — [рецепт](recipes.md#индикатор-прокрутки) |
| Число на экране без рендеров | `sharedValues` + `animatedProps` | [Рецепт](recipes.md#живое-число-без-рендеров) |
| Затухание строк у кромок, параллакс | `useAnchorListItemVisibility` | Доля строки во вьюпорте каждым кадром, внутри ячейки |
| Счётчик непрочитанных в шапке | `state` | Значение идёт в текст, меняется редко |
| Спиннер до готовности списка | `state` + `readyToRender` | Флаг в разметке |

## Дальше

- [Видимость элементов](viewability.md) — пороги видимости вместо «что на экране»
- [Рецепты](recipes.md) — законченные примеры на shared values
