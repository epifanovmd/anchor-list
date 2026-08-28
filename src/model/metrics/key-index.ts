/**
 * Соответствие «ключ ↔ индекс» и типы элементов.
 *
 * Зачем нужен: всё остальное в списке адресуется ключом, а не индексом.
 * Размеры, привязки контейнеров и якоря удержания позиции обязаны пережить
 * вставку, удаление и перестановку данных — при смене индексов ключ остаётся
 * прежним, поэтому именно он и служит адресом.
 *
 * Какую проблему решает: даёт обратное преобразование «ключ → индекс» за
 * константу и подсказывает, с какого места поехала раскладка, — пересчитывать
 * префиксные суммы с нуля на каждое обновление данных слишком дорого.
 */
export class KeyIndex {
  private keys: string[] = [];
  private types: string[] = [];
  private readonly indexByKey = new Map<string, number>();

  /**
   * Привязка к новым данным.
   *
   * @returns индекс, с которого порядок ключей разошёлся со старым: до него
   * позиции остались прежними и пересчёт им не нужен.
   */
  setItems(keys: string[], types: string[]): number {
    const divergedAt = this.findDivergence(keys);

    this.keys = keys;
    this.types = types;
    this.indexByKey.clear();

    for (let index = 0; index < keys.length; index++) {
      this.indexByKey.set(keys[index]!, index);
    }

    return divergedAt;
  }

  /**
   * Первый индекс, где новый порядок ключей расходится со старым.
   *
   * Совпадающий префикс — обычный случай: подгрузка снизу, правка одного
   * сообщения, дописанный хвост. Всё, что выше точки расхождения, сохраняет
   * свои позиции.
   */
  private findDivergence(next: string[]): number {
    const min = Math.min(this.keys.length, next.length);

    for (let index = 0; index < min; index++) {
      if (this.keys[index] !== next[index]) return index;
    }

    return min;
  }

  /** Ключ элемента; undefined — индекс вне данных. */
  getKey(index: number): string | undefined {
    return this.keys[index];
  }

  /** Тип элемента; у элемента без `getItemType` — пустая строка. */
  getType(index: number): string {
    return this.types[index] ?? "";
  }

  /** Индекс элемента; undefined — ключа нет в данных. */
  getIndexByKey(key: string): number | undefined {
    return this.indexByKey.get(key);
  }

  /** Сколько элементов в данных. */
  getCount(): number {
    return this.keys.length;
  }
}
