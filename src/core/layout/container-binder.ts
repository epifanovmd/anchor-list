import {
  layoutDebug,
  logLayoutBind,
  logLayoutRecycle,
  logStickyBind,
} from "../../debug";
import type {
  IAllocationResult,
  IContainerRequest,
  ListMetrics,
  ListStore,
} from "../../model";
import { ContainerPool, POSITION_OUT_OF_VIEW } from "../../model";
import { listPerf } from "../../perf";
import { resolveContainerPlacement } from "./container-placement";

/** Зависимости привязки контейнеров. */
export interface IContainerBinderOptions {
  store: ListStore;
  metrics: ListMetrics;
  pool: ContainerPool;
  getItem: (index: number) => unknown;
  itemsAreEqual?: (prev: unknown, next: unknown, index: number) => boolean;
  /** Предел смещения прилипшего элемента. */
  getStickyLimit: (index: number) => number | undefined;
}

/** Запрошенные строки и границы подрезки на текущем проходе. */
export interface IBindParams {
  requests: IContainerRequest[];
  /** Версия данных и геометрии; при совпадении можно обновить только clipping. */
  revision?: number;
  /** Границы, за которыми содержимое строки подрезается по её слоту. */
  clipTop: number;
  clipEnd: number;
}

/**
 * Привязка контейнеров к элементам и раскладка их позиций.
 *
 * Зачем нужна: контейнер — единица монтирования. Он переживает смену элемента,
 * меняя пропы вместо перемонтирования поддерева, и всё, что список сообщает
 * дереву о содержимом ячейки, уходит адресными сигналами именно его номера.
 *
 * Какие проблемы решает:
 * - **освобождённый контейнер уводится за пределы контента**, но только если он
 *   действительно остался без привязки: тот же контейнер мог тут же уйти под
 *   другой элемент, и уводить его тогда нельзя;
 * - **сигналы пишутся для всех запрошенных элементов**, а не только для
 *   сменивших привязку. Элемент может остаться на своём месте с новым объектом
 *   данных — так приходит правка сообщения, — и ячейка обязана его увидеть.
 *   Стор сравнивает значения по ссылке, поэтому лишних перерисовок это не даёт.
 */
export class ContainerBinder {
  private readonly options: IContainerBinderOptions;
  private previousRequests: IContainerRequest[] = [];
  private previousRevision = -1;

  constructor(options: IContainerBinderOptions) {
    this.options = options;
  }

  /**
   * Разложить запрошенные элементы по контейнерам и опубликовать сигналы.
   *
   * @returns что сделал пул — по этим числам видно, хватает ли ему контейнеров.
   */
  bind({
    requests,
    revision,
    clipTop,
    clipEnd,
  }: IBindParams): IAllocationResult {
    const { store, pool } = this.options;

    if (
      revision !== undefined &&
      revision === this.previousRevision &&
      this.haveSameRequests(requests, this.previousRequests)
    ) {
      listPerf.count("bindSkipped");
      this.updateClipping(requests, clipTop, clipEnd);

      const cached = { changed: [], released: [], count: pool.getCount() };

      if (layoutDebug.enabled) this.reportBind(requests, cached, 0, true);

      return cached;
    }

    const containersBefore = pool.getCount();
    const allocation = pool.allocate(requests);
    const { released, count } = allocation;

    if (listPerf.enabled) {
      listPerf.count("rebind", allocation.changed.length);
      listPerf.count("release", released.length);
      listPerf.count("containerNew", count - containersBefore);
    }

    for (const id of released) {
      if (pool.getBinding(id) !== undefined) continue;

      store.set(`containerPosition${id}`, POSITION_OUT_OF_VIEW);
      store.set(`containerSticky${id}`, null);
    }

    for (const request of requests) {
      const id = pool.getContainerByKey(request.key);

      if (id === undefined) continue;

      this.publish(id, request, clipTop, clipEnd);
    }

    store.set("numContainers", count);
    this.previousRequests = requests.map(request => ({ ...request }));
    this.previousRevision = revision ?? -1;

    if (layoutDebug.enabled) {
      this.reportBind(requests, allocation, released.length, false);
    }

    return allocation;
  }

  /** Все контейнеры остаются без элементов — список опустел. */
  releaseAll(): void {
    const { store, pool } = this.options;
    const { released, count } = pool.allocate([]);

    for (const id of released) {
      store.set(`containerPosition${id}`, POSITION_OUT_OF_VIEW);
    }

    store.set("numContainers", count);
    this.previousRequests = [];
    this.previousRevision = -1;
  }

  /**
   * Что сделала раздача — для диагностики.
   *
   * Перепривязки печатаются отдельной строкой на контейнер: по ним видно, попал
   * ли новый элемент в контейнер того же типа. Промах по типу означает
   * перемонтирование поддерева — самый дорогой случай смены элемента.
   */
  private reportBind(
    requests: IContainerRequest[],
    allocation: IAllocationResult,
    released: number,
    cached: boolean,
  ): void {
    logLayoutBind({
      requests: requests.length,
      containers: allocation.count,
      rebound: allocation.changed.length,
      released,
      pinned: requests.filter(request => request.stickyEdge !== null).length,
      cached,
    });

    for (const binding of allocation.changed) {
      // Привязка, не сменившая элемент, переработкой не является: у неё
      // поменялись индекс или роль, а поддерево осталось на месте. Новый
      // контейнер — тем более: переиспользовать было нечего, и первая раздача
      // иначе печатала бы строку на каждый контейнер списка.
      if (
        binding.previousKey === undefined ||
        binding.previousKey === binding.key
      ) {
        continue;
      }

      logLayoutRecycle({
        container: binding.id,
        from: binding.previousKey,
        to: binding.key,
        type: binding.type,
        sameType:
          binding.previousType === undefined
            ? undefined
            : binding.previousType === binding.type,
      });
    }
  }

  /** Сигналы одного контейнера. */
  private publish(
    id: number,
    request: IContainerRequest,
    clipTop: number,
    clipEnd: number,
  ): void {
    const { store, metrics, getItem, getStickyLimit } = this.options;
    const placement = resolveContainerPlacement({
      pending: metrics.isPending(request.key),
      stickyEdge: request.stickyEdge,
      position: metrics.getPosition(request.index),
      size: metrics.getSize(request.index),
      viewportTop: clipTop,
      viewportEnd: clipEnd,
    });

    const previousPosition = store.peek(`containerPosition${id}`);

    store.set(`containerClipped${id}`, placement.clipped);
    store.set(`containerItemKey${id}`, request.key);
    store.set(`containerItemIndex${id}`, request.index);
    const nextItem = getItem(request.index);
    const previousItem = store.peek(`containerItemData${id}`);

    if (
      previousItem !== nextItem &&
      !(
        previousItem !== undefined &&
        nextItem !== undefined &&
        this.options.itemsAreEqual?.(previousItem, nextItem, request.index)
      )
    ) {
      store.set(`containerItemData${id}`, nextItem);
    }
    store.set(`containerPosition${id}`, placement.position);
    store.set(`containerItemType${id}`, request.type);
    store.set(`containerItemSize${id}`, placement.size);
    store.set(`containerSticky${id}`, request.stickyEdge);

    const stickyLimit = request.stickyEdge
      ? getStickyLimit(request.index)
      : undefined;

    store.set(`containerStickyLimit${id}`, stickyLimit);

    if (request.stickyEdge) {
      logStickyBind({
        index: request.index,
        container: id,
        edge: request.stickyEdge,
        position: placement.position,
        size: placement.size,
        limit: stickyLimit,
        clipped: placement.clipped,
      });
    }
    if (previousPosition !== placement.position) {
      store.notifyPosition(request.key, placement.position);
    }
  }

  private updateClipping(
    requests: IContainerRequest[],
    clipTop: number,
    clipEnd: number,
  ): void {
    const { store, pool, metrics } = this.options;

    for (const request of requests) {
      const id = pool.getContainerByKey(request.key);

      if (id === undefined) continue;

      const placement = resolveContainerPlacement({
        pending: metrics.isPending(request.key),
        stickyEdge: request.stickyEdge,
        position: metrics.getPosition(request.index),
        size: metrics.getSize(request.index),
        viewportTop: clipTop,
        viewportEnd: clipEnd,
      });

      store.set(`containerClipped${id}`, placement.clipped);
    }
  }

  private haveSameRequests(
    current: IContainerRequest[],
    previous: IContainerRequest[],
  ): boolean {
    if (current.length !== previous.length) return false;

    return current.every((request, index) => {
      const before = previous[index];

      return (
        before?.key === request.key &&
        before.index === request.index &&
        before.type === request.type &&
        before.stickyEdge === request.stickyEdge
      );
    });
  }
}
