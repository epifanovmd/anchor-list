import { ItemSizes } from "./item-sizes";
import { KeyIndex } from "./key-index";
import { PrefixPositions } from "./prefix-positions";

/** Настройки раскладки списка. */
export interface IAnchorListMetricsOptions {
  estimatedItemSize: number;
}

/**
 * Размеры и позиции элементов — единая точка входа для всей раскладки.
 *
 * Зачем нужен: собирает три независимые части в один интерфейс, которым
 * пользуются диапазон отрисовки, прилипание, видимость и удержание позиции:
 * - {@link KeyIndex} — адресация по ключу и точка расхождения данных;
 * - {@link ItemSizes} — приоритет источников размера;
 * - {@link PrefixPositions} — ленивые префиксные суммы.
 *
 * Какую проблему решает: держит их согласованными. Любое изменение размера
 * обязано пометить позиции грязными ровно с того индекса, где оно случилось, —
 * забыть об этом значит получить раскладку, расходящуюся с содержимым, а
 * пометить с нуля значит пересчитывать весь список на каждое измерение.
 */
export class ListMetrics {
  private readonly index = new KeyIndex();
  private readonly sizes: ItemSizes;
  private readonly positions: PrefixPositions;

  constructor({ estimatedItemSize }: IAnchorListMetricsOptions) {
    this.sizes = new ItemSizes({ estimatedItemSize });
    this.positions = new PrefixPositions({
      getCount: () => this.index.getCount(),
      getSize: index => this.getSize(index),
    });
  }

  /**
   * Привязка к новым данным.
   *
   * @returns индекс, с которого раскладка поехала: до него позиции остались
   * прежними и пересчёт не нужен.
   */
  setItems(keys: string[], types: string[]): number {
    const divergedAt = this.index.setItems(keys, types);

    this.positions.markDirty(divergedAt);

    return divergedAt;
  }

  /** Размер, объявленный пропом: элемент не участвует в измерении. */
  setFixedSize(key: string, size: number): void {
    const index = this.index.getIndexByKey(key);
    const before = index === undefined ? 0 : this.getSize(index);

    if (!this.sizes.setFixed(key, size)) return;

    this.applyResize(index, before);
  }

  /** Поедет ли раскладка от такого измерения. */
  willResize(key: string, size: number): boolean {
    return this.sizes.willResize(key, size);
  }

  /**
   * Результат измерения ячейки.
   *
   * @returns true, если раскладка изменилась.
   */
  setMeasuredSize(key: string, size: number): boolean {
    const index = this.index.getIndexByKey(key);
    const type = index === undefined ? "" : this.index.getType(index);
    const before = index === undefined ? 0 : this.getSize(index);
    // До первого замера типа его строки оценены догадкой из пропа. Этот замер
    // задаёт им среднее — размеры меняются разом по всему списку, и кэш позиций
    // обязан узнать об этом явно: молча изменившийся размер он бы не заметил.
    const firstOfType = !this.sizes.hasAverage(type);

    if (!this.sizes.setMeasured(key, size, type)) return false;

    this.applyResize(index, before);

    if (firstOfType) this.positions.markDirty(0);

    return true;
  }

  /** Размер известен точно: измерен или объявлен пропом. */
  hasMeasured(key: string): boolean {
    return this.sizes.isKnown(key);
  }

  /** Размер объявлен через `getFixedItemSize`; `onLayout` для него не нужен. */
  hasFixedSize(key: string): boolean {
    return this.sizes.isFixed(key);
  }

  /** Элемент ждёт первого измерения и места пока не занимает. */
  isPending(key: string): boolean {
    return this.sizes.isPending(key);
  }

  /** Пометить появившийся элемент: до измерения он не занимает места. */
  markPending(key: string): void {
    if (!this.sizes.markPending(key)) return;

    this.markDirtyByKey(key);
  }

  /**
   * Индексы ожидающих элементов.
   *
   * Их обязан отрисовать список: измерить неотрисованное нечем, а нулевой слот
   * схлопывает их в одну точку — сами в диапазон отрисовки они не попадут и
   * останутся нулевыми навсегда.
   */
  getPendingIndices(): number[] {
    const indices: number[] = [];

    for (const key of this.sizes.getPendingKeys()) {
      const index = this.index.getIndexByKey(key);

      if (index !== undefined) indices.push(index);
    }

    return indices;
  }

  /** Вернуть ожидающим элементам обычный размер. */
  clearPending(): void {
    const cleared = this.sizes.clearPending();

    if (cleared.length === 0) return;

    // Грязным становится самый верхний из них: всё, что ниже, поедет следом.
    let first = this.index.getCount();

    for (const key of cleared) {
      const index = this.index.getIndexByKey(key);

      if (index !== undefined && index < first) first = index;
    }

    this.positions.markDirty(first);
  }

  /** Размер элемента: измеренный, объявленный или оценочный. */
  getSize(index: number): number {
    return this.sizes.resolve(
      this.index.getKey(index),
      this.index.getType(index),
    );
  }

  /** Точно известный размер по ключу; `undefined` — есть только оценка. */
  getSizeByKey(key: string): number | undefined {
    return this.sizes.getKnown(key);
  }

  /** Позиция элемента в координатах элементов: шапка в них не входит. */
  getPosition(index: number): number {
    return this.positions.getPosition(index);
  }

  /** Позиция элемента по ключу; undefined — ключа нет в данных. */
  getPositionByKey(key: string): number | undefined {
    const index = this.index.getIndexByKey(key);

    return index === undefined ? undefined : this.getPosition(index);
  }

  /** Полная высота всех элементов, без шапки, подвала и распорок. */
  getTotalSize(): number {
    return this.positions.getTotal();
  }

  /** Индекс элемента по ключу; undefined — ключа нет в данных. */
  getIndexByKey(key: string): number | undefined {
    return this.index.getIndexByKey(key);
  }

  /** Ключ элемента; undefined — индекс вне данных. */
  getKey(index: number): string | undefined {
    return this.index.getKey(index);
  }

  /** Сколько элементов в раскладке. */
  getCount(): number {
    return this.index.getCount();
  }

  /** Последний элемент, начинающийся не ниже смещения. */
  findIndexAtOffset(offset: number): number {
    return this.positions.findIndexAtOffset(offset);
  }

  /**
   * Позиции ниже элемента устарели.
   *
   * Ключа может не быть в текущих данных — измерение приходит асинхронно и
   * вполне застаёт элемент уже удалённым. Такой замер всё равно сохраняется на
   * будущее, а грязным считается весь список: где именно этот элемент окажется,
   * заранее не известно.
   */
  private markDirtyByKey(key: string): void {
    this.positions.markDirty(this.index.getIndexByKey(key) ?? 0);
  }

  /**
   * Изменение размера одной строки.
   *
   * Ключа может не быть в текущих данных: измерение доставляется асинхронно и
   * вполне переживает смену списка. Тогда чинить нечего точечно — раскладка
   * считается заново целиком.
   */
  private applyResize(index: number | undefined, before: number): void {
    if (index === undefined) {
      this.positions.markDirty(0);

      return;
    }

    this.positions.resize(index, this.getSize(index) - before);
  }
}
