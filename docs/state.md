# Состояние списка

Список отдаёт своё состояние наружу двумя способами. Они дают одни и те же
значения и различаются только тем, где эти значения оказываются.

| | `sharedValues` | `state` + `useAnchorListValue` |
| --- | --- | --- |
| Где живёт | UI-поток | JS-поток, React |
| Стоимость обновления | Запись в shared value | Рендер подписанного компонента |
| Для чего | Анимации, трансформы, непрерывные величины | Число на экране, флаг в пропе, ветка в разметке |
| Читается снаружи списка | Да | Да |
| Частота | Каждый кадр скролла | Каждое изменение значения |

**Правило простое: если значение идёт в анимацию — `sharedValues`. Если в
разметку — `state`.** Смещение скролла через `state` — это рендер на каждый кадр
прокрутки, ровно та цена, которой список и старается избежать.

---

## `sharedValues`

Передайте объект с теми полями, которые нужны. Незаполненные поля не стоят
ничего: список публикует только то, что у него запросили.

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

Объект нужно мемоизировать: он сравнивается по ссылке.

### Скролл и жест

| Поле | Тип | Что это |
| --- | --- | --- |
| `scrollOffset` | `number` | Смещение скролла в координатах контента |
| `isDragging` | `boolean` | Палец на экране: позицией управляет жест |
| `isMomentum` | `boolean` | Идёт инерция после броска |
| `velocity` | `number` | Скорость скролла, px/мс; положительная — к концу списка |

«Список движется» — это `isDragging || isMomentum`. Отдельного признака нет
намеренно: программный скролл не порождает ни того, ни другого, и склеенный флаг
врал бы про него молча.

### Что обновляется покадрово, а что ступенями

Разница между каналами не только в рендерах, и её стоит знать заранее.

| Значения | В `sharedValues` | В `state` |
| --- | --- | --- |
| `scrollOffset`, `isDragging`, `isMomentum` | каждый кадр | — |
| Расстояния до кромок и все флаги кромок | каждый кадр | ступенями |
| Размеры, распорки, `readyToRender` | на раскладке | на раскладке |
| `velocity`, видимый диапазон, активные якоря | ступенями | ступенями |

«Ступенями» — значит по мере того, как пересчёт уходит в JS, а он идёт шагами по
[`scrollThrottleDistance`](props.md#scrollthrottledistance). У кромок контента шаг не
применяется, там обновление живое при любом значении.

Расстояния и флаги кромок считаются прямо на UI-потоке из смещения и геометрии
контента, поэтому в `sharedValues` они непрерывны — на них можно строить тень
под навбаром или свой скроллбар. В `state` те же величины приходят из сигналов и
потому ступенчаты: непрерывность там означала бы рендер на кадр, а это ровно то,
от чего второй канал и защищает.

Видимый диапазон и активные якоря непрерывными быть не могут в принципе: их не
получить без прохода по позициям строк.

`velocity` — величина сглаженная: она считается по недавней истории смещений, а
не по последнему кадру, потому что одиночная дельта слишком шумная, чтобы по ней
что-то решать. Отсюда два свойства, о которых стоит знать заранее. На резком
броске значение отстаёт от настоящей скорости примерно на три кадра и её пика не
достигает — подхватывать по нему момент отрыва пальца не стоит, для этого есть
`isDragging`.
А когда список встаёт, значение возвращается к нулю не мгновенно, а через
десятые доли секунды после последнего события: раньше о том, что движение
кончилось, узнать неоткуда.

### Размеры

| Поле | Тип | Что это |
| --- | --- | --- |
| `totalSize` | `number` | Суммарная высота элементов, без шапки, подвала и распорок |
| `contentSize` | `number` | Полная высота контента: элементы плюс шапка, подвал и распорки |
| `maxScroll` | `number` | Граница скролла: `contentSize - scrollLength`, но не меньше нуля |
| `scrollLength` | `number` | Размер вьюпорта вдоль оси скролла |
| `scrollSize` | `{ width, height }` | Размер вьюпорта целиком |
| `headerSize` | `number` | Высота шапки |
| `footerSize` | `number` | Высота подвала |
| `anchoredEndSpaceSize` | `number` | Распорка у конца, поднимающая якорный элемент к верхней кромке |

Прогресс прокрутки — это `scrollOffset / maxScroll`:

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

Порог автоприлипания — свой, отдельный от подгрузки: «у низа» для кнопки
возврата и «пора подгружать» — разные расстояния.

Флаги отвечают «да/нет», а плавным эффектам — тени под навбаром, подтягиванию
кнопки — нужна величина: для этого есть `distanceFromStart` и `distanceFromEnd`.

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

## `state`

Тот же набор значений, но в React.

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

### Зачем это отдельный объект

Стор списка живёт внутри и раздаётся по контексту — соседнему компоненту, кнопке
над списком или экрану он недоступен. А списка на первом рендере ещё нет вовсе,
поэтому подписаться «на его стор» просто неоткуда.

`AnchorListState` держит подписки до того, как список смонтируется, и
перевешивает их на его стор, когда тот появится. До этого значения — `undefined`.

### `useAnchorListValue(state, name)`

Возвращает `AnchorListSignalMap[name] | undefined`.

Подписка **адресная**: компонент перерисуется только тогда, когда изменится
именно это значение, а не любое состояние списка.

```tsx
const isNearEnd = useAnchorListValue(listState, "isNearEnd");
const totalSize = useAnchorListValue(listState, "totalSize");
```

`undefined` означает «список ещё не смонтирован» — обрабатывайте это явно.

### Какие имена доступны

Те же, что в `sharedValues`, плюс несколько внутренних. Тип имени —
`AnchorListSignalName`, тип карты значений — `AnchorListSignalMap`; оба
экспортируются.

Значения, доступные только здесь и не выходящие в `sharedValues`:

| Имя | Тип | Что это |
| --- | --- | --- |
| `numContainers` | `number` | Сколько контейнеров существует |
| `scrollAdjust` | `number` | Накопленная компенсация позиции |
| `contentOrigin` | `number` | Начало координат элементов внутри контента |

Опираться на эти три не стоит: они внутренние и меняются вместе с реализацией.

`contentOrigin` стоит пояснить отдельно, потому что за ним стоит различие,
которое видно на экране. Раскладка элементов начинается с нуля, а нативное
смещение скролла отсчитывается от начала контента — там, где над элементами
лежит шапка. Всё, что переводит позицию строки в смещение скролла и обратно,
обязано брать поправку отсюда: прилипание считает смещение на UI-потоке, где
позиции приходят из раскладки, а скролл — от `ScrollView`, и без поправки якорь
встаёт ниже кромки ровно на высоту шапки.

---

## Что выбрать: примеры

**Кнопка «вниз», появляющаяся, когда пользователь ушёл от конца.**
`sharedValues.isWithinMaintainScrollAtEndThreshold` — видимость считается на
UI-потоке, кнопка не вызывает рендеров при скролле.

```tsx
const isAtEnd = useSharedValue(true);

const style = useAnimatedStyle(() => ({
  opacity: withTiming(isAtEnd.value ? 0 : 1),
  pointerEvents: isAtEnd.value ? "none" : "auto",
}));

<AnchorList
  sharedValues={useMemo(
    () => ({ isWithinMaintainScrollAtEndThreshold: isAtEnd }),
    [isAtEnd],
  )}
/>;
```

**Счётчик «непрочитанных» в шапке.** `state` — значение идёт в текст, рендер
неизбежен, и он нужен только при смене числа.

**Тень под навбаром, растущая с прокруткой.** `sharedValues.distanceFromStart` —
величина непрерывная, через React её гонять нельзя.

**Показать спиннер, пока список не готов.** `state` + `readyToRender`: одно
изменение за жизнь списка, рендер уместен.

## Число с UI-потока, без рендеров

Отдельный случай — когда величину нужно показать **цифрами**, а меняется она на
каждом кадре: скорость, смещение, расстояние до кромки. Через `state` это рендер
на кадр.

Текст в уже смонтированный узел можно писать с UI-потока — через `animatedProps`
нередактируемого `TextInput`:

```tsx
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const LiveNumber = ({ value }: { value: SharedValue<number> }) => {
  const animatedProps = useAnimatedProps(() => {
    const text = value.value.toFixed(2);

    // `defaultValue` — для первого кадра: он ставится до того, как маппер
    // впервые запишет `text`.
    return { text, defaultValue: text } as Partial<TextInputProps>;
  });

  return (
    <AnimatedTextInput
      editable={false}
      value={undefined}
      animatedProps={animatedProps}
      style={{ fontVariant: ["tabular-nums"] }}
    />
  );
};
```

```tsx
const velocity = useSharedValue(0);

<AnchorList sharedValues={useMemo(() => ({ velocity }), [velocity])} />;
<LiveNumber value={velocity} />;
```

`fontVariant: ["tabular-nums"]` держит одинаковую ширину цифр — иначе число
дёргается по горизонтали на каждом изменении.

Готовый компонент есть в [`example/src/ui/LiveNumber.tsx`](../example/src/ui/LiveNumber.tsx);
стенд «Состояние списка» показывает им скорость и смещение.

## Дальше

- [Видимость элементов](viewability.md) — если нужно не «что на экране», а «что
  пользователь действительно увидел»
- [Отступы и клавиатура](insets.md) — законченный пример анимации по shared values
