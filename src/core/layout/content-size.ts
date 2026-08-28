import type { ListMetrics } from "../../model";

/** Зависимости учёта высоты контента. */
export interface IContentSizeOptions {
  metrics: ListMetrics;
  /** Идёт ожидание пересчёта раскладки — замер относится к прошлому кадру. */
  isFlushPending: () => boolean;
}

/**
 * Фактическая высота контента ScrollView.
 *
 * Зачем нужна: из неё вычисляется граница скролла, а к ней ScrollView сам
 * подтягивает смещение при укорачивании контента. Удержанию позиции это знать
 * обязательно — иначе оно повторяет сдвиг, который нативный слой уже сделал.
 *
 * Какую проблему решает: сумма элементов эту высоту не покрывает. Сверху и снизу
 * лежат шапка, подвал и распорки, о размерах которых список не знает. Их
 * суммарный вклад берётся из замера и держится между обновлениями данных —
 * меняется он куда реже, чем сами элементы.
 */
export class ContentSize {
  private readonly options: IContentSizeOptions;

  /** Насколько контент выше суммы элементов: шапка, подвал, распорки. */
  private padding = 0;
  private measured = false;

  constructor(options: IContentSizeOptions) {
    this.options = options;
  }

  /**
   * Замер от ScrollView.
   *
   * Игнорируется, пока пересчёт раскладки отложен: замер сделан по старой сумме
   * элементов, и разница ушла бы в отступ как его собственный рост.
   * Отрицательный отступ отбрасывается по той же причине — контент не может
   * быть ниже своих элементов, значит замер отстал от раскладки.
   */
  setMeasured(height: number): void {
    if (this.options.isFlushPending()) return;

    const padding = height - this.options.metrics.getTotalSize();

    if (padding < 0) return;

    this.padding = padding;
    this.measured = true;
  }

  /**
   * Замер контента уже приходил.
   *
   * До него список знает только сумму элементов, а всё, что лежит под ними —
   * подвал и распорки, — для него ещё не существует.
   */
  hasMeasured(): boolean {
    return this.measured;
  }

  /** Полная высота контента: элементы плюс всё, что список не раскладывает. */
  get(): number {
    return this.options.metrics.getTotalSize() + this.padding;
  }
}
