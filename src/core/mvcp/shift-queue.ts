/**
 * Сколько ждём подтверждения сдвига, если событий не приходит, мс.
 *
 * Пересчёт диапазона уходит в JS шагами по несколько пикселей, поэтому сдвиг
 * меньше шага не порождает ни одного события. Без страховки ожидание висело бы
 * до следующего скролла, а вместе с ним — блокировка порогов кромок.
 */
const CONFIRM_TIMEOUT_MS = 250;

/**
 * Очередь применённых, но ещё не подтверждённых сдвигов.
 *
 * Зачем нужна: между записью распорки и правкой `contentOffset` проходит
 * mount-транзакция, и события скролла, отправленные до неё, несут прежнее
 * смещение. Принять такое — значит откатить только что сделанный сдвиг и на
 * следующем проходе сделать его снова: на экране это дрожание и мигание ячеек
 * на кромках.
 *
 * Какую проблему решает: сдвигов подряд бывает несколько — вставка двигает по
 * оценочным размерам, а следующий кадр уточняет их измерением, — и нативный
 * слой применяет их по одному. Очередь сопоставляет каждое событие с ближайшей
 * из возможных промежуточных позиций и подтверждает сдвиги по очереди.
 */
export class ShiftQueue {
  /** Величины сдвигов в порядке применения. */
  private queue: number[] = [];
  /** Смещение до первого неподтверждённого сдвига. */
  private base = 0;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  /** Идёт компенсация: пороги кромок в это время проверять нельзя. */
  isSettling(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Поставить сдвиг в очередь.
   *
   * @param scroll смещение, от которого этот сдвиг отсчитывается. Для первого
   * сдвига в очереди оно и становится базой отсчёта.
   */
  push(applied: number, scroll: number): void {
    if (this.queue.length === 0) this.base = scroll;

    this.queue.push(applied);

    if (this.timeout) clearTimeout(this.timeout);

    this.timeout = setTimeout(() => {
      this.timeout = undefined;

      if (this.queue.length === 0) return;

      this.queue = [];
    }, CONFIRM_TIMEOUT_MS);
  }

  /**
   * Событие скролла отправлено до применения сдвига.
   *
   * Событие относится к ближайшей из возможных промежуточных позиций — от
   * прежнего смещения до полностью применённого. Всё, что до неё, считается
   * подтверждённым. Порогов здесь нет: при живом жесте смещение уезжает от всех
   * кандидатов одинаково, а разделяет их величина сдвигов.
   *
   * @returns true, если событие нужно отбросить.
   */
  isStale(offset: number): boolean {
    if (this.queue.length === 0) return false;

    let candidate = this.base;
    let bestDistance = Math.abs(offset - candidate);
    let confirmed = 0;
    let total = 0;

    for (let index = 0; index < this.queue.length; index++) {
      total += this.queue[index]!;
      candidate += this.queue[index]!;

      const distance = Math.abs(offset - candidate);

      if (distance >= bestDistance) continue;

      bestDistance = distance;
      confirmed = index + 1;
    }

    // Смещение ушло дальше любой из ожидаемых позиций — это уже не эхо сдвига,
    // а живой жест. Держать его за устаревшее — значит заморозить диапазон
    // отрисовки под пальцем.
    if (bestDistance > Math.abs(total)) {
      this.clear();
      this.base = offset;

      return false;
    }

    for (let index = 0; index < confirmed; index++) {
      this.base += this.queue[index]!;
    }

    this.queue = this.queue.slice(confirmed);

    if (this.queue.length === 0) {
      this.clear();

      return false;
    }

    return true;
  }

  /** Снять ожидания и таймер; применённые сдвиги при этом не отменяются. */
  clear(): void {
    this.queue = [];

    if (this.timeout) clearTimeout(this.timeout);

    this.timeout = undefined;
  }
}
