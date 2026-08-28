/** Зависимости расчёта позиций. */
export interface IPrefixPositionsOptions {
  getCount: () => number;
  getSize: (index: number) => number;
}

/**
 * Позиции элементов как префиксные суммы их размеров.
 *
 * Зачем нужны: позиция строки — это сумма высот всех строк выше неё. Считать её
 * заново на каждое обращение значит проходить весь список на каждый кадр
 * скролла.
 *
 * Какие проблемы решает:
 * - **пересчёт ленивый**: суммы доводятся до запрошенного индекса, а не до
 *   конца списка. Измерения прилетают около вьюпорта, и позиции спрашивают там
 *   же — значит измерение стоит десятка итераций, а не длины списка. Хвост
 *   досчитается, когда скролл до него дойдёт;
 * - **суммарная высота правится на месте**: она нужна на каждом пересчёте
 *   раскладки, и считать её проходом по хвосту значит сводить ленивость на
 *   нет. Изменение размера строки прибавляется к ней напрямую, а полный проход
 *   остаётся только для смены данных, где меняется и состав списка.
 */
export class PrefixPositions {
  private readonly options: IPrefixPositionsOptions;

  private positions: number[] = [];
  /** Сколько позиций посчитано и не устарело. */
  private valid = 0;
  private total = 0;
  /** Суммарную высоту нельзя починить на месте — нужен проход по всему списку. */
  private totalDirty = true;

  constructor(options: IPrefixPositionsOptions) {
    this.options = options;
  }

  /**
   * Позиции с этого индекса устарели.
   *
   * Для смены данных: состав списка меняется, и суммарную высоту приходится
   * считать заново.
   */
  markDirty(index: number): void {
    if (index < this.valid) this.valid = Math.max(0, index);

    this.totalDirty = true;
  }

  /**
   * Размер строки изменился на известную величину.
   *
   * Позиция самой строки от этого не двигается — двигаются те, что ниже.
   * Суммарная высота правится разницей, без прохода по хвосту.
   */
  resize(index: number, delta: number): void {
    if (index + 1 < this.valid) this.valid = index + 1;

    if (!this.totalDirty) this.total += delta;
  }

  /** Позиция элемента; при необходимости досчитывается от последней чистой. */
  getPosition(index: number): number {
    this.extend(index);

    return this.positions[index] ?? 0;
  }

  /** Полная высота всех элементов, без шапки, подвала и распорок. */
  getTotal(): number {
    if (!this.totalDirty) return this.total;

    const count = this.options.getCount();

    this.extend(count - 1);
    this.total =
      count === 0
        ? 0
        : this.positions[count - 1]! + this.options.getSize(count - 1);
    this.totalDirty = false;

    return this.total;
  }

  /**
   * Последний элемент, начинающийся не ниже смещения. Бинарный поиск.
   *
   * Суммы доводятся ровно до строки, накрывающей смещение: искать по всему
   * списку незачем, а считать его целиком — тем более.
   */
  findIndexAtOffset(offset: number): number {
    const count = this.options.getCount();

    if (count === 0) return 0;

    this.extendPast(offset);

    let low = 0;
    let high = this.valid - 1;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);

      if (this.positions[mid]! <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  }

  /** Досчитать суммы до индекса включительно. */
  private extend(upTo: number): void {
    const count = this.options.getCount();

    if (this.positions.length > count) this.positions.length = count;
    if (this.valid > count) this.valid = count;

    const target = Math.min(upTo, count - 1);

    if (target < this.valid) return;

    let position =
      this.valid === 0
        ? 0
        : this.positions[this.valid - 1]! +
          this.options.getSize(this.valid - 1);

    for (let index = this.valid; index <= target; index++) {
      this.positions[index] = position;
      position += this.options.getSize(index);
    }

    this.valid = target + 1;
  }

  /** Досчитать суммы до строки, накрывающей смещение. */
  private extendPast(offset: number): void {
    const count = this.options.getCount();

    this.extend(0);

    while (
      this.valid < count &&
      this.positions[this.valid - 1]! + this.options.getSize(this.valid - 1) <=
        offset
    ) {
      this.extend(this.valid);
    }
  }
}
