import type { ListMetrics } from "../../model";

/**
 * Сколько появившихся элементов держать без места до измерения.
 *
 * Каждый такой элемент приходится смонтировать, чтобы измерить. Пачка размером
 * с подгруженную страницу истории смонтировалась бы разом — дороже, чем полоса
 * на кадр, ради которой всё и затевалось. Большая пачка идёт по среднему.
 */
const PENDING_LIMIT = 32;

const DEFAULT_ITEM_TYPE = "";

/** Функции извлечения, объявленные пропами списка. */
export interface IItemSourceExtractors<TItem> {
  keyExtractor: (item: TItem, index: number) => string;
  getItemType?: (item: TItem, index: number) => string;
  getFixedItemSize?: (
    item: TItem,
    index: number,
    type: string,
  ) => number | undefined;
}

/** Зависимости разбора данных. */
export interface IItemSourceOptions {
  metrics: ListMetrics;
}

/**
 * Разбор данных списка в ключи и типы.
 *
 * Зачем нужен: единственное место, где массив элементов превращается во всё
 * остальное — ключи, типы, объявленные размеры и пометки «ещё не измерен».
 * Дальше по списку данные уже не разбираются: ядро работает ключами и
 * индексами.
 *
 * Какие проблемы решает:
 * - находит появившиеся элементы и помечает их не занимающими места, чтобы на
 *   кадр вставки не разошлись отведённый слот и нарисованная высота;
 * - ограничивает размер такой пачки: смонтировать разом страницу истории ради
 *   измерения дороже, чем полоса на один кадр.
 */
export class ItemSource<TItem> {
  private readonly metrics: ListMetrics;
  private keys: string[] = [];
  private types: string[] = [];

  constructor({ metrics }: IItemSourceOptions) {
    this.metrics = metrics;
  }

  /** Разобрать данные и передать раскладке новые ключи, типы и размеры. */
  apply(
    data: readonly TItem[],
    {
      keyExtractor,
      getItemType,
      getFixedItemSize,
    }: IItemSourceExtractors<TItem>,
  ): void {
    // Первое наполнение не в счёт: там новые все, и до измерений список всё
    // равно не показан.
    const appeared = this.keys.length === 0 ? undefined : new Set<string>();

    this.keys = new Array<string>(data.length);
    this.types = new Array<string>(data.length);

    for (let index = 0; index < data.length; index++) {
      const item = data[index]!;
      const key = keyExtractor(item, index);
      const type = getItemType?.(item, index) ?? DEFAULT_ITEM_TYPE;

      if (appeared && this.metrics.getIndexByKey(key) === undefined) {
        appeared.add(key);
      }

      this.keys[index] = key;
      this.types[index] = type;

      const fixedSize = getFixedItemSize?.(item, index, type);

      if (fixedSize !== undefined) this.metrics.setFixedSize(key, fixedSize);
    }

    this.metrics.setItems(this.keys, this.types);

    // Появившийся элемент не занимает места, пока его не измерили: иначе на
    // кадр разошлись бы отведённое место и нарисованная высота.
    if (appeared && appeared.size <= PENDING_LIMIT) {
      for (const key of appeared) this.metrics.markPending(key);
    }
  }

  /** Ключ элемента; undefined — индекс вне данных. */
  getKey(index: number): string | undefined {
    return this.keys[index];
  }

  /** Тип элемента; без `getItemType` у всех строк он общий. */
  getType(index: number): string {
    return this.types[index] ?? DEFAULT_ITEM_TYPE;
  }

  /** Сколько элементов в данных. */
  getCount(): number {
    return this.keys.length;
  }
}
