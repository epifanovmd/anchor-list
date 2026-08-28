import type { AnchorListSignalMap, AnchorListSignalName } from "./list-signals";
import type { ListStore } from "./list-store";

type Listener<TName extends AnchorListSignalName> = (
  value: AnchorListSignalMap[TName] | undefined,
) => void;

/**
 * Доступ к состоянию списка снаружи его дерева.
 *
 * Зачем нужен: стор списка живёт внутри и раздаётся по контексту — соседнему
 * компоненту, кнопке над списком или экрану он недоступен. А списка на первом
 * рендере ещё нет вовсе, поэтому подписаться «на его стор» просто неоткуда.
 *
 * Какую проблему решает: держит подписки до того, как список смонтируется, и
 * перевешивает их на его стор, когда тот появится. Подписка адресная — на одно
 * имя сигнала, — поэтому перерисовывается только тот, чьё значение изменилось.
 *
 * Для анимаций это не нужно: там {@link IAnchorListSharedValues} отдаёт то же самое
 * на UI-поток без единого рендера. Сюда стоит идти, только когда значение
 * действительно нужно в React — числом на экране, флагом в пропе.
 */
export class AnchorListState {
  private store: ListStore | undefined;
  private readonly listeners = new Map<string, Set<(value: never) => void>>();
  /** Отписки от стора — по одной на имя, а не на слушателя. */
  private readonly bindings = new Map<string, () => void>();

  /**
   * Привязка к смонтированному списку.
   *
   * @returns функция отвязки; вызывать при размонтировании списка.
   */
  attach(store: ListStore): () => void {
    if (this.store !== store) {
      this.unbindAll();
      this.store = store;

      for (const name of this.listeners.keys()) {
        this.bind(name as AnchorListSignalName);
        // Значения появились разом: подписчики обязаны узнать о них, иначе
        // останутся с пустотой до первого изменения.
        this.emit(name, store.peek(name as AnchorListSignalName));
      }
    }

    return () => this.detach(store);
  }

  /** Текущее значение; `undefined` — список ещё не смонтирован. */
  peek<TName extends AnchorListSignalName>(
    name: TName,
  ): AnchorListSignalMap[TName] | undefined {
    return this.store?.peek(name);
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
      this.bind(name);
    }

    listeners.add(listener as (value: never) => void);

    return () => {
      listeners.delete(listener as (value: never) => void);

      if (listeners.size > 0) return;

      // Последний слушатель ушёл — держать подписку на стор больше незачем.
      this.listeners.delete(name);
      this.bindings.get(name)?.();
      this.bindings.delete(name);
    };
  }

  private detach(store: ListStore): void {
    if (this.store !== store) return;

    this.unbindAll();
    this.store = undefined;
  }

  private bind(name: AnchorListSignalName): void {
    const store = this.store;

    if (!store || this.bindings.has(name)) return;

    this.bindings.set(
      name,
      store.listen(name, value => this.emit(name, value)),
    );
  }

  private unbindAll(): void {
    for (const unbind of this.bindings.values()) unbind();

    this.bindings.clear();
  }

  private emit(name: string, value: unknown): void {
    const listeners = this.listeners.get(name);

    if (!listeners) return;

    for (const listener of listeners) {
      (listener as (value: unknown) => void)(value);
    }
  }
}
