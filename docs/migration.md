# Миграция

## С `FlatList`

### Соответствие пропов

| `FlatList` | `AnchorList` | Разница |
| --- | --- | --- |
| `data` | `data` | — |
| `renderItem` | `renderItem` | Приходит объект с `item`, `index`, `type`, `extraData`, `stickyOffset`, `stickyPinned` |
| `keyExtractor` | `keyExtractor` | Обязателен, и от индекса зависеть не должен |
| — | `estimatedItemSize` | **Обязателен**: стартовая оценка высоты |
| `getItemLayout` | `getFixedItemSize` | Возвращает только размер, а не `{length, offset, index}` |
| `extraData` | `extraData` | Приходит в `renderItem` полем, а не только инвалидирует |
| `ListHeaderComponent` | `ListHeaderComponent` | — |
| `ListFooterComponent` | `ListFooterComponent` | — |
| `ListEmptyComponent` | `ListEmptyComponent` | — |
| `ItemSeparatorComponent` | `ItemSeparatorComponent` | **Рисуется внутри ячейки и входит в её высоту** |
| `onEndReached` | `onEndReached` | Один раз на жест; получает `{ distanceFromEnd }` |
| `onEndReachedThreshold` | `onEndReachedThreshold` | Та же семантика — доли вьюпорта |
| — | `onStartReached` / `onStartReachedThreshold` | Есть симметричный порог у начала |
| `onViewableItemsChanged` + `viewabilityConfig` | `viewabilityPairs` | Один массив пар вместо двух пропов; наборов может быть несколько |
| `viewabilityConfigCallbackPairs` | `viewabilityPairs` | Практически то же |
| `onScroll` | `sharedValues.scrollOffset` | Отдельного `onScroll` нет: смещение живёт на UI-потоке |
| `maintainVisibleContentPosition` | `maintainVisibleContentPosition` | Не `{minIndexForVisible}`, а `{data, size, shouldRestorePosition}` |
| `initialScrollIndex` | `initialScroll={{ type: "index", index }}` | Плюс варианты `end` и `offset` |
| `inverted` | — | **Нет.** См. ниже |
| `horizontal` | — | **Нет.** Список вертикальный |
| `numColumns` | — | **Нет** |
| `refreshControl` / `onRefresh` | — | **Нет** |
| `stickyHeaderIndices` | `sticky` | Мощнее: обе кромки, два режима, отступы и пределы |
| `windowSize` / `initialNumToRender` / `maxToRenderPerBatch` | `drawDistance` | Один проп в пикселях вместо трёх в «экранах» и «штуках» |
| `removeClippedSubviews` | — | Всегда включено по смыслу: вне диапазона строк нет |

### `ref`

| `FlatList` | `AnchorList` |
| --- | --- |
| `scrollToIndex({ index, animated, viewPosition, viewOffset })` | Так же |
| `scrollToOffset({ offset, animated })` | Так же |
| `scrollToEnd({ animated })` | Так же |
| `scrollToItem` | `scrollToKey({ key, ... })` — адресация ключом, а не поиском по элементу |
| `flashScrollIndicators` | — |
| `recordInteraction` | — |
| — | `getPositionAtIndex`, `getSizeAtIndex`, `getPositionByKey`, `getIndexByKey`, `getVisibleRange`, `getScrollOffset`, `getContentSize`, `getScrollLength`, `getVelocity` |

### Что делать вместо `inverted`

Открыться внизу, держаться конца и грузить историю вверх — то же самое без
переворота списка:

```tsx
<AnchorList
  data={messages}                          // в естественном порядке
  initialScroll={{ type: "end" }}          // открыться внизу
  alignItemsAtEnd                          // короткий контент прижать к низу
  maintainScrollAtEnd={{ onlyWhenAtEnd: true, animated: true }}
  maintainVisibleContentPosition={{ data: true, size: true }}
  onStartReached={loadOlder}               // история грузится вверх
/>
```

### Пошагово

1. Добавьте `estimatedItemSize` — без него список не соберётся.
2. Проверьте `keyExtractor`: он не должен зависеть от индекса.
3. Замените `getItemLayout` на `getFixedItemSize` (возвращает число или `undefined`).
4. Соберите `viewabilityConfig` + `onViewableItemsChanged` в `viewabilityPairs`.
5. Замените `onScroll` на `sharedValues`.
6. Если был `inverted` — уберите его и перепишите по схеме выше.
7. Учтите, что `ItemSeparatorComponent` теперь входит в высоту ячейки.

---

## С других виртуализированных списков

Списки с оценкой высоты и типами строк переносятся почти один к одному:

| Что было | Что здесь |
| --- | --- |
| Оценка высоты строки | `estimatedItemSize` |
| Тип строки для переработки | `getItemType` |
| Заранее известная высота строки | `getFixedItemSize` — возвращает размер или `undefined` |
| Запас отрисовки за пределами экрана | `drawDistance` |
| Удержание видимой позиции | `maintainVisibleContentPosition` — раздельно по данным и по размерам |
| Событие первой раскладки | `onLoad` |
| Горизонтальная ось, колонки, masonry | **Нет** — см. [Ограничения](limitations.md) |

Что есть сверх этого: удержание позиции по двум причинам раздельно, прилипание
на обеих кромках сразу, состояние на UI-потоке, распорки под панель ввода —
[Возможности](../README.md#-возможности).

---

## Общий чек-лист

- [ ] `estimatedItemSize` задан
- [ ] `keyExtractor` не зависит от индекса и не меняется вместе с элементом
- [ ] `renderItem`, `getItemType`, `keyExtractor` мемоизированы
- [ ] `maintainVisibleContentPosition`, `sticky`, `viewabilityPairs`,
      `sharedValues` мемоизированы
- [ ] У списка есть высота (`flex: 1` или явная)
- [ ] Если строки перерабатываются — в них нет собственного состояния
- [ ] Если был `inverted` — заменён на `initialScroll` + `alignItemsAtEnd` +
      `maintainScrollAtEnd`
- [ ] Разделитель учтён в объявленных размерах строк

## Дальше

- [Ограничения](limitations.md) — чего в списке нет
- [Симптомы](troubleshooting.md) — если после миграции что-то ведёт себя не так
