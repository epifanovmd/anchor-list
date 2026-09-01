# Быстрый старт

## Минимальный список

Обязательных пропов четыре:

```tsx
import { AnchorList } from "@epifanovmd/anchor-list";
import { StyleSheet, Text, View } from "react-native";

interface IPost {
  id: string;
  title: string;
}

export const Feed = ({ posts }: { posts: IPost[] }) => (
  <AnchorList
    data={posts}
    renderItem={({ item }) => (
      <View style={styles.row}>
        <Text>{item.title}</Text>
      </View>
    )}
    keyExtractor={post => post.id}
    estimatedItemSize={72}
    style={styles.list}
  />
);

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: { justifyContent: "center", paddingHorizontal: 16, height: 72 },
});
```

| Проп | Зачем нужен |
| --- | --- |
| `data` | Массив элементов |
| `renderItem` | Отрисовка одной строки |
| `keyExtractor` | Постоянный ключ строки |
| `estimatedItemSize` | Стартовая оценка высоты до первого измерения |

`style` формально необязателен, но без `flex: 1` или явной высоты список займёт
нулевую высоту: обёртка не растягивается сама.

## Ключ

Ключ постоянен для элемента и не зависит от индекса.

```tsx
keyExtractor={post => post.id}          // да
keyExtractor={(_, index) => `${index}`} // нет
```

На ключе держатся измеренные размеры, переработка контейнеров и удержание
видимой позиции. Два элемента с одним ключом не допускаются.

## Оценка размера

`estimatedItemSize` — высота, которую список отводит строке до измерения. Если
высота известна заранее, задайте её напрямую — тогда строка не измеряется вовсе:

```tsx
<AnchorList
  data={rows}
  estimatedItemSize={72}
  getFixedItemSize={row => (row.type === "separator" ? 24 : 72)}
  // ...
/>
```

Подробнее — [Отрисовка строк](rendering.md#размеры).

## Типовая конфигурация: переписка

```tsx
import type { IAnchorListRef } from "@epifanovmd/anchor-list";
import { AnchorList } from "@epifanovmd/anchor-list";
import { useCallback, useRef } from "react";

export const Chat = ({ messages, loadOlder }: IChatProps) => {
  const listRef = useRef<IAnchorListRef>(null);

  const renderItem = useCallback(
    ({ item }: { item: IMessage }) => <MessageRow message={item} />,
    [],
  );

  return (
    <AnchorList
      ref={listRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={message => message.id}
      getItemType={message => message.kind}
      estimatedItemSize={92}
      // Открыться внизу, у последнего сообщения.
      initialScroll={{ type: "end" }}
      // Пока сообщений меньше экрана — прижать их к низу.
      alignItemsAtEnd
      // Новое сообщение приезжает само, если пользователь стоял внизу.
      maintainScrollAtEnd={{ onlyWhenAtEnd: true, animated: true }}
      // Подгрузка истории сверху не двигает то, что на экране.
      maintainVisibleContentPosition={{ data: true, size: true }}
      onStartReached={loadOlder}
      onStartReachedThreshold={0.4}
      recycleItems
      style={{ flex: 1 }}
    />
  );
};
```

Разбор пропов: [удержание позиции](maintain-position.md),
[подгрузка](pagination.md), [скролл и позиционирование](scrolling.md).

## Типовая конфигурация: обычная лента

Ленте, растущей только вниз, компенсация не нужна:

```tsx
<AnchorList
  data={posts}
  renderItem={renderItem}
  keyExtractor={post => post.id}
  getItemType={post => post.layout}
  estimatedItemSize={220}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  recycleItems
  style={{ flex: 1 }}
/>
```

## Частые ошибки

**1. `renderItem` пересоздаётся на каждом рендере.**

```tsx
// нет: новая функция каждый рендер
<AnchorList renderItem={({ item }) => <Row item={item} />} />

// да
const renderItem = useCallback(({ item }) => <Row item={item} />, []);
<AnchorList renderItem={renderItem} />
```

**2. Объекты-настройки создаются в JSX.** `maintainVisibleContentPosition`,
`sticky`, `viewabilityPairs`, `sharedValues` сравниваются по ссылке:

```tsx
const sticky = useMemo(
  () => [{ edge: "start" as const, indices: dayIndices }],
  [dayIndices],
);
```

**3. Ключ считается от индекса.**

**4. Список без высоты.** `style={{ flex: 1 }}` или явная высота.

## Дальше

- [Справочник пропов](props.md) — полный перечень
- [Отрисовка строк](rendering.md) — `renderItem` и размеры
- [Рецепты](recipes.md) — законченные экраны
