import type { AnchorListStickyEdge } from "../types";

/** Запрос на отрисовку элемента в контейнере. */
export interface IContainerRequest {
  index: number;
  key: string;
  type: string;
  /** Кромка, к которой элемент прилипает; null — обычный элемент. */
  stickyEdge: AnchorListStickyEdge | null;
}

/** Привязка контейнера к элементу. */
export interface IContainerBinding {
  id: number;
  key: string;
  index: number;
  type: string;
  stickyEdge: AnchorListStickyEdge | null;
  /**
   * Что было в этом контейнере до привязки; undefined — контейнер новый.
   *
   * Нужно диагностике: по паре «было — стало» видно, попал ли элемент в
   * контейнер того же типа. Промах по типу означает перемонтирование
   * поддерева — самую дорогую смену элемента, и по логу её ни с чем не спутать.
   */
  previousKey?: string;
  previousType?: string;
}

/** Изменение привязок после `allocate`. */
export interface IAllocationResult {
  /** Контейнеры, сменившие элемент: их поддерево нужно перерисовать. */
  changed: IContainerBinding[];
  /** Контейнеры, оставшиеся без элемента. */
  released: number[];
  /** Сколько контейнеров существует после аллокации. */
  count: number;
}

/**
 * Пул контейнеров.
 *
 * Контейнер — единица монтирования: он переживает смену элемента, меняя пропы
 * вместо перемонтирования поддерева. Свободный контейнер того же типа
 * предпочтительнее любого другого — попадание по типу означает совпадающую
 * структуру поддерева.
 *
 * Прилипающие контейнеры живут отдельно: их держат смонтированными и за
 * пределами видимого диапазона, поэтому под обычные элементы они не уходят.
 */
export class ContainerPool {
  private bindings = new Map<number, IContainerBinding>();
  private containerByKey = new Map<string, number>();
  private free: number[] = [];
  /** Тип последнего элемента контейнера — по нему ищется совпадение при переиспользовании. */
  private lastTypeById = new Map<number, string>();
  /** Ключ последнего элемента контейнера — печатается диагностикой переработки. */
  private lastKeyById = new Map<number, string>();
  /** Sticky и обычные контейнеры имеют разную React/Reanimated-структуру. */
  private lastStickyEdgeById = new Map<number, AnchorListStickyEdge | null>();
  private nextId = 0;

  /** К какому элементу привязан контейнер; undefined — свободен. */
  getBinding(id: number): IContainerBinding | undefined {
    return this.bindings.get(id);
  }

  /** Контейнер под элементом; undefined — элемент не отрисован. */
  getContainerByKey(key: string): number | undefined {
    return this.containerByKey.get(key);
  }

  /** Сколько контейнеров создано за всё время: столько их и смонтировано. */
  getCount(): number {
    return this.nextId;
  }

  /** Привязать контейнеры к запрошенному набору элементов. */
  allocate(requests: IContainerRequest[]): IAllocationResult {
    const requestedKeys = new Set(requests.map(request => request.key));
    const released = this.releaseUnrequested(requestedKeys);
    const changed: IContainerBinding[] = [];

    for (const request of requests) {
      const existingId = this.containerByKey.get(request.key);

      if (existingId !== undefined) {
        const binding = this.bindings.get(existingId)!;

        if (
          binding.index === request.index &&
          binding.stickyEdge === request.stickyEdge
        ) {
          continue;
        }

        binding.index = request.index;
        binding.stickyEdge = request.stickyEdge;
        this.lastStickyEdgeById.set(existingId, request.stickyEdge);
        // Элемент тот же, сменились индекс или роль: содержимое контейнера не
        // перерабатывается, и «было» здесь равно «стало» — иначе диагностика
        // считала бы такую привязку переработкой и указывала на давно ушедший
        // элемент.
        changed.push({
          ...binding,
          previousKey: binding.key,
          previousType: binding.type,
        });
        continue;
      }

      changed.push(this.bind(request));
    }

    return { changed, released, count: this.nextId };
  }

  private releaseUnrequested(requestedKeys: Set<string>): number[] {
    const released: number[] = [];

    for (const [key, id] of this.containerByKey) {
      if (requestedKeys.has(key)) continue;

      this.containerByKey.delete(key);
      this.bindings.delete(id);
      this.free.push(id);
      released.push(id);
    }

    return released;
  }

  private bind(request: IContainerRequest): IContainerBinding {
    const { id, previousType } = this.take(request.type, request.stickyEdge);
    const binding: IContainerBinding = {
      id,
      key: request.key,
      index: request.index,
      type: request.type,
      stickyEdge: request.stickyEdge,
      previousKey: this.lastKeyById.get(id),
      previousType,
    };

    this.bindings.set(id, binding);
    this.containerByKey.set(request.key, id);
    this.lastKeyById.set(id, request.key);

    return { ...binding };
  }

  /**
   * Свободный контейнер того же типа, иначе любой свободный, иначе новый.
   *
   * Возвращает вместе с номером тип, который в контейнере был: узнать его после
   * выбора уже нельзя — выбор его и перезаписывает, — а диагностике переработки
   * нужна именно пара «было — стало».
   */
  private take(
    type: string,
    stickyEdge: AnchorListStickyEdge | null,
  ): { id: number; previousType: string | undefined } {
    for (let i = this.free.length - 1; i >= 0; i--) {
      const id = this.free[i]!;

      if (
        this.lastTypeById.get(id) === type &&
        this.lastStickyEdgeById.get(id) === stickyEdge
      ) {
        this.free.splice(i, 1);

        return { id, previousType: type };
      }
    }

    // Тип можно сменить внутри той же структуры, а sticky-роль — нет: переход
    // между View и Animated.View перемонтировал бы перерабатываемое содержимое.
    let compatibleIndex = -1;

    for (let i = this.free.length - 1; i >= 0; i--) {
      if (this.lastStickyEdgeById.get(this.free[i]!) === stickyEdge) {
        compatibleIndex = i;
        break;
      }
    }
    const anyFree =
      compatibleIndex === -1
        ? undefined
        : this.free.splice(compatibleIndex, 1)[0];

    if (anyFree !== undefined) {
      const previousType = this.lastTypeById.get(anyFree);

      this.lastTypeById.set(anyFree, type);

      return { id: anyFree, previousType };
    }

    const id = this.nextId++;

    this.lastTypeById.set(id, type);
    this.lastStickyEdgeById.set(id, stickyEdge);

    return { id, previousType: undefined };
  }

  /** Полный сброс — при структурной смене данных, когда ключи не пересекаются. */
  reset(): void {
    this.bindings.clear();
    this.containerByKey.clear();
    this.free = [];
    for (let id = 0; id < this.nextId; id++) {
      this.free.push(id);
    }
  }
}
