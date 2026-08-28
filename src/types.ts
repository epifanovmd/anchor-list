import type { ComponentType, ReactElement, ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";

import type { AnchorListState } from "./model";

/** Элемент, отданный в `renderItem`. */
export interface IAnchorListRenderItemProps<TItem> {
  item: TItem;
  /** Индекс в текущих данных: после подгрузки сверху он у элемента другой. */
  index: number;
  /**
   * Ключ элемента из `keyExtractor`. Им адресуется всё, что переживает
   * переработку контейнера: размеры, якоря и состояние ячейки во внешнем сторе.
   */
  itemKey: string;
  /** Тип контейнера, вернувшийся из `getItemType`. */
  type: string;
  /** Значение пропа `extraData` — им ячейку перерисовывают извне. */
  extraData: unknown;
  /**
   * Смещение прилипания для якорей в режиме `offset`; у остальных строк — 0.
   * Живёт на UI-потоке, применять через `useAnimatedStyle`.
   */
  stickyOffset?: SharedValue<number>;
  /**
   * Прилипшую копию рисует слой поверх списка: узел, к которому применяется
   * {@link stickyOffset}, нужно спрятать, оставив на месте для касаний.
   */
  stickyPinned?: SharedValue<boolean>;
}

/** Размер вьюпорта списка, px. */
export interface IAnchorListScrollSize {
  width: number;
  height: number;
}

/** Кромка, к которой прилипает якорь. */
export type AnchorListStickyEdge = "start" | "end";

/**
 * Набор прилипающих элементов на одной кромке.
 *
 * `offset` — динамический отступ от кромки (навбар сверху, панель ввода и
 * клавиатура снизу), поэтому это shared value, а не число.
 */
export interface IAnchorListStickyConfig<TItem = unknown> {
  /** Кромка, у которой останавливаются якоря этого набора. */
  edge: AnchorListStickyEdge;
  /** Индексы якорей, по возрастанию. */
  indices: number[];
  /** Отступ от кромки: навбар сверху, панель ввода и клавиатура снизу. */
  offset?: SharedValue<number>;
  /**
   * Что именно прилипает.
   *
   * `container` — вся строка целиком (заголовки, разделители дат).
   * `offset` — строка остаётся на месте, а смещение приходит в `renderItem`
   * как shared value: ячейка применяет его к нужному узлу. Так прилипает
   * аватар группы, не утаскивая за собой сообщение.
   */
  mode?: "container" | "offset";
  /**
   * Высота прилипающего объекта в режиме `offset` — например аватара, а не
   * всей строки. От неё зависит, докуда объект поднимается: его верх не должен
   * выходить за начало своей группы. По умолчанию — высота строки.
   */
  size?: number;
  /**
   * Индекс первой строки группы для каждого якоря — параллельно `indices`.
   *
   * Задаёт границу, выше которой объект не поднимается. Без него границей
   * считается строка сразу за предыдущим якорем, а между якорями могут лежать
   * разделители и чужие сообщения — тогда аватар уезжает за пределы своей
   * группы.
   */
  groupStarts?: number[];
  /**
   * Сдвиг верхней границы группы вниз, px.
   *
   * Нужен, когда зазор между строками создаётся отступом внутри них: габариты
   * строки тогда выше видимого содержимого, и без поправки объект поднимается
   * в этот зазор.
   */
  limitInset?: number;
  /**
   * Прилипшая копия якоря для слоя поверх списка.
   *
   * Пока якорь стоит у кромки, его экранная позиция постоянна — и рисует его
   * отдельный слой, которому не нужен покадровый трансформ. Внутри контента
   * якорь в этот момент прячется, оставаясь на месте для касаний.
   *
   * В режиме `container` по умолчанию берётся `renderItem`: прилипшая копия —
   * это сама строка. В режиме `offset` копию обязан задать вызывающий: у
   * кромки стоит не строка, а объект внутри неё — аватар группы.
   */
  renderOverlay?: (item: TItem, index: number) => ReactNode;
}

/** Удержание позиции при изменениях выше вьюпорта. */
export interface IAnchorListMaintainVisibleContentPosition<TItem> {
  /** Компенсировать вставку и удаление элементов. */
  data?: boolean;
  /** Компенсировать изменение размеров уже отрисованных элементов. */
  size?: boolean;
  /** Выбор якоря восстановления; по умолчанию — первый видимый элемент. */
  shouldRestorePosition?: (item: TItem, index: number) => boolean;
}

/** Автоприлипание к концу списка при добавлении элементов. */
export interface IAnchorListMaintainScrollAtEnd {
  /** Прилипать только если пользователь уже у конца. */
  onlyWhenAtEnd?: boolean;
  /** Доводить позицию анимацией, а не мгновенно. */
  animated?: boolean;
}

/**
 * Распорка у конца списка, растущая до якоря.
 *
 * Резервирует место под последним элементом ровно настолько, чтобы якорный
 * элемент мог подняться к верхней кромке вьюпорта, — так работает переход к
 * цитируемому сообщению у самого конца переписки. В отступ конца распорка
 * входит, а в расстояние до кромки для порогов подгрузки — нет.
 */
export interface IAnchorListAnchoredEndSpace {
  /** Элемент, который должен доставать до верхней кромки. */
  anchorIndex: number;
  /** Дополнительный отступ над якорем. */
  anchorOffset?: number;
  /** Верхняя граница размера распорки. */
  maxSize?: number;
  /** Текущий размер распорки; меняется вместе с раскладкой. */
  onSizeChanged?: (size: number) => void;
}

/** Стартовая позиция скролла. */
export type AnchorListInitialScroll =
  | { type: "end" }
  | { type: "offset"; offset: number }
  | {
      type: "index";
      index: number;
      viewPosition?: number;
      viewOffset?: number;
    };

/**
 * Порог видимости элемента.
 *
 * Задаётся одним из двух способов: долей самого элемента
 * ({@link IAnchorListViewabilityConfig.itemVisiblePercentThreshold}) или долей
 * вьюпорта ({@link IAnchorListViewabilityConfig.viewAreaCoveragePercentThreshold}).
 */
export interface IAnchorListViewabilityConfig {
  /** Имя набора: с ним приходят события, если наборов несколько. */
  id?: string;
  /** Доля видимой части элемента, при которой он считается видимым. */
  itemVisiblePercentThreshold?: number;
  /** Доля вьюпорта, занятая элементом. */
  viewAreaCoveragePercentThreshold?: number;
  /** Сколько элемент должен пробыть видимым, мс. */
  minimumViewTime?: number;
}

/** Элемент в событии видимости. */
export interface IAnchorListViewToken<TItem> {
  item: TItem;
  key: string;
  index: number;
  /** Проходит ли элемент порог прямо сейчас. */
  isViewable: boolean;
}

/** Состав события видимости. */
export interface IAnchorListViewabilityCallbackInfo<TItem> {
  /** Все элементы, проходящие порог сейчас. */
  viewableItems: IAnchorListViewToken<TItem>[];
  /** Только те, у кого видимость изменилась с прошлого события. */
  changed: IAnchorListViewToken<TItem>[];
}

/**
 * Порог и его обработчик.
 *
 * Наборов может быть несколько: аналитике и автовоспроизведению нужны разные
 * пороги на одном и том же списке.
 */
export interface IAnchorListViewabilityPair<TItem> {
  config: IAnchorListViewabilityConfig;
  onViewableItemsChanged: (
    info: IAnchorListViewabilityCallbackInfo<TItem>,
  ) => void;
}

/**
 * Shared values, которые список публикует наружу для worklet-логики.
 *
 * Всё, что список знает о своём состоянии, доступно на UI-потоке: заполните
 * только те поля, которые нужны, — остальные не стоят ничего. Не публикуются
 * лишь внутренности собственной механики (компенсация позиции, число
 * контейнеров, сигналы отдельных контейнеров): опираться на них снаружи нельзя.
 *
 * Обновляются поля с разной частотой, и это важно для анимаций. Смещение, фазы
 * жеста, расстояния до кромок и флаги кромок считаются прямо на UI-потоке и
 * приходят каждым кадром — на них можно строить непрерывное движение. Размеры и
 * распорки меняются на раскладке. А видимый диапазон, активные якоря и скорость
 * приходят из расчёта в JS, который идёт шагами по `scrollThrottleDistance`, — они
 * ступенчаты, и плавного движения из них не выйдет.
 */
export interface IAnchorListSharedValues {
  /** Смещение скролла в координатах контента. */
  scrollOffset?: SharedValue<number>;

  /** Палец на экране: позицией управляет жест. */
  isDragging?: SharedValue<boolean>;
  /**
   * Идёт инерция после броска.
   *
   * «Список движется» — это `isDragging || isMomentum`. Отдельного признака
   * нет намеренно: программный скролл не порождает ни того, ни другого, и
   * склеенный флаг врал бы про него молча.
   */
  isMomentum?: SharedValue<boolean>;
  /** Скорость скролла, px/мс: положительная — к концу списка. */
  velocity?: SharedValue<number>;

  /** Суммарная высота элементов, без шапки, подвала и распорок. */
  totalSize?: SharedValue<number>;
  /** Полная высота контента: элементы плюс шапка, подвал и распорки. */
  contentSize?: SharedValue<number>;
  /** Граница скролла; вместе со смещением даёт прогресс прокрутки. */
  maxScroll?: SharedValue<number>;
  /** Размер вьюпорта вдоль оси скролла. */
  scrollLength?: SharedValue<number>;
  /** Размер вьюпорта целиком. */
  scrollSize?: SharedValue<IAnchorListScrollSize>;
  headerSize?: SharedValue<number>;
  footerSize?: SharedValue<number>;
  /** Распорка, прижимающая короткий контент к концу списка. */
  alignItemsAtEndPadding?: SharedValue<number>;
  /** Распорка у конца, поднимающая якорный элемент к верхней кромке. */
  anchoredEndSpaceSize?: SharedValue<number>;

  /** Список отрисовал стартовый кадр и применил начальный скролл. */
  readyToRender?: SharedValue<boolean>;

  /** Скролл упёрся в начало контента. */
  isAtStart?: SharedValue<boolean>;
  /** Скролл упёрся в конец контента. */
  isAtEnd?: SharedValue<boolean>;
  /** Начало в пределах порога подгрузки. */
  isNearStart?: SharedValue<boolean>;
  /** Конец в пределах порога подгрузки. */
  isNearEnd?: SharedValue<boolean>;
  /**
   * Конец в пределах порога автоприлипания.
   *
   * Порог здесь свой, отдельный от подгрузки: «у низа» для кнопки возврата и
   * «пора подгружать» — разные расстояния.
   */
  isWithinMaintainScrollAtEndThreshold?: SharedValue<boolean>;
  /** Расстояние до начала контента — для плавных эффектов, а не флагов. */
  distanceFromStart?: SharedValue<number>;
  /** Расстояние до конца контента, без учёта отступа конца. */
  distanceFromEnd?: SharedValue<number>;

  /** Первый элемент, пересёкший вьюпорт; -1 — видимых нет. */
  firstVisibleIndex?: SharedValue<number>;
  /** Последний элемент, пересёкший вьюпорт; -1 — видимых нет. */
  lastVisibleIndex?: SharedValue<number>;

  /** Индекс активного якоря начальной кромки, -1 если якорей нет. */
  activeStickyStartIndex?: SharedValue<number>;
  /** Индекс активного якоря конечной кромки, -1 если якорей нет. */
  activeStickyEndIndex?: SharedValue<number>;
}

/**
 * Императивный интерфейс списка.
 *
 * Всё, что нельзя выразить пропами: разовый скролл и вопросы о текущей
 * геометрии. Позиции и размеры отдаются в координатах контента — тех же, в
 * которых работает `contentOffset` нативного скролла.
 */
export interface IAnchorListRef {
  /**
   * Скролл к элементу по индексу.
   *
   * `viewPosition` — куда прижать элемент во вьюпорте: 0 к началу, 1 к концу,
   * 0.5 по центру. `viewOffset` — поправка в пикселях поверх этого.
   */
  scrollToIndex: (params: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
    viewOffset?: number;
  }) => void;
  /**
   * Скролл к элементу по ключу.
   *
   * Ключ переживает вставки и удаления, а индекс — нет: после подгрузки сверху
   * тот же элемент лежит на другом индексе.
   *
   * @returns false, если элемента с таким ключом в данных нет.
   */
  scrollToKey: (params: {
    key: string;
    animated?: boolean;
    viewPosition?: number;
    viewOffset?: number;
  }) => boolean;
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
  /** Скролл к концу контента — вместе с подвалом и распорками. */
  scrollToEnd: (params?: { animated?: boolean }) => void;
  /** Позиция элемента в координатах контента; undefined — индекс вне данных. */
  getPositionAtIndex: (index: number) => number | undefined;
  /** Размер элемента; до измерения — оценка, а не факт. */
  getSizeAtIndex: (index: number) => number | undefined;
  /** Позиция элемента по ключу; undefined — ключа нет в данных. */
  getPositionByKey: (key: string) => number | undefined;
  /** Индекс элемента по ключу; undefined — ключа нет в данных. */
  getIndexByKey: (key: string) => number | undefined;
  /** Текущий видимый диапазон и его буферизованные границы. */
  getVisibleRange: () => {
    start: number;
    end: number;
    startBuffered: number;
    endBuffered: number;
  };
  /** Смещение скролла в координатах контента. */
  getScrollOffset: () => number;
  /** Полная высота контента: элементы плюс шапка, подвал и распорки. */
  getContentSize: () => number;
  /** Размер вьюпорта вдоль оси скролла. */
  getScrollLength: () => number;
  /** Скорость скролла, px/мс: положительная — к концу списка. */
  getVelocity: () => number;
}

/**
 * Пропы списка.
 *
 * Обязательны только данные, отрисовка строки, ключ и стартовая оценка размера
 * — всё остальное включает отдельные механики: удержание позиции, прилипание,
 * пороги подгрузки, состояние наружу.
 *
 * Ключ обязан переживать смену данных: по нему список узнаёт элемент после
 * подгрузки и вставки, на нём держатся измеренные размеры, переработка
 * контейнеров и удержание видимой позиции.
 */
export interface IAnchorListProps<TItem> {
  data: readonly TItem[];
  renderItem: (props: IAnchorListRenderItemProps<TItem>) => ReactNode;
  /** Постоянный ключ элемента; от индекса зависеть не должен. */
  keyExtractor: (item: TItem, index: number) => string;

  /**
   * Тип контейнера для переиспользования: контейнер того же типа уже держит
   * нужное поддерево, поэтому React меняет пропы вместо перемонтирования.
   */
  getItemType?: (item: TItem, index: number) => string;
  /** Известный размер элемента — измерение пропускается. */
  getFixedItemSize?: (
    item: TItem,
    index: number,
    type: string,
  ) => number | undefined;
  /** Стартовая оценка размера до первого измерения. */
  estimatedItemSize: number;
  /** Переиспользовать смонтированные контейнеры вместо перемонтирования. */
  recycleItems?: boolean;
  /**
   * Сравнение элементов для пропуска повторного рендера ячейки.
   *
   * По умолчанию элементы сравниваются по ссылке: новый объект с теми же
   * полями перерисует строку.
   */
  itemsAreEqual?: (prev: TItem, next: TItem, index: number) => boolean;
  /** Значение, доходящее до каждой ячейки: им перерисовывают строки извне. */
  extraData?: unknown;

  /**
   * Запас отрисовки за пределами вьюпорта, px.
   *
   * Строки этого запаса смонтированы и измерены заранее, к моменту, когда до
   * них доходит скролл. По ходу движения запас дополнительно растёт со
   * скоростью — этим список распоряжается сам.
   */
  drawDistance?: number;

  /**
   * Через сколько пикселей прокрутки список пересчитывает видимые строки.
   *
   * В пикселях, не в миллисекундах: порог по пути, а не по времени. Нативный
   * `scrollEventThrottle` решает, как часто приходят события; этот проп — через
   * сколько из них список берётся за пересчёт.
   *
   * Следствие: значения в `state` обновляются такими же шагами. На
   * `sharedValues` не влияет — они считаются на UI-потоке каждым кадром. У
   * кромок контента шаг не применяется при любом значении.
   *
   * @default 24
   */
  scrollThrottleDistance?: number;

  ListHeaderComponent?: ComponentType<unknown> | ReactElement | null;
  ListFooterComponent?: ComponentType<unknown> | ReactElement | null;
  /** Показывается вместо элементов, когда данные пусты. */
  ListEmptyComponent?: ComponentType<unknown> | ReactElement | null;
  /** Рисуется внутри ячейки, под содержимым строки, и входит в её высоту. */
  ItemSeparatorComponent?: ComponentType<unknown> | null;

  /** Прижать контент к концу, когда он короче вьюпорта. */
  alignItemsAtEnd?: boolean;
  anchoredEndSpace?: IAnchorListAnchoredEndSpace;
  /** Удержание видимой позиции при изменениях выше вьюпорта. */
  maintainVisibleContentPosition?: IAnchorListMaintainVisibleContentPosition<TItem>;
  /** Автоприлипание к концу при добавлении элементов. */
  maintainScrollAtEnd?: IAnchorListMaintainScrollAtEnd;
  /** Порог «у конца» для `maintainScrollAtEnd` и `isNearEnd`, px. */
  maintainScrollAtEndThreshold?: number;
  /**
   * Позиция, с которой список открывается.
   *
   * До неё список не показан: иначе виден кадр, отрисованный по оценочным
   * размерам, и доводка позиции на глазах у пользователя.
   */
  initialScroll?: AnchorListInitialScroll;

  /** Наборы прилипающих элементов; на каждой кромке не более одного. */
  sticky?: IAnchorListStickyConfig<TItem>[];
  /** Точки притяжения скролла. */
  snapToIndices?: number[];

  /**
   * Сколько низа вьюпорта занято не списком: панель ввода, клавиатура,
   * безопасная зона.
   *
   * Место под ними отдаётся списку распоркой в подвале — она часть контента, и
   * последняя строка честно останавливается над ними. Но об этой распорке знает
   * только контент, а до низа экрана дотягиваются ещё двое:
   *
   * - индикатор скролла живёт в координатах `ScrollView` и без этого отступа
   *   доходит до кромки экрана;
   * - якорь, прилипающий к конечной кромке, по умолчанию останавливается у
   *   самого низа вьюпорта — то есть под панелью.
   *
   * Оба берут значение отсюда, поэтому разойтись с контентом не могут. Набор
   * прилипания может задать свой `offset` — он приоритетнее.
   *
   * Shared value, а не число: величина меняется вместе с клавиатурой, и всё
   * перечисленное обязано ехать с ней в один кадр.
   *
   * iOS сам добавляет safe area к инсетам индикатора; здесь она уже входит в
   * значение, поэтому авто-подстройка отключается — иначе отступ был бы двойным.
   */
  insetEnd?: SharedValue<number>;

  /** Пороги видимости и их обработчики. */
  viewabilityPairs?: IAnchorListViewabilityPair<TItem>[];
  /** Состояние списка на UI-потоке: анимации без единого рендера. */
  sharedValues?: IAnchorListSharedValues;
  /**
   * Состояние списка для JS: подписка с перерисовкой.
   *
   * Создаётся через `useAnchorListState()` вне списка и читается через
   * `useAnchorListValue(state, name)` — в том числе из соседних компонентов, которым
   * список недоступен. Для анимаций используйте `sharedValues`.
   */
  state?: AnchorListState;

  /**
   * Скролл подошёл к началу контента — пора подгружать предыдущую страницу.
   *
   * Вызывается один раз на жест: пока пользователь не оторвал палец и не
   * двинулся в другую сторону, повторно порог не срабатывает.
   */
  onStartReached?: (info: { distanceFromStart: number }) => void;
  /** Порог начала в долях вьюпорта. */
  onStartReachedThreshold?: number;
  /** Скролл подошёл к концу контента; см. {@link IAnchorListProps.onStartReached}. */
  onEndReached?: (info: { distanceFromEnd: number }) => void;
  /** Порог конца в долях вьюпорта. */
  onEndReachedThreshold?: number;
  /** Первая раскладка завершена, стартовый скролл применён. */
  onLoad?: () => void;

  /** Размер вьюпорта изменился. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Размер контента изменился. */
  onContentSizeChange?: (width: number, height: number) => void;
  /** Палец лёг на экран: внешняя логика позиции обязана уступить жесту. */
  onScrollBeginDrag?: () => void;
  /** Палец отпущен; дальше возможна инерция. */
  onScrollEndDrag?: () => void;

  /** Стиль обёртки списка: сюда идут размеры и фон. */
  style?: StyleProp<ViewStyle>;
  /** Стиль контента внутри ScrollView: отступы вокруг элементов. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Ref нижележащего ScrollView. Нужен тем, кто двигает позицию с UI-потока —
   * например компенсации клавиатуры.
   */
  refScrollView?: AnimatedRef<Animated.ScrollView>;
}
