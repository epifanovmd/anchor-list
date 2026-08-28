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
| `keyExtractor` | Постоянный ключ строки — на нём держится всё остальное |
| `estimatedItemSize` | Стартовая оценка высоты до первого измерения |

`style` формально необязателен, но без `flex: 1` (или явной высоты) список
займёт нулевую высоту и будет пустым: обёртка не растягивается сама.

## Про ключ

Ключ обязан быть постоянным для элемента и не зависеть от индекса.

```tsx
keyExtractor={post => post.id}          // да
keyExtractor={(_, index) => `${index}`} // нет
```

По ключу список узнаёт элемент после подгрузки и вставки. На ключе держатся
измеренные размеры, переработка контейнеров и удержание видимой позиции. С
индексом вместо ключа каждая вставка сверху выглядит как замена всех элементов
разом: измерения обнуляются, позиция уезжает.

Два элемента с одним ключом список не допускает.

## Про оценку размера

`estimatedItemSize` — это высота, которую список отводит строке до того, как она
измерена. От её точности зависит только качество первых кадров: чем ближе оценка
к правде, тем меньше список подстраивает раскладку после измерений.

Если высота известна заранее — скажите об этом прямо, и измерять список не будет
вовсе:

```tsx
<AnchorList
  data={rows}
  estimatedItemSize={72}
  getFixedItemSize={row => (row.type === "separator" ? 24 : 72)}
  // ...
/>
```

Подробнее — в [Отрисовка строк](rendering.md#размеры).

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
      // Пока сообщений меньше экрана — прижать их к низу, а не к верху.
      alignItemsAtEnd
      // Новое сообщение приезжает само, если пользователь и так стоял внизу.
      maintainScrollAtEnd={{ onlyWhenAtEnd: true, animated: true }}
      // Подгрузка истории сверху не должна двигать то, что на экране.
      maintainVisibleContentPosition={{ data: true, size: true }}
      onStartReached={loadOlder}
      onStartReachedThreshold={0.4}
      recycleItems
      style={{ flex: 1 }}
    />
  );
};
```

Каждый проп здесь разобран отдельно: [удержание позиции](maintain-position.md),
[подгрузка](pagination.md), [скролл и позиционирование](scrolling.md).

## Типовая конфигурация: обычная лента

Ленте, растущей только вниз, компенсация не нужна — она стоит работы и ничего не
даёт:

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

## Четыре ошибки, которые делают все

**1. `renderItem` пересоздаётся на каждом рендере.**

```tsx
// нет: новая функция каждый рендер
<AnchorList renderItem={({ item }) => <Row item={item} />} />

// да
const renderItem = useCallback(({ item }) => <Row item={item} />, []);
<AnchorList renderItem={renderItem} />
```

**2. Объекты-настройки создаются в JSX.**

`maintainVisibleContentPosition`, `sticky`, `viewabilityPairs`, `sharedValues`
сравниваются по ссылке. Новый объект на каждом рендере — это переприменение
настроек на каждом рендере:

```tsx
const sticky = useMemo(
  () => [{ edge: "start" as const, indices: dayIndices }],
  [dayIndices],
);
```

**3. Ключ считается от индекса.** См. выше.

**4. Список без высоты.** `style={{ flex: 1 }}` или явная высота — иначе пусто.

## Дальше

- [Справочник пропов](props.md) — полный перечень
- [Отрисовка строк](rendering.md) — что приходит в `renderItem` и как считаются размеры
- [Рецепты](recipes.md) — законченные экраны
