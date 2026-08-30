import { logViewChanged, logViewDrop, logViewHold } from "../../debug";
import type { ListMetrics } from "../../model";
import type {
  IAnchorListViewabilityPair,
  IAnchorListViewToken,
} from "../../types";
import type { IViewabilityContext } from "./viewability-window";
import { collectViewableKeys } from "./viewability-window";

/** Зависимости отслеживания видимости элементов. */
export interface IViewabilityOptions<TItem> {
  metrics: ListMetrics;
  getItem: (index: number) => TItem | undefined;
}

/** Состояние одной пары «конфиг + колбэк». */
interface IPairState {
  /** Ключи, о которых колбэк уже уведомлён. */
  viewableKeys: Set<string>;
  /** Ключи, ждущие выдержки `minimumViewTime`. */
  timers: Map<string, ReturnType<typeof setTimeout>>;
}

/**
 * Отслеживание видимости элементов.
 *
 * Зачем нужно: отметить сообщение прочитанным, догрузить картинку, запустить
 * видео — всё это привязано к тому, что элемент действительно на экране.
 *
 * Какие проблемы решает:
 * - уведомляет только об изменениях, а не о состоянии на каждом кадре: сам
 *   пересчёт идёт при каждом сдвиге диапазона, а колбэк наружу — только когда
 *   набор видимых элементов реально стал другим;
 * - `minimumViewTime` отсекает элементы, мелькнувшие при быстром скролле: если
 *   элемент ушёл до истечения выдержки, таймер снимается и колбэка не будет;
 * - каждая пара «условие — колбэк» ведётся отдельно: один и тот же элемент
 *   может быть видимым по одному порогу и невидимым по другому.
 */
export class ViewabilityTracker<TItem> {
  private readonly options: IViewabilityOptions<TItem>;

  private pairs: IAnchorListViewabilityPair<TItem>[] = [];
  private states = new Map<IAnchorListViewabilityPair<TItem>, IPairState>();

  constructor(options: IViewabilityOptions<TItem>) {
    this.options = options;
  }

  /** Пары сравниваются по ссылке: у выбывшей снимаются ожидающие таймеры. */
  setPairs(pairs: IAnchorListViewabilityPair<TItem>[] | undefined): void {
    const next = pairs ?? [];

    for (const pair of this.pairs) {
      if (next.includes(pair)) continue;

      this.clearTimers(pair);
      this.states.delete(pair);
    }

    this.pairs = next;
  }

  /** Есть ли подписчики: без них видимость не считается вовсе. */
  hasPairs(): boolean {
    return this.pairs.length > 0;
  }

  /** Пересчитать видимость и уведомить изменившиеся пары. */
  update(context: IViewabilityContext): void {
    for (const pair of this.pairs) {
      this.updatePair(pair, context);
    }
  }

  private updatePair(
    pair: IAnchorListViewabilityPair<TItem>,
    context: IViewabilityContext,
  ): void {
    const state = this.getState(pair);
    const { minimumViewTime } = pair.config;
    const nowViewable = collectViewableKeys(
      this.options.metrics,
      context,
      pair.config,
    );

    const entered = [...nowViewable].filter(
      key => !state.viewableKeys.has(key),
    );
    const exited = [...state.viewableKeys].filter(key => !nowViewable.has(key));

    // Элемент ушёл раньше выдержки — уведомления о нём не будет. Проверяются
    // именно ожидающие таймеры: о таком элементе ещё никто не знает, поэтому в
    // списке уже видимых его нет.
    for (const [key, timer] of state.timers) {
      if (nowViewable.has(key)) continue;

      clearTimeout(timer);
      state.timers.delete(key);
      logViewDrop({ key, pair: this.pairs.indexOf(pair) });
    }

    if (!minimumViewTime) {
      this.commit(pair, state, entered, exited);

      return;
    }

    for (const key of entered) {
      if (state.timers.has(key)) continue;

      logViewHold({
        key,
        pair: this.pairs.indexOf(pair),
        waitMs: minimumViewTime,
      });

      const timer = setTimeout(() => {
        state.timers.delete(key);
        this.commit(pair, state, [key], []);
      }, minimumViewTime);

      state.timers.set(key, timer);
    }

    // Об уходе сообщается сразу: выдержка — условие появления, а не исчезновения.
    this.commit(pair, state, [], exited);
  }

  private getState(pair: IAnchorListViewabilityPair<TItem>): IPairState {
    let state = this.states.get(pair);

    if (!state) {
      state = { viewableKeys: new Set(), timers: new Map() };
      this.states.set(pair, state);
    }

    return state;
  }

  private clearTimers(pair: IAnchorListViewabilityPair<TItem>): void {
    const state = this.states.get(pair);

    if (!state) return;

    for (const timer of state.timers.values()) clearTimeout(timer);

    state.timers.clear();
  }

  /** Применить изменения набора и позвать колбэк, если изменения есть. */
  private commit(
    pair: IAnchorListViewabilityPair<TItem>,
    state: IPairState,
    entered: string[],
    exited: string[],
  ): void {
    if (entered.length === 0 && exited.length === 0) return;

    for (const key of entered) state.viewableKeys.add(key);
    for (const key of exited) state.viewableKeys.delete(key);

    const changed: IAnchorListViewToken<TItem>[] = [
      ...entered.map(key => this.createToken(key, true)),
      ...exited.map(key => this.createToken(key, false)),
    ].filter(
      (token): token is IAnchorListViewToken<TItem> => token !== undefined,
    );

    logViewChanged({
      pair: this.pairs.indexOf(pair),
      entered,
      exited,
      viewable: state.viewableKeys.size,
    });

    const viewableItems = [...state.viewableKeys]
      .map(key => this.createToken(key, true))
      .filter(
        (token): token is IAnchorListViewToken<TItem> => token !== undefined,
      );

    pair.onViewableItemsChanged({ viewableItems, changed });
  }

  /** Токен наружу; `undefined` — элемент успел исчезнуть из данных. */
  private createToken(
    key: string,
    isViewable: boolean,
  ): IAnchorListViewToken<TItem> | undefined {
    const index = this.options.metrics.getIndexByKey(key);

    if (index === undefined) return undefined;

    const item = this.options.getItem(index);

    if (item === undefined) return undefined;

    return { item, key, index, isViewable };
  }

  /** Снятие таймеров при размонтировании списка. */
  dispose(): void {
    for (const pair of this.pairs) this.clearTimers(pair);

    this.states.clear();
  }
}
