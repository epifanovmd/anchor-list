import { isOutsideThreshold } from "./edge-geometry";

/** Состояние, при котором кромка уже была объявлена достигнутой. */
export interface IEdgeSnapshot {
  atEdge: boolean;
  contentSize: number;
  dataLength: number;
}

/** Что изменилось в списке с прошлого срабатывания. */
export interface IEdgeLatchContext {
  contentSize: number;
  dataLength: number;
}

/**
 * Защёлка одной кромки.
 *
 * Зачем нужна: колбэк подгрузки обязан сработать один раз на вход в пороговую
 * зону. Событий скролла в этой зоне десятки в секунду, и без защёлки подгрузка
 * ушла бы столько же раз.
 *
 * Какие проблемы решает:
 * - снимается только после выхода за порог с запасом — дрожание у самой границы
 *   не считается новым входом;
 * - но срабатывает повторно, не дожидаясь выхода, если список реально
 *   изменился (`repeatOnChange`): подгруженная порция пришла, а до кромки
 *   по-прежнему близко — значит нужна следующая. Без этого короткая страница,
 *   не заполнившая экран, не догружалась без жеста, а срабатывание, которое
 *   потребитель пропустил (был занят), не повторялось вовсе.
 */
export class EdgeLatch {
  private reached = false;
  private snapshot: IEdgeSnapshot | undefined;

  /** Кромка уже сработала и до сброса больше не сработает. */
  isReached(): boolean {
    return this.reached;
  }

  /** Состояние на момент срабатывания; undefined — кромка не срабатывала. */
  getSnapshot(): IEdgeSnapshot | undefined {
    return this.snapshot;
  }

  /** Разрешить кромке сработать снова. */
  reset(): void {
    this.reached = false;
    this.snapshot = undefined;
  }

  /**
   * Проверить положение относительно порога и при необходимости сработать.
   *
   * @param distance расстояние до кромки.
   * @param atEdge кромка достигнута точно — порог тут ни при чём.
   * @param threshold порог в пикселях; 0 отключает кромку.
   * @param onReached вызывается ровно на переходах, а не на каждой проверке;
   * `repeat` — повтор по изменению списка, а не вход в зону.
   * @param repeatOnChange повторять срабатывание, когда список изменился, а
   * кромка по-прежнему в зоне. Решает вызывающий: у начала без удержания
   * позиции подгрузка сверху не уводит от кромки, и повтор там шёл бы до
   * конца истории подряд.
   */
  evaluate(
    distance: number,
    atEdge: boolean,
    threshold: number,
    context: IEdgeLatchContext,
    onReached: (distance: number, repeat: boolean) => void,
    repeatOnChange = false,
  ): void {
    const within = atEdge || (threshold > 0 && Math.abs(distance) <= threshold);
    const snapshot: IEdgeSnapshot = { atEdge, ...context };

    if (!this.reached) {
      if (!within) return;

      onReached(distance, false);
      this.reached = true;
      this.snapshot = snapshot;

      return;
    }

    if (isOutsideThreshold(distance, atEdge, threshold)) {
      this.reset();

      return;
    }

    if (!within) return;

    const previous = this.snapshot;
    const changed =
      !previous ||
      previous.atEdge !== atEdge ||
      previous.contentSize !== context.contentSize ||
      previous.dataLength !== context.dataLength;

    if (!changed) return;

    // Снимок обновляется и без повтора: иначе следующая проверка сочла бы
    // список изменившимся ещё раз.
    this.snapshot = snapshot;

    if (repeatOnChange) onReached(distance, true);
  }
}
