import type { ListStore } from "../../model";
import { EdgeGate } from "./edge-gate";
import type { IEdgeCheckContext, ListEdge } from "./edge-geometry";
import { getEdgeGeometry, isOutsideThreshold } from "./edge-geometry";
import { EdgeLatch } from "./edge-latch";
import { publishEndSignals, publishStartSignals } from "./edge-signals";

/** Настройки порогов кромок: доли вьюпорта и обработчики подгрузки. */
export interface IEdgeThresholdsOptions {
  store: ListStore;
  /** Доли длины вьюпорта. */
  startThreshold: number;
  endThreshold: number;
  /** Порог, в пределах которого список считается прижатым к концу. */
  maintainScrollAtEndThreshold: number;
  onStartReached?: (info: { distanceFromStart: number }) => void;
  onEndReached?: (info: { distanceFromEnd: number }) => void;
}

/**
 * Пороги достижения начала и конца списка.
 *
 * Зачем нужны: подгрузка обязана начаться заранее — за экран до кромки, — иначе
 * пользователь упрётся в конец и увидит пустоту. И ровно один раз: сеть на
 * каждое событие скролла не рассчитана.
 *
 * Как устроено — три независимые части:
 * - {@link getEdgeGeometry} считает расстояния до кромок;
 * - {@link publishEndSignals}/{@link publishStartSignals} публикуют состояние
 *   в сигналы, независимо от того, подавлены колбэки или нет;
 * - {@link EdgeLatch} на каждую кромку решает, было ли это входом в зону, а
 *   общий {@link EdgeGate} не даёт двум кромкам сработать одновременно.
 */
export class EdgeThresholds {
  private options: IEdgeThresholdsOptions;

  private readonly startLatch = new EdgeLatch();
  private readonly endLatch = new EdgeLatch();
  private readonly gate = new EdgeGate();

  constructor(options: IEdgeThresholdsOptions) {
    this.options = options;
  }

  /** Новые пороги и обработчики: список пересоздаёт их на каждом рендере. */
  setOptions(options: IEdgeThresholdsOptions): void {
    this.options = options;
  }

  /** Жест завершён: следующий позволит кромке сработать снова. */
  prepareForNextGesture(): void {
    this.gate.prepareForNextGesture();
  }

  /** Начало жеста; направление решает, какая кромка разблокируется. */
  beginGesture(scrollDelta: number): ListEdge | undefined {
    const allowedEdge = this.gate.beginGesture(scrollDelta);

    if (allowedEdge === "start") this.startLatch.reset();
    if (allowedEdge === "end") this.endLatch.reset();

    return allowedEdge;
  }

  /**
   * Проверка порогов на текущей позиции.
   *
   * @param allowedEdge кромка, разблокированная текущим жестом.
   */
  check(context: IEdgeCheckContext, allowedEdge?: ListEdge): void {
    const gateWasOpen = this.gate.isOpen();
    const geometry = getEdgeGeometry(context);

    this.openGateIfOutside(context, geometry);
    this.checkEnd(context, geometry, allowedEdge, gateWasOpen);
    this.checkStart(context, geometry, allowedEdge, gateWasOpen);
  }

  /** Пороги в пикселях: доля вьюпорта разворачивается в расстояние. */
  private thresholds(scrollLength: number) {
    const { startThreshold, endThreshold, maintainScrollAtEndThreshold } =
      this.options;

    return {
      startThreshold: startThreshold * scrollLength,
      endThreshold: endThreshold * scrollLength,
      maintainScrollAtEndThreshold: maintainScrollAtEndThreshold * scrollLength,
    };
  }

  /** Оба конца далеко за порогами — общий гейт больше никого не держит. */
  private openGateIfOutside(
    context: IEdgeCheckContext,
    geometry: ReturnType<typeof getEdgeGeometry>,
  ): void {
    if (this.gate.isOpen()) return;

    const { startThreshold, endThreshold } = this.thresholds(
      context.scrollLength,
    );

    const outsideStart = isOutsideThreshold(
      geometry.distanceFromStart,
      false,
      startThreshold,
    );
    const outsideEnd = isOutsideThreshold(
      geometry.distanceFromEnd,
      geometry.isContentShorter,
      endThreshold,
    );

    if (outsideStart && outsideEnd) this.gate.open();
  }

  private checkEnd(
    context: IEdgeCheckContext,
    geometry: ReturnType<typeof getEdgeGeometry>,
    allowedEdge: ListEdge | undefined,
    gateWasOpen: boolean,
  ): void {
    // Высоты контента ещё нет — считать расстояние до конца не от чего.
    if (context.contentSize <= 0) return;

    const thresholds = this.thresholds(context.scrollLength);

    publishEndSignals(this.options.store, geometry, thresholds);

    if (context.skipCallbacks) return;

    this.endLatch.evaluate(
      geometry.distanceFromEnd,
      geometry.isContentShorter,
      thresholds.endThreshold,
      { contentSize: context.contentSize, dataLength: context.dataLength },
      distance => {
        if (!this.gate.canDispatch("end", allowedEdge, gateWasOpen)) return;

        this.gate.close();
        this.options.onEndReached?.({ distanceFromEnd: distance });
      },
    );
  }

  private checkStart(
    context: IEdgeCheckContext,
    geometry: ReturnType<typeof getEdgeGeometry>,
    allowedEdge: ListEdge | undefined,
    gateWasOpen: boolean,
  ): void {
    const thresholds = this.thresholds(context.scrollLength);
    const { startThreshold } = thresholds;

    publishStartSignals(this.options.store, geometry, thresholds);

    this.resetStartLatchIfContentGrew(context, startThreshold);

    if (context.skipCallbacks) return;

    this.startLatch.evaluate(
      geometry.distanceFromStart,
      false,
      startThreshold,
      { contentSize: context.contentSize, dataLength: context.dataLength },
      distance => {
        if (!this.gate.canDispatch("start", allowedEdge, gateWasOpen)) return;

        this.gate.close();
        this.options.onStartReached?.({ distanceFromStart: distance });
      },
    );
  }

  /**
   * Список вырос выше текущей позиции — прежнее «начало достигнуто» устарело.
   *
   * Подгрузка сверху удерживает позицию, поэтому расстояние до начала после неё
   * не меняется, и обычного выхода за порог не происходит. Без этого сброса
   * вторая порция истории не подгрузилась бы никогда.
   */
  private resetStartLatchIfContentGrew(
    context: IEdgeCheckContext,
    threshold: number,
  ): void {
    const snapshot = this.startLatch.getSnapshot();
    const contentGrew =
      snapshot !== undefined &&
      (snapshot.contentSize !== context.contentSize ||
        snapshot.dataLength !== context.dataLength);

    if (
      this.startLatch.isReached() &&
      threshold > 0 &&
      context.scroll > threshold &&
      contentGrew
    ) {
      this.startLatch.reset();
    }
  }
}
