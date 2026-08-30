import {
  edgesDebug,
  logEdgesBlocked,
  logEdgesReached,
  logEdgesReset,
  logEdgesState,
  logEdgesSuppressed,
} from "../../debug";
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

    if (allowedEdge !== undefined) {
      logEdgesReset({ edge: allowedEdge, cause: "жест", distance: undefined });
    }

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

    if (edgesDebug.enabled) {
      const thresholds = this.thresholds(context.scrollLength);

      logEdgesState({
        fromStart: geometry.distanceFromStart,
        fromEnd: geometry.distanceFromEnd,
        startAt: thresholds.startThreshold,
        endAt: thresholds.endThreshold,
        shorter: geometry.isContentShorter,
        skip: context.skipCallbacks,
      });
    }

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

    if (context.skipCallbacks) {
      this.reportSuppressed(
        "end",
        geometry.distanceFromEnd,
        geometry.isContentShorter,
        thresholds.endThreshold,
      );

      return;
    }

    this.endLatch.evaluate(
      geometry.distanceFromEnd,
      geometry.isContentShorter,
      thresholds.endThreshold,
      { contentSize: context.contentSize, dataLength: context.dataLength },
      distance => {
        if (!this.gate.canDispatch("end", allowedEdge, gateWasOpen)) {
          logEdgesBlocked({
            edge: "end",
            distance,
            cause: "гейт",
            allowed: allowedEdge,
          });

          return;
        }

        this.gate.close();
        logEdgesReached({
          edge: "end",
          distance,
          threshold: thresholds.endThreshold,
          allowed: allowedEdge,
        });
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

    if (context.skipCallbacks) {
      this.reportSuppressed(
        "start",
        geometry.distanceFromStart,
        false,
        startThreshold,
      );

      return;
    }

    this.startLatch.evaluate(
      geometry.distanceFromStart,
      false,
      startThreshold,
      { contentSize: context.contentSize, dataLength: context.dataLength },
      distance => {
        if (!this.gate.canDispatch("start", allowedEdge, gateWasOpen)) {
          logEdgesBlocked({
            edge: "start",
            distance,
            cause: "гейт",
            allowed: allowedEdge,
          });

          return;
        }

        this.gate.close();
        logEdgesReached({
          edge: "start",
          distance,
          threshold: startThreshold,
          allowed: allowedEdge,
        });
        this.options.onStartReached?.({ distanceFromStart: distance });
      },
    );
  }

  /**
   * Кромка в зоне, но колбэки подавлены своим движением списка.
   *
   * Печатается только когда до кромки действительно близко: сообщать о
   * подавлении там, где до кромки экран, значило бы залить лог на каждом
   * событии своего переезда.
   */
  private reportSuppressed(
    edge: ListEdge,
    distance: number,
    atEdge: boolean,
    threshold: number,
  ): void {
    if (!edgesDebug.enabled) return;

    const within = atEdge || (threshold > 0 && Math.abs(distance) <= threshold);

    if (!within) return;

    logEdgesSuppressed({ edge, distance, cause: "своё движение" });
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
      logEdgesReset({
        edge: "start",
        cause: "вырос",
        distance: context.scroll,
      });
    }
  }
}
