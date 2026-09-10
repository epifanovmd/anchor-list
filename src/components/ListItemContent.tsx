import React, {
  ComponentType,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { LayoutChangeEvent, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import {
  ListItemKeyProvider,
  useListHorizontal,
  useListRuntime,
} from "../model";
import { listPerf } from "../perf";
import type { IAnchorListRenderItemProps } from "../types";
import { getAxisSize } from "./axis";
import { shouldMeasureOnBind, shouldMeasureOnLayout } from "./measure-gate";

/** Пропы содержимого ячейки; приходят адресными сигналами её контейнера. */
export interface IAnchorListItemContentProps {
  id: number;
  itemKey: string;
  itemIndex: number;
  itemData: unknown;
  itemType: string;
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => React.ReactNode;
  extraData: unknown;
  ItemSeparatorComponent?: ComponentType<unknown> | null;
  stickyOffset?: SharedValue<number>;
  stickyPinned?: SharedValue<boolean>;
}

/**
 * Перерабатываемое содержимое ячейки.
 *
 * Зачем нужно: контейнер переживает смену элемента, а его содержимое — это то,
 * что рисует `renderItem`. Ключ содержимого выбирает контейнер: при переработке
 * это тип строки, иначе — ключ элемента.
 *
 * Отсюда же поддерево получает ключ своего элемента: при переработке оно не
 * перемонтируется, и всё, что ячейка хранит в себе, обязано знать, к какому
 * элементу относится. На этом стоит `useAnchorListItemState`.
 *
 * Здесь же живёт измерение размера строки вдоль оси скролла — высоты в
 * вертикальном списке, ширины в горизонтальном, — и оно устроено осторожнее,
 * чем кажется:
 * - размер читается через `measure` после коммита, а `onLayout` служит лишь
 *   триггером: событие может прийти с геометрией, посчитанной до смены
 *   содержимого, а `measure` читает узел таким, какой он есть сейчас;
 * - замер принимается, только пока контейнер всё ещё рисует тот же ключ, —
 *   запоздавший результат старой строки не портит новую;
 * - лишние замеры отсекаются до обращения в нативный слой: см.
 *   {@link shouldMeasureOnBind} и {@link shouldMeasureOnLayout}. На быстром
 *   скролле это сотни обращений в секунду, из которых почти все подтверждали
 *   бы уже известную высоту.
 */
export const ListItemContent = memo<IAnchorListItemContentProps>(
  ({
    id,
    itemKey,
    itemIndex,
    itemData,
    itemType,
    renderItem,
    extraData,
    ItemSeparatorComponent,
    stickyOffset,
    stickyPinned,
  }) => {
    const runtime = useListRuntime();
    const horizontal = useListHorizontal();
    const contentRef = useRef<View>(null);
    const measureRequest = useRef(0);
    /** Размер, который вернул последний замер этой ячейки. */
    const measuredSize = useRef<number | undefined>(undefined);
    const previousKey = useRef<string | undefined>(undefined);
    const previousData = useRef<unknown>(undefined);
    const fixedSize = runtime.isItemSizeFixed(itemKey);

    const measureCurrentContent = useCallback(() => {
      if (fixedSize) return;
      listPerf.count("measure");
      const request = ++measureRequest.current;

      // `measure` из layout effect читает уже закоммиченный нативный узел и не
      // добавляет ещё один кадр ожидания перед пересчётом виртуализации.
      contentRef.current?.measure((_x, _y, width, height) => {
        if (request !== measureRequest.current) return;

        const size = getAxisSize(width, height, horizontal);

        measuredSize.current = size;
        runtime.setContainerItemSize(id, itemKey, size);
      });
    }, [fixedSize, horizontal, id, itemKey, runtime]);

    // При перепривязке с той же высотой `onLayout` может не прийти.
    useLayoutEffect(() => {
      const keyChanged = previousKey.current !== itemKey;
      const dataChanged = previousData.current !== itemData;

      previousKey.current = itemKey;
      previousData.current = itemData;

      if (
        !shouldMeasureOnBind({
          keyChanged,
          dataChanged,
          hasKnownSize: runtime.isItemSizeKnown(itemKey),
        })
      ) {
        listPerf.count("measureSkipped");

        return;
      }

      measureCurrentContent();
    }, [itemKey, itemData, measureCurrentContent, runtime]);

    useEffect(
      () => () => {
        measureRequest.current++;
      },
      [],
    );

    const handleLayout = useCallback(
      (event: LayoutChangeEvent) => {
        // Сверка идёт с размером, который список знает для этой строки: после
        // перепривязки размер узла меняется на её собственный, и замерять его
        // заново значит подтверждать уже известное.
        const known = runtime.getKnownItemSize(itemKey) ?? measuredSize.current;
        const { width, height } = event.nativeEvent.layout;

        const size = getAxisSize(width, height, horizontal);

        if (!shouldMeasureOnLayout(size, known)) {
          listPerf.count("measureSkipped");

          return;
        }

        measureCurrentContent();
      },
      [horizontal, itemKey, measureCurrentContent, runtime],
    );

    listPerf.count("cellRender");

    return (
      <ListItemKeyProvider value={itemKey}>
        <View
          ref={contentRef}
          onLayout={fixedSize ? undefined : handleLayout}
          collapsable={false}
        >
          {renderItem({
            item: itemData,
            index: itemIndex,
            itemKey,
            type: itemType,
            extraData,
            stickyOffset,
            stickyPinned,
          })}
          {ItemSeparatorComponent ? <ItemSeparatorComponent /> : null}
        </View>
      </ListItemKeyProvider>
    );
  },
);

ListItemContent.displayName = "ListItemContent";
