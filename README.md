# AnchorList

[![npm](https://img.shields.io/npm/v/@epifanovmd/anchor-list.svg)](https://www.npmjs.com/package/@epifanovmd/anchor-list)
[![CI](https://github.com/epifanovmd/anchor-list/actions/workflows/ci.yml/badge.svg)](https://github.com/epifanovmd/anchor-list/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/epifanovmd/anchor-list.svg)](LICENSE)
[![platforms](https://img.shields.io/badge/platforms-ios%20%7C%20android-lightgrey.svg)](docs/installation.md#платформы)

Виртуализированный список для React Native, который удерживает на месте не
экран, а конкретную строку: подгрузка истории сверху, рост ячеек выше вьюпорта и
клавиатура не двигают то, на что смотрит пользователь.

```sh
yarn add @epifanovmd/anchor-list
```

Нужны `react-native-reanimated` 4+ и `react-native-worklets`. Нативного кода в
пакете нет: линковка не нужна, Expo Go работает. Настройка babel — в
[руководстве по установке](docs/installation.md).

Список вертикальный и одноколоночный.

---

## 💻 Использование

```tsx
import { AnchorList } from "@epifanovmd/anchor-list";

<AnchorList
  data={messages}
  renderItem={({ item }) => <Message message={item} />}
  keyExtractor={message => message.id}
  estimatedItemSize={92}
/>;
```

Четыре пропа обязательны, остальные механики включаются по одной:

```tsx
<AnchorList
  data={messages}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  estimatedItemSize={92}
  // Видимая строка не двигается при подгрузке истории и росте ячеек
  maintainVisibleContentPosition={{ data: true, size: true }}
  // Заголовки дат прилипают к верхней кромке
  sticky={sticky}
  // Клавиатура и панель ввода — контент едет вместе с ними
  insetEnd={insetEnd}
  // Новое сообщение оказывается на экране само
  maintainScrollAtEnd={{ onlyWhenAtEnd: true }}
  onStartReached={loadOlder}
/>;
```

Состояние — на UI-потоке, без рендеров:

```tsx
const scrollOffset = useSharedValue(0);
const sharedValues = useMemo(() => ({ scrollOffset }), [scrollOffset]);

const shadow = useAnimatedStyle(() => ({
  opacity: Math.min(1, scrollOffset.value / 24),
}));

<AnchorList sharedValues={sharedValues} ... />;
```

Законченные экраны — в [Рецептах](docs/recipes.md), первый список — в
[Быстром старте](docs/quick-start.md).

---

## ✨ Возможности

**Позиция и прокрутка**

- [x] Удержание видимой позиции при вставке и удалении элементов
- [x] Удержание при изменении размеров уже отрисованных строк
- [x] Свой выбор якоря восстановления (`shouldRestorePosition`)
- [x] Стартовая позиция по индексу, ключу, смещению или концу списка
- [x] Прилипание к концу при добавлении контента — с отменой, если пользователь
      увёл список
- [x] `scrollToIndex`, `scrollToKey`, `scrollToOffset`, `scrollToEnd` с
      `viewPosition` и `viewOffset`
- [x] Снап по индексам (`snapToIndices`)
- [x] Прижатие короткого контента к концу (`alignItemsAtEnd`)
- [x] Резерв места у конца под якорь (`anchoredEndSpace`)

**Прилипание**

- [x] Обе кромки одновременно, независимыми наборами индексов
- [x] Два режима: прилипает вся строка или только объект внутри неё
- [x] Слой копий поверх списка — у стоящего якоря нет покадрового трансформа
- [x] Границы групп: якорь не поднимается выше своей группы
- [x] Динамический отступ кромки shared value — навбар, панель ввода, клавиатура

**Клавиатура и отступы**

- [x] `insetEnd` одним shared value: распорка, подъём смещения и инсеты
      индикатора скролла считаются от него сами
- [x] Интерактивное закрытие клавиатуры свайпом

**Подгрузка**

- [x] Пороги в долях вьюпорта в обе стороны
- [x] Однократность на жест и гистерезис у границы
- [x] Общий замок: две кромки не выстрелят на одном жесте
- [x] Повторное срабатывание, когда контент вырос, а до кромки по-прежнему близко

**Виртуализация**

- [x] Расчёт вне React: скролл перерисовывает один контейнер, а не список
- [x] Переработка контейнеров по типам строк (`recycleItems`, `getItemType`)
- [x] Объявленные размеры без измерения вовсе (`getFixedItemSize`)
- [x] Буфер отрисовки, растущий со скоростью броска
- [x] Своё сравнение элементов (`itemsAreEqual`)

**Состояние наружу**

- [x] 24 сигнала на UI-поток через `sharedValues`
- [x] Те же значения в React с адресной подпиской
- [x] Состояние ячейки, переживающее переработку контейнера
- [x] Видимость: несколько независимых наборов порогов и `minimumViewTime`
- [x] Императивный ref: позиции, размеры, видимый диапазон, смещение, скорость

**Слоты и инструменты**

- [x] `ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent`,
      `ItemSeparatorComponent`
- [x] Диагностика: восемь каналов по числу механик
- [x] Замер производительности с отчётом раз в секунду
- [x] TypeScript

Чего в списке нет — [Ограничения](docs/limitations.md).

---

## 🔬 Диагностика и замер

```ts
import { anchorListDebug, setAnchorListDebug } from "@epifanovmd/anchor-list";

anchorListDebug.help();       // какие каналы бывают и что в них
setAnchorListDebug("mvcp");   // включить одну механику
```

```
[mvcp·shift]        2.416 42    reason=данные moved=+18 applied=+18 lost=0
[mvcp·miss]!        2.418 42    before=120 after=138 error=18
```

Замер печатает кадры с медианой и p95, стоимость проходов, переработку
контейнеров и незакрытые полосы раз в секунду. Подробно:
[Диагностика](docs/debugging.md), [Производительность](docs/performance.md).

---

## 📱 Стенды

В [`example/`](example) — восемь экранов, по одному на механику: стартовая
позиция, подгрузка, компенсация, нижний отступ, прилипание, состояние, переход к
сообщению и нагрузка. На каждом — тумблеры, отключающие проверяемое поведение.

```sh
yarn
yarn example ios      # или android
```

---

## 📚 Документация

| Раздел | О чём |
| --- | --- |
| [Быстрый старт](docs/quick-start.md) | Первый список и обязательный минимум |
| [Справочник пропов](docs/props.md) | Все пропы, значения по умолчанию, типы |
| [Отрисовка строк](docs/rendering.md) | `renderItem`, ключи, типы, размеры, переработка |
| [Состояние списка](docs/state.md) | `sharedValues`, `state`, все сигналы |
| [Удержание позиции](docs/maintain-position.md) | Компенсация по данным и по размерам |
| [Прилипание](docs/sticky.md) | Оба режима, слой копий, пределы |
| [Отступы и клавиатура](docs/insets.md) | `insetEnd` и всё, что от него считается |
| [Подгрузка](docs/pagination.md) | Пороги, однократность, гейт кромок |
| [Рецепты](docs/recipes.md) | Экран переписки и бесконечная лента целиком |
| [Миграция](docs/migration.md) | С `FlatList` и других виртуализированных списков |
| [Диагностика](docs/debugging.md) | Восемь каналов: что включать и как читать строки |
| [Симптомы](docs/troubleshooting.md) | Симптом → причина → что делать |
| [Механика](docs/mechanics.md) | Чем каждая возможность сделана; без кода |
| [Ограничения](docs/limitations.md) | Чего список не делает |

Полный список разделов — в [`docs/`](docs/README.md).

---

## 🗺 Что дальше

- [ ] Поддержка web — нужна своя реализация удержания позиции
- [ ] Pull-to-refresh
- [ ] Анимации вставки и удаления строк
- [ ] Горизонтальная ось

> **Web не работает.** Бандл собирается, но удержание позиции опирается на
> нативный `maintainVisibleContentPosition`, которого нет в `react-native-web`.
> Подробности — в
> [Ограничениях](docs/limitations.md#web-требует-доработок).

---

## 🤝 Участие

Буду рад правкам — от опечаток в документации до механик.

- [Ведение библиотеки](docs/maintaining.md) — цикл правки, коммиты, выпуск
- [Рабочий процесс](CONTRIBUTING.md#development-workflow)
- [Тесты](docs/testing.md) — что покрыто и как гонять
- [Кодекс поведения](CODE_OF_CONDUCT.md)

Правка поведения начинается с падающего теста.

---

## ⚖️ Лицензия

MIT
