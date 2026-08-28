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

`inverted` в `FlatList` — обходной приём: список переворачивается вверх ногами,
чтобы новые сообщения оказались внизу. Он тянет за собой перевёрнутые ячейки,
инвертированные жесты, сломанную доступность и обратный порядок данных.

`AnchorList` решает исходную задачу прямо:

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

## С `@shopify/flash-list`

Модель ближе: типы контейнеров, оценка размера и переработка — те же идеи.

| `FlashList` | `AnchorList` |
| --- | --- |
| `estimatedItemSize` | `estimatedItemSize` |
| `getItemType` | `getItemType` |
| `overrideItemLayout` | `getFixedItemSize` |
| `drawDistance` | `drawDistance` |
| `maintainVisibleContentPosition` | `maintainVisibleContentPosition` — здесь раздельно по данным и размерам |
| `onLoad` | `onLoad` |
| `horizontal`, `numColumns`, `masonry` | **Нет** |

Основные отличия: `AnchorList` вертикальный и одноколоночный, но даёт удержание
позиции по двум причинам раздельно, прилипание на обеих кромках, состояние на
UI-потоке и распорки под панель ввода.

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

- [Ограничения](limitations.md) — чего в списке нет и не будет
- [Диагностика](troubleshooting.md) — если после миграции что-то ведёт себя не так
