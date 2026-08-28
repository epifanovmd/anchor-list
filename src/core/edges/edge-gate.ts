import type { ListEdge } from "./edge-geometry";

/**
 * Общий гейт обеих кромок.
 *
 * Зачем нужен: на коротком контенте начало и конец одновременно оказываются в
 * пороговой зоне, и подгрузка вверх и вниз выстреливают вместе. Пользователь
 * при этом двигался в одну сторону — вторая подгрузка ему не нужна.
 *
 * Какую проблему решает: после срабатывания одной кромки вторая молчит до
 * нового жеста, а направление жеста решает, какая из них разблокируется. Гейт
 * открывается сам, когда обе кромки далеко за порогами: держать его закрытым
 * посреди списка не от чего.
 */
export class EdgeGate {
  private state: "closed" | "prepared" | undefined;

  /** Гейт никого не держит: обе кромки свободны. */
  isOpen(): boolean {
    return !this.state;
  }

  /** Кромка сработала — вторая ждёт нового жеста. */
  close(): void {
    this.state = "closed";
  }

  /** Обе кромки далеко за порогами — держать больше некого. */
  open(): void {
    this.state = undefined;
  }

  /** Жест завершён: следующий позволит кромке сработать снова. */
  prepareForNextGesture(): void {
    if (this.state) this.state = "prepared";
  }

  /**
   * Начало жеста.
   *
   * @param scrollDelta направление движения: отрицательное — к началу списка.
   * @returns кромка, разблокированная этим жестом; `undefined` — гейт открыт
   * или ещё не готов, и разблокировать нечего.
   */
  beginGesture(scrollDelta: number): ListEdge | undefined {
    if (this.state !== "prepared") return undefined;

    const allowedEdge: ListEdge = scrollDelta < 0 ? "start" : "end";

    this.state = "closed";

    return allowedEdge;
  }

  /**
   * Можно ли отправить колбэк этой кромки.
   *
   * @param wasOpen гейт был открыт на входе в проверку. Проверка успевает
   * закрыть его сама — сработавшей ранее в том же проходе кромкой, — и без
   * этого флага вторая кромка потеряла бы законное право сработать.
   */
  canDispatch(
    edge: ListEdge,
    allowedEdge: ListEdge | undefined,
    wasOpen: boolean,
  ): boolean {
    return this.isOpen() || allowedEdge === edge || wasOpen;
  }
}
