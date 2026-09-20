import { logScrollHighlight, scrollDebug } from "../../debug";
import type { IAnchorListHighlightState, ListStore } from "../../model";
import type { AnchorListHighlight } from "../../types";
import type { IAnchorListRange } from "../layout";

/** Сколько держать подсветку после появления по умолчанию, мс. */
const DEFAULT_DURATION_MS = 1200;
/** Плавность появления и угасания по умолчанию, мс. */
const DEFAULT_FADE_MS = 200;

/** Зависимости подсветки. */
export interface IItemHighlightOptions {
  store: ListStore;
  getIndexByKey: (key: string) => number | undefined;
  /** Текущий диапазон: подсветка ждёт, пока цель не окажется в видимой части. */
  getRange: () => IAnchorListRange;
}

/** Просьба, ждущая появления строки на экране. */
interface IPendingHighlight {
  key: string;
  duration: number;
  fade: number;
}

/**
 * Подсветка строки после перехода к ней.
 *
 * Зачем нужна: «перейти к цитате» без подсветки — это прыжок, после которого
 * пользователь ищет глазами, куда его привели. Подсветка показывает цель.
 *
 * Какую проблему решает: момент. Подсветить в вызове `scrollToKey` нельзя —
 * анимированный переезд занимает сотни миллисекунд, и к появлению строки
 * подсветка уже угасла бы. Здесь просьба ждёт, пока строка не окажется в
 * видимом диапазоне, и только тогда уходит ячейке сигналом. Строка, которая
 * уже на экране, подсвечивается сразу.
 *
 * Сама подсветка — дело ячейки: сигнал несёт только ключ и длительности, а
 * что менять — фон, рамку, масштаб — решает `useAnchorListItemHighlight` в
 * строке. Список не знает, как выглядит его строка, и навязывать ей стиль
 * не должен.
 */
export class ItemHighlight {
  private readonly options: IItemHighlightOptions;

  private pending: IPendingHighlight | undefined;
  /** Таймер снятия горящей подсветки. */
  private clearTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Номер подсветки: каждая просьба — новый объект сигнала.
   *
   * Ячейка узнаёт о подсветке по смене объекта; повторный переход к той же
   * строке с тем же объектом её бы не разбудил.
   */
  private seq = 0;

  constructor(options: IItemHighlightOptions) {
    this.options = options;
  }

  /**
   * Попросить подсветить строку.
   *
   * Строка на экране подсвечивается сразу, остальные — когда доедут:
   * см. {@link check}.
   *
   * @returns false — просьбы нет (`highlight` не задан) или ключа нет в данных.
   */
  request(key: string, highlight: AnchorListHighlight | undefined): boolean {
    if (!highlight) return false;
    if (this.options.getIndexByKey(key) === undefined) return false;

    const options = highlight === true ? {} : highlight;

    this.pending = {
      key,
      duration: options.duration ?? DEFAULT_DURATION_MS,
      fade: options.fade ?? DEFAULT_FADE_MS,
    };
    this.check();

    return true;
  }

  /**
   * Проверить, доехала ли ожидающая цель до экрана.
   *
   * Вызывается после каждого прохода раскладки: видимый диапазон — итог
   * прохода, и раньше него о положении строки судить не по чему. Видимая
   * часть, а не буфер: строка в буфере смонтирована, но за кадром, и
   * подсветка на ней сгорела бы невидимой.
   */
  check(): void {
    const pending = this.pending;

    if (!pending) return;

    const index = this.options.getIndexByKey(pending.key);

    if (index === undefined) {
      // Строку удалили, пока к ней ехали: ждать больше нечего.
      this.pending = undefined;

      return;
    }

    const range = this.options.getRange();

    if (index < range.start || index > range.end) {
      this.report(pending.key, "ждёт", index, range);

      return;
    }

    this.pending = undefined;
    this.fire(pending);
    this.report(pending.key, "горит", index, range);
  }

  /**
   * Жест пользователя: ожидающая подсветка снимается, горящая — нет.
   *
   * Перехваченный пальцем переезд до цели не доедет, и подсвечивать её,
   * когда она мелькнёт в кадре, незачем. А горящая подсветка стоит на строке,
   * на которую пользователь смотрит, — её жест не касается.
   */
  cancel(): void {
    if (this.pending) this.report(this.pending.key, "отменена");

    this.pending = undefined;
  }

  /** Погасить подсветку и забыть ожидающую. */
  clear(): void {
    const burning = this.options.store.peek("highlight");

    if (burning) this.report(burning.key, "снята");

    this.pending = undefined;
    this.clearTimer_();
    this.options.store.set("highlight", null);
  }

  /** Снятие таймеров при размонтировании списка. */
  dispose(): void {
    this.pending = undefined;
    this.clearTimer_();
  }

  private fire({ key, duration, fade }: IPendingHighlight): void {
    this.clearTimer_();
    this.seq += 1;

    const state: IAnchorListHighlightState = {
      key,
      duration,
      fade,
      seq: this.seq,
    };

    this.options.store.set("highlight", state);

    // Сигнал снимается, когда подсветка догорела: иначе строка, ушедшая за
    // кадр и вернувшаяся в другой контейнер, загорелась бы снова.
    this.clearTimer = setTimeout(
      () => {
        this.clearTimer = undefined;
        this.options.store.set("highlight", null);
      },
      fade + duration + fade,
    );
  }

  private report(
    key: string,
    state: string,
    index?: number,
    range?: IAnchorListRange,
  ): void {
    if (!scrollDebug.enabled) return;

    logScrollHighlight({
      key,
      state,
      index: index ?? this.options.getIndexByKey(key),
      visible: range === undefined ? undefined : `${range.start}..${range.end}`,
    });
  }

  private clearTimer_(): void {
    if (this.clearTimer === undefined) return;

    clearTimeout(this.clearTimer);
    this.clearTimer = undefined;
  }
}
