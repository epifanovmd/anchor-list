import type { AnchorListSignalMap, AnchorListSignalName } from "./list-signals";
import { INITIAL_SIGNALS } from "./list-signals";

type Listener<TName extends AnchorListSignalName> = (
  value: AnchorListSignalMap[TName],
) => void;

/**
 * Хранилище сигналов списка.
 *
 * Зачем нужно: расчёт диапазона, позиций и привязки контейнеров идёт вне React
 * — на каждом кадре скролла и на каждом измерении ячейки. Гонять это через
 * состояние компонентов значит перерисовывать список целиком там, где на экране
 * сместилась одна строка.
 *
 * Какую проблему решает: значения читаются синхронно из расчётного цикла
 * ({@link peek}) и подписываются точечно из компонентов ({@link listen}).
 * Запись без изменения значения никого не будит — сравнение по ссылке отсекает
 * повторы, которых при пересчёте раскладки большинство.
 */
export class ListStore {
  private readonly values = new Map<string, unknown>(
    Object.entries(INITIAL_SIGNALS),
  );
  private readonly listeners = new Map<string, Set<(value: never) => void>>();
  /** Подписки на позицию элемента по ключу — переживают смену контейнера. */
  private readonly positionListeners = new Map<
    string,
    Set<(value: number) => void>
  >();
  /** Глубина атомарной публикации; вложенные проходы входят в ту же пачку. */
  private batchDepth = 0;
  /** Последнее значение каждого изменённого сигнала текущей пачки. */
  private readonly pendingSignals = new Map<AnchorListSignalName, unknown>();
  /** Последняя позиция каждого ключа текущей пачки. */
  private readonly pendingPositions = new Map<string, number>();

  /** Текущее значение без подписки — для расчётного цикла. */
  peek<TName extends AnchorListSignalName>(
    name: TName,
  ): AnchorListSignalMap[TName] | undefined {
    return this.values.get(name) as AnchorListSignalMap[TName] | undefined;
  }

  /** Записать значение и уведомить подписчиков, если оно изменилось. */
  set<TName extends AnchorListSignalName>(
    name: TName,
    value: AnchorListSignalMap[TName],
  ): void {
    if (this.values.get(name) === value) return;

    this.values.set(name, value);

    if (this.batchDepth > 0) {
      this.pendingSignals.set(name, value);

      return;
    }

    this.notifySignal(name, value);
  }

  /**
   * Атомарно опубликовать несколько связанных сигналов.
   *
   * Значения доступны ядру через {@link peek} сразу, но React-подписчики
   * просыпаются только после последней записи. Поэтому позиции контейнеров и
   * компенсирующий `scrollAdjust` не могут попасть в разные снимки экрана.
   */
  batch<T>(run: () => T): T {
    this.batchDepth += 1;

    try {
      return run();
    } finally {
      this.batchDepth -= 1;

      if (this.batchDepth === 0) this.flushPending();
    }
  }

  private notifySignal<TName extends AnchorListSignalName>(
    name: TName,
    value: AnchorListSignalMap[TName],
  ): void {
    const listeners = this.listeners.get(name);

    if (!listeners) return;

    for (const listener of listeners) {
      (listener as Listener<TName>)(value);
    }
  }

  /** @returns функция отписки. */
  listen<TName extends AnchorListSignalName>(
    name: TName,
    listener: Listener<TName>,
  ): () => void {
    let listeners = this.listeners.get(name);

    if (!listeners) {
      listeners = new Set();
      this.listeners.set(name, listeners);
    }

    listeners.add(listener as (value: never) => void);

    return () => {
      listeners.delete(listener as (value: never) => void);
      if (listeners.size === 0) this.listeners.delete(name);
    };
  }

  /**
   * Подписка на позицию элемента по его ключу.
   *
   * Отдельно от сигналов контейнера: контейнер под элементом меняется при
   * переиспользовании, а ключ — нет. Тому, кто следит за конкретным элементом,
   * подписка по контейнеру не годится.
   */
  listenPosition(key: string, listener: (value: number) => void): () => void {
    let listeners = this.positionListeners.get(key);

    if (!listeners) {
      listeners = new Set();
      this.positionListeners.set(key, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.positionListeners.delete(key);
    };
  }

  /** Сообщить подписчикам ключа его новую позицию. */
  notifyPosition(key: string, value: number): void {
    if (this.batchDepth > 0) {
      this.pendingPositions.set(key, value);

      return;
    }

    this.notifyPositionNow(key, value);
  }

  private notifyPositionNow(key: string, value: number): void {
    const listeners = this.positionListeners.get(key);

    if (!listeners) return;

    for (const listener of listeners) {
      listener(value);
    }
  }

  /** Разбудить подписчиков уже после того, как весь снимок стал согласованным. */
  private flushPending(): void {
    // Уведомления сами могут записать сигнал. Считаем их продолжением той же
    // транзакции и выпускаем следующей волной, а не посреди текущей.
    while (this.pendingSignals.size > 0 || this.pendingPositions.size > 0) {
      const signals = [...this.pendingSignals.entries()];
      const positions = [...this.pendingPositions.entries()];

      this.pendingSignals.clear();
      this.pendingPositions.clear();
      this.batchDepth += 1;

      try {
        for (const [name, value] of signals) {
          this.notifySignal(name, value as never);
        }
        for (const [key, value] of positions) {
          this.notifyPositionNow(key, value);
        }
      } finally {
        this.batchDepth -= 1;
      }
    }
  }
}
