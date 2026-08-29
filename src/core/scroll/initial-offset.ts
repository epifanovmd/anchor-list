import type { ListMetrics } from "../../model";

/**
 * Насколько цель должна сдвинуться, чтобы считаться уехавшей, px.
 *
 * Нативное смещение приходит квантованным — на экране 3× это трети точки, — и
 * доводка на таких долях гоняется за движением, которого не видно, тратя на
 * него кадры до первого показа списка. Полточки: больше кванта и меньше того,
 * что заметно глазом.
 */
const SETTLE_EPSILON = 0.5;

import type { AnchorListInitialScroll } from "../../types";
import { getItemScrollOffset } from "./item-offset";

/** Зависимости расчёта стартовой позиции. */
export interface IInitialOffsetOptions {
  metrics: ListMetrics;
  getTarget: () => AnchorListInitialScroll | undefined;
  getScrollLength: () => number;
  /** Полная высота контента, включая шапку, подвал и распорки. */
  getContentSize: () => number;
  /** Смещение начала элементов в координатах контента — высота шапки. */
  getContentOrigin: () => number;
  /** Замер высоты контента уже приходил. */
  isContentMeasured: () => boolean;
  /**
   * Счётчик изменений раскладки: растёт от каждого применённого замера и от
   * смены данных.
   */
  getLayoutRevision: () => number;
  /** Запас отрисовки, который должен быть готов к первому движению. */
  getDrawDistance: () => number;
}

/**
 * Вычисление стартовой позиции скролла.
 *
 * Зачем нужно: `initialScroll` задаётся элементом, концом списка или прямым
 * смещением, а нативному слою нужно одно число. Все три случая сводятся здесь.
 *
 * Какую проблему решает: до измерения ячеек размеры оценочные, поэтому цель
 * уезжает от кадра к кадру. {@link isSettled} отвечает на вопрос «цель
 * перестала двигаться» — по нему начальный скролл понимает, что доводить
 * позицию больше не нужно, и список можно показывать.
 */
export class InitialOffsetResolver {
  private readonly options: IInitialOffsetOptions;

  /** Цель прошлой проверки — по ней видно, что позиция устаканилась. */
  private lastOffset: number | undefined;

  /** Раскладка на момент прошлой проверки. */
  private lastRevision: number | undefined;

  constructor(options: IInitialOffsetOptions) {
    this.options = options;
  }

  /**
   * Из чего сложилась цель на этом кадре — для диагностики.
   *
   * Значения снимаются здесь, а не в вызывающем: только тут видно, по каким
   * метрикам цель посчиталась, а по экрану этого не сказать.
   */
  describe(): Record<string, unknown> {
    const target = this.options.getTarget();
    const index = target?.type === "index" ? target.index : undefined;

    return {
      target: target?.type ?? "—",
      index,
      position:
        index === undefined
          ? undefined
          : this.options.metrics.getPosition(index),
      size:
        index === undefined ? undefined : this.options.metrics.getSize(index),
      viewOffset: target?.type === "index" ? target.viewOffset : undefined,
      count: this.options.metrics.getCount(),
      contentSize: this.options.getContentSize(),
      contentMeasured: this.options.isContentMeasured(),
      contentOrigin: this.options.getContentOrigin(),
      scrollLength: this.options.getScrollLength(),
      revision: this.options.getLayoutRevision(),
    };
  }

  /** Смещение стартовой позиции; `undefined` — вьюпорт ещё не измерен. */
  resolve(): number | undefined {
    const {
      metrics,
      getTarget,
      getScrollLength,
      getContentSize,
      getContentOrigin,
    } = this.options;
    const target = getTarget();
    const scrollLength = getScrollLength();

    if (!target || scrollLength === 0) return undefined;

    // Пока замера контента нет, нативный слой разложил только начало списка и
    // обрезает по нему любой запрос скролла: цель вглубь сходится к нулю.
    // Отдать её сейчас — потратить попытку доводки на скролл, которого не
    // будет, и «устаканиться» на нём же. Замер придёт первыми кадрами, и
    // попытка повторится уже по нему.
    if (!this.options.isContentMeasured()) return undefined;

    const maxScroll = Math.max(0, getContentSize() - scrollLength);

    if (target.type === "offset") {
      return Math.min(Math.max(0, target.offset), maxScroll);
    }

    // Конец контента, а не конец элементов: под ними лежит распорка под панель
    // ввода, и по сумме элементов список открывался бы с последней строкой под
    // самой панелью.
    if (target.type === "end") {
      return maxScroll;
    }

    if (target.index < 0 || target.index >= metrics.getCount()) {
      return undefined;
    }

    return Math.min(
      getItemScrollOffset({
        position: metrics.getPosition(target.index),
        size: metrics.getSize(target.index),
        scrollLength,
        viewPosition: target.viewPosition,
        viewOffset: target.viewOffset,
        origin: getContentOrigin(),
      }),
      maxScroll,
    );
  }

  /**
   * Цель перестала уезжать между кадрами — размеры устаканились.
   *
   * Побочный эффект намеренный: каждая проверка запоминает текущую цель, и
   * следующая сравнивается уже с ней.
   */
  isSettled(): boolean {
    const offset = this.resolve();
    const revision = this.options.getLayoutRevision();
    // Совпавшая цель сама по себе ничего не значит: замер применяется к
    // метрикам сразу, а до цели доходит следующим кадром. Два одинаковых
    // ответа между двумя замерами — это не «позиция устаканилась», а «мы
    // спросили дважды внутри одного кадра». Список, сдавшийся здесь,
    // открывается по оценкам, а приехавшие следом замеры сдвигают контент уже
    // на глазах у пользователя.
    const settled =
      offset !== undefined &&
      this.lastOffset !== undefined &&
      Math.abs(offset - this.lastOffset) < SETTLE_EPSILON &&
      revision === this.lastRevision &&
      this.isTargetRangeMeasured();

    this.lastOffset = offset;
    this.lastRevision = revision;

    return settled;
  }

  /**
   * Строки, которые окажутся на экране после доводки, уже измерены.
   *
   * Зачем нужно: строка меряется только после того, как отрисована, а отрисована
   * она будет там, куда доводка отвела скролл. До этого момента совпадение
   * целей между кадрами говорит лишь о том, что список ничего не узнал, —
   * сдаться здесь значит показать список по оценкам, а приехавшие следом замеры
   * переложат ровно те строки, на которые пользователь смотрит.
   *
   * Что считается «окажется на экране»: фактическое окно рассчитанного offset
   * плюс запас отрисовки с обеих сторон. Поэтому нижнее выравнивание проверяет
   * строки перед целью, а прямой offset — строки в названных им координатах.
   * Строки с объявленным размером измеренными уже считаются.
   */
  private isTargetRangeMeasured(): boolean {
    const {
      metrics,
      getTarget,
      getScrollLength,
      getContentOrigin,
      getDrawDistance,
    } = this.options;
    const target = getTarget();
    const count = metrics.getCount();

    if (!target || count === 0) return true;

    const scrollLength = getScrollLength();
    const offset = this.resolve();

    if (offset === undefined) return false;

    // Проверяется фактическое окно в координатах элементов. Идти от целевого
    // индекса вперёд нельзя: при viewPosition=1 экран лежит перед ним, а прямой
    // offset вообще не называет индекс. Поправка на шапку переводит нативное
    // смещение в те же координаты, в которых лежат позиции метрик.
    const origin = getContentOrigin();
    const drawDistance = Math.max(0, getDrawDistance());
    const viewportStart = Math.max(0, offset - origin - drawDistance);
    const viewportEnd = Math.min(
      metrics.getTotalSize(),
      Math.max(0, offset + scrollLength - origin + drawDistance),
    );

    if (viewportEnd <= viewportStart) return true;

    const from = metrics.findIndexAtOffset(viewportStart);

    for (let index = from; index < count; index++) {
      const position = metrics.getPosition(index);

      if (position >= viewportEnd) break;

      const key = metrics.getKey(index);

      if (key === undefined || !metrics.hasMeasured(key)) return false;
    }

    return true;
  }
}
