import { TypeSizeAverages } from "./size-averages";

/** Изменение измеренной высоты меньше этого — шум округления экрана. */
const MEASURE_EPSILON = 1;

/** Настройки хранилища размеров. */
export interface IItemSizesOptions {
  /** Стартовая оценка до первого измерения любого элемента. */
  estimatedItemSize: number;
}

/**
 * Размеры элементов по ключу.
 *
 * Зачем нужен: раскладке нужна высота каждой строки, но известна она из четырёх
 * разных источников с разным приоритетом — объявленная пропом, измеренная,
 * средняя по типу и общая оценка. Здесь этот приоритет и живёт, одним местом на
 * весь список.
 *
 * Какие проблемы решает:
 * - объявленный размер не перебивается измерением: фактическая высота приходит
 *   округлённой к пикселям устройства, и каждое такое расхождение сдвигало бы
 *   все позиции ниже — на глаз это дрожание при прокрутке;
 * - измерение, отличающееся меньше чем на пиксель, не принимается: iOS
 *   округляет кадр к сетке экрана, и одна и та же ячейка на дробной позиции даёт
 *   гуляющую высоту — принять такое значит замкнуть цикл «пересчёт → сдвиг →
 *   новое округление»;
 * - появившийся элемент до первого измерения не занимает места вовсе, иначе на
 *   кадр расходятся отведённый ему слот и нарисованная высота.
 */
export class ItemSizes {
  /** Измеренные размеры; ключ переживает смену данных. */
  private readonly measured = new Map<string, number>();
  /** Размеры, объявленные через `getFixedItemSize` — измерять их не нужно. */
  private readonly fixed = new Map<string, number>();
  /**
   * Элементы, появившиеся в данных и ещё не измеренные.
   *
   * Места они не занимают вовсе. Отвести им место по среднему — значит на кадр
   * развести отведённое и нарисованное: строка рисуется своей высотой, а слот
   * под ней другой, и на стыке видна пустая полоса, которая схлопывается
   * следующим кадром вместе со скроллом. Нулевой слот убирает и полосу, и
   * лишний сдвиг: раскладка не меняется, пока размеры не известны.
   */
  private readonly pending = new Set<string>();
  /**
   * Оценка, однажды выданная ключу.
   *
   * Задним числом она не меняется: среднее по типу уточняется с каждым
   * замером, и без этой заморозки каждое измерение переставляло бы разом все
   * ещё не измеренные строки — суммарная высота гуляла бы на тысячи пикселей,
   * а позиции ниже вьюпорта ехали бы на десятки. Плата — суммарная высота
   * уточняется только по мере измерения строк, а не задним числом.
   */
  private readonly estimates = new Map<string, number>();
  private readonly averages = new TypeSizeAverages();

  private readonly estimatedItemSize: number;

  constructor({ estimatedItemSize }: IItemSizesOptions) {
    this.estimatedItemSize = estimatedItemSize;
  }

  /**
   * Размер, объявленный пропом: элемент не участвует в измерении.
   *
   * @returns true, если значение изменилось и раскладку нужно пересчитать.
   */
  setFixed(key: string, size: number): boolean {
    if (this.fixed.get(key) === size) return false;

    this.fixed.set(key, size);
    this.estimates.delete(key);

    return true;
  }

  /**
   * Поедет ли раскладка от такого измерения.
   *
   * Разница меньше пикселя игнорируется. iOS округляет кадр к сетке экрана, и
   * одна и та же ячейка на дробной позиции даёт высоту, гуляющую на доли
   * пикселя. Принимать такое измерение — значит пересчитать раскладку, сдвинуть
   * позицию, получить новое округление и следующее измерение: замкнутый цикл,
   * видимый как постоянная мелкая дрожь.
   */
  willResize(key: string, size: number): boolean {
    if (this.fixed.has(key)) return false;

    const previous = this.measured.get(key);

    return (
      previous === undefined || Math.abs(previous - size) >= MEASURE_EPSILON
    );
  }

  /**
   * Результат измерения ячейки.
   *
   * @param type тип элемента — по нему копится среднее для ещё не отрисованных
   * строк.
   * @returns true, если раскладка изменилась.
   */
  setMeasured(key: string, size: number, type: string): boolean {
    if (this.fixed.has(key)) return false;

    const previous = this.measured.get(key);

    if (previous === size) return false;

    this.measured.set(key, size);
    this.pending.delete(key);
    this.estimates.delete(key);
    this.averages.add(type, previous, size);

    return true;
  }

  /** Размер известен точно: измерен или объявлен пропом. */
  isKnown(key: string): boolean {
    return this.measured.has(key) || this.fixed.has(key);
  }

  /** Размер объявлен извне и не требует нативного измерения. */
  isFixed(key: string): boolean {
    return this.fixed.has(key);
  }

  /** Точно известный размер; `undefined` — есть только оценка. */
  getKnown(key: string): number | undefined {
    return this.measured.get(key) ?? this.fixed.get(key);
  }

  /** Элемент ждёт первого измерения и места пока не занимает. */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /** Ключи, ждущие первого измерения. */
  getPendingKeys(): string[] {
    return [...this.pending];
  }

  /**
   * Пометить появившийся элемент: до измерения он не занимает места.
   *
   * @returns true, если пометка действительно поставлена.
   */
  markPending(key: string): boolean {
    if (this.isKnown(key) || this.pending.has(key)) return false;

    this.pending.add(key);

    return true;
  }

  /**
   * Вернуть ожидающим элементам обычный размер.
   *
   * Ждать измерения бесконечно нельзя: до элемента могли не дойти — он вне
   * буфера отрисовки, — и тогда список считал бы его нулевым, а суммарную
   * высоту контента заниженной.
   *
   * @returns ключи, снятые с ожидания.
   */
  clearPending(): string[] {
    const cleared = [...this.pending];

    this.pending.clear();

    return cleared;
  }

  /**
   * Размер элемента: ноль у ожидающего, затем измеренный или объявленный,
   * затем однажды выданная оценка, и только для нового ключа — среднее по типу
   * или общая оценка.
   *
   * Средний по типу точнее общей оценки — разнородные ячейки (текст, фото)
   * иначе тянут раскладку друг друга. Выданная оценка запоминается: см.
   * {@link estimates}.
   */
  resolve(key: string | undefined, type: string): number {
    if (key === undefined) return this.estimatedItemSize;
    if (this.pending.has(key)) return 0;

    const known = this.getKnown(key);

    if (known !== undefined) return known;

    const estimate = this.estimates.get(key);

    if (estimate !== undefined) return estimate;

    const fresh = this.averages.get(type) ?? this.estimatedItemSize;

    this.estimates.set(key, fresh);

    return fresh;
  }
}
