# Установка

## Пакет

```sh
yarn add @epifanovmd/anchor-list
# или
npm install @epifanovmd/anchor-list
```

## Зависимости

Список объявляет четыре peer-зависимости. Три из них уже есть в любом проекте,
четвёртая приходит вместе с Reanimated.

| Пакет | Версия | Зачем |
| --- | --- | --- |
| `react` | любая | — |
| `react-native` | любая | — |
| `react-native-reanimated` | `>=4.0.0` | Смещение скролла и прилипание считаются на UI-потоке |
| `react-native-worklets` | `>=0.5.0` | Runtime worklet-функций; `scheduleOnRN` для перехода в JS |

```sh
yarn add react-native-reanimated react-native-worklets
cd ios && pod install
```

Reanimated 4 требует `react-native-worklets` строго совместимой версии — сверьтесь
с таблицей совместимости самого Reanimated, если ставите не последние версии.

### Почему Reanimated обязателен

Смещение скролла обязано попадать в shared value синхронно с нативным скроллом:
от него считается прилипание, и отставание хотя бы на кадр видно как дрожание
заголовка у кромки. Обработчик скролла — worklet, а не JS-колбэк.

Дальше на этом же смещении держится всё остальное: `sharedValues` наружу,
смещение прилипающих элементов, слой прилипших копий. Заменить Reanimated здесь
нечем.

## Настройка babel

Плагин worklets обязан идти **последним** в списке плагинов:

```js
// babel.config.js
module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    // ...все остальные плагины
    "react-native-worklets/plugin",
  ],
};
```

Плагин должен обрабатывать и код библиотеки: в нём есть функции с директивой
`"worklet"` (расчёт смещения прилипания и предиката «стоит у кромки»). Metro по
умолчанию применяет babel-конфиг проекта в том числе к `node_modules`, так что
отдельной настройки обычно не требуется. Если в проекте `node_modules` из
трансформации исключены — исключение придётся снять для этого пакета.

## Проверка

Если что-то настроено не так, симптомы будут такими:

| Симптом | Причина |
| --- | --- |
| `Tried to synchronously call a non-worklet function on the UI thread` | Плагин worklets не применён к коду библиотеки |
| Прилипающие заголовки не двигаются | То же — worklet не собрался, смещение всегда 0 |
| `Reanimated 4 requires react-native-worklets` | `react-native-worklets` не установлен |
| Список пустой, ошибок нет | Скорее всего дело не в установке — см. [Диагностика](troubleshooting.md) |

Минимальная проверка после установки:

```tsx
import { AnchorList } from "@epifanovmd/anchor-list";
import { Text, View } from "react-native";

const DATA = Array.from({ length: 100 }, (_, index) => ({ id: `${index}` }));

export const Smoke = () => (
  <AnchorList
    data={DATA}
    renderItem={({ item }) => (
      <View style={{ height: 60, justifyContent: "center" }}>
        <Text>{item.id}</Text>
      </View>
    )}
    keyExtractor={item => item.id}
    estimatedItemSize={60}
    style={{ flex: 1 }}
  />
);
```

Список должен прокручиваться и не мигать при открытии.

## Платформы

| Платформа | Состояние |
| --- | --- |
| iOS | Поддерживается |
| Android | Поддерживается |
| Web (`react-native-web`) | ⚠️ **Не готов.** Требует доработок, использовать нельзя |

Нативного кода в пакете нет — только JavaScript и типы, поэтому линковка не
нужна, а Expo Go работает, если в проекте уже есть Reanimated.

### Про web

Бандл примера собирается — но это всё, что я про web знаю, и проверял я это
руками. В браузере список я не запускал, CI web не трогает, и рассчитывать на
него сейчас нельзя.

Главное препятствие — не мелочь настройки: удержание видимой позиции выполняет
нативный `ScrollView` через свой `maintainVisibleContentPosition`, а
`react-native-web` этого свойства не реализует. То есть механика, ради которой я
список и писал, на web не работает вовсе, а не «ведёт себя иначе».

Web я поддержать хочу, но для этого придётся написать свою компенсацию позиции.
Следить — в [issues](https://github.com/epifanovmd/anchor-list/issues).

## Импорт

Всё публичное выходит из корня пакета:

```ts
import {
  AnchorList,
  useAnchorListState,
  useAnchorListValue,
  anchorListPerf,
  useAnchorListPerf,
  anchorListDebug,
  setAnchorListDebug,
} from "@epifanovmd/anchor-list";

import type {
  IAnchorListProps,
  IAnchorListRef,
  IAnchorListRenderItemProps,
  IAnchorListStickyConfig,
  IAnchorListSharedValues,
  AnchorListInitialScroll,
  AnchorListState,
} from "@epifanovmd/anchor-list";
```

Внутренности (контейнеры, пул, метрики, стор, компенсацию позиции) я намеренно
не экспортирую: я меняю их вместе с реализацией, и опираться на них нельзя.

## Дальше

- [Быстрый старт](quick-start.md) — первый рабочий список
- [Справочник пропов](props.md) — что вообще можно настроить
