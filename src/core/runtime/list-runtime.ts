import {
  initialDebug,
  layoutDebug,
  logInitialMeasure,
  logLayoutBlank,
  logLayoutContent,
  logLayoutMeasure,
  logLayoutRange,
  logMvcpSkip,
  logScrollEvent,
  logScrollJump,
  logScrollRest,
  logScrollStale,
  scrollDebug,
  signed,
} from "../../debug";
import type { IAnchorListStickyGeometry, IContainerRequest } from "../../model";
import { ContainerPool, ListMetrics, ListStore } from "../../model";
import { listPerf, perfNow } from "../../perf";
import { ItemSource } from "../data";
import type { IEdgeCheckContext, ListEdge } from "../edges";
import { EdgeThresholds } from "../edges";
import type { IAnchorListRange } from "../layout";
import {
  AnchoredEndSpace,
  collectContainerRequests,
  computeVisibleRange,
  ContainerBinder,
  ContentSize,
  EMPTY_RANGE,
  getRangeLookahead,
  isOverrunning,
  LayoutScheduler,
  RenderReadiness,
} from "../layout";
import {
  getCompensationSpeedLimit,
  isPastCompensationSpeed,
  MaintainVisibleContentPosition,
} from "../mvcp";
import type { IScrollAdapter } from "../scroll";
import {
  getItemScrollOffset,
  InitialOffsetResolver,
  InitialScroll,
  MaintainScrollAtEnd,
  ProgrammaticScroll,
  resolveFreshOffset,
  ScrollVelocityTracker,
  shouldDeferScrollPass,
} from "../scroll";
import { StickyAnchors, StickyPublisher } from "../sticky";
import { ViewabilityTracker } from "../viewability";
import type { IAnchorListRuntimeProps } from "./runtime-props";

/** Меньшая незакрытая полоса — округление раскладки, а не дыра в кадре. */
const MIN_BLANK_PX = 1;

/**
 * Меньшее расхождение своей высоты контента с нативной — округление раскладки.
 *
 * Yoga кладёт раскладку на сетку пикселей, а список складывает высоту из
 * дробных замеров: доли точки расходятся всегда и ни о чём не говорят.
 */
const MIN_CONTENT_DIFF_PX = 0.5;

/**
 * Во сколько раз дельта события должна разойтись с прошлой, чтобы считаться
 * рывком.
 *
 * Сравнение относительное, а не пороговое: на медленном чтении рывком выглядит
 * и десяток точек, а на броске полсотни — обычный ход. Втрое — это уже не
 * ускорение пальца, а разрыв в потоке событий.
 */
const JUMP_RATIO = 3;

/**
 * Добавка к сравнению рывка, px.
 *
 * Без неё дельта в пару точек после дельты в полточки считалась бы рывком: у
 * стоящего списка отношение соседних дельт бессмысленно.
 */
const JUMP_MIN_PX = 8;

/**
 * С каким весом новая дельта входит в обычный ход.
 *
 * Сравнивать с одной прошлой дельтой нельзя: события приходят неравномерно, и
 * посреди ровной прокрутки попадается мелкое — короткий промежуток между двумя
 * кадрами. Следующее за ним обычное событие оказывалось бы втрое больше и
 * объявлялось рывком, хотя палец шёл ровно. Усреднение держит «обычный ход» на
 * уровне последних нескольких событий, а не последнего.
 */
const JUMP_SMOOTHING = 0.3;

/**
 * Через сколько тишины скролл считается остановившимся, мс.
 *
 * Скорость публикуется только на событии скролла, а когда список встал, событий
 * больше нет — и последнее значение осталось бы снаружи навсегда. Само оно не
 * затухает: счётчик считает средневзвешенное по уже собранной истории, и без
 * новых точек ответ не меняется.
 *
 * Порог взят чуть больше кадра с запасом на пропуски: события уходят в JS
 * шагами по пикселям, и на медленном движении пауза между ними легко
 * перерастает кадр. Ждать дольше незачем — «список стоит» должно доезжать
 * наружу быстрее, чем это заметит глаз.
 */
const SCROLL_IDLE_MS = 120;

/**
 * Расчётное ядро списка.
 *
 * Зачем нужно: диапазон отрисовки, позиции и привязка контейнеров считаются
 * здесь, вне React. В дерево уходят только адресные сигналы стора, поэтому
 * скролл и измерения не перерисовывают список целиком — перерисовывается только
 * затронутый контейнер.
 *
 * Что делает сам: почти ничего. Ядро — координатор: оно держит смещение,
 * размер вьюпорта и текущий диапазон, а всю содержательную работу делают
 * отдельные части. Здесь живёт только то, что связывает их между собой, —
 * порядок вызовов, от которого зависит, увидит пользователь прыжок или нет.
 *
 * Ключевые связки, каждая из которых была отдельной проблемой:
 * - {@link setProps} снимает якорь **до** смены данных и восстанавливает
 *   позицию **после**: якорь обязан помнить раскладку до изменения;
 * - {@link setItemSize} копит измерения до конца кадра, но якорь снимает сразу
 *   — база компенсации должна относиться к состоянию до первого изменения пачки;
 * - {@link restoreVisiblePosition} считает раскладку дважды и в одном
 *   синхронном проходе с записью позиций;
 * - {@link setScroll} отбрасывает события, отправленные до применения сдвига,
 *   считает проход по живому смещению UI-потока и сливает события кадра в один
 *   проход: нативный слой шлёт их чаще, чем JS успевает отрисовать кадр, и
 *   лишний проход — это работа, которую никто не увидит;
 * - {@link flushLayout} — тот же проход, поэтому отложенный проход того же
 *   кадра после него не выполняется.
 */
export class ListRuntime<TItem> {
  readonly store: ListStore;
  readonly metrics: ListMetrics;
  readonly pool = new ContainerPool();

  private props: IAnchorListRuntimeProps<TItem>;
  private readonly items: ItemSource<TItem>;

  /**
   * Смещение скролла в координатах раскладки элементов.
   *
   * Не то же, что `contentOffset`: над элементами лежит шапка, и нативное
   * смещение больше на её высоту. Внутри всё считается в координатах элементов
   * — с ними сравниваются позиции строк; наружу отдаётся `contentOffset`.
   */
  private scroll = 0;
  /** Размер вьюпорта вдоль оси скролла. */
  private scrollLength = 0;
  private range: IAnchorListRange = { ...EMPTY_RANGE };

  private readonly velocity = new ScrollVelocityTracker();
  private readonly edges: EdgeThresholds;
  private readonly maintainAtEnd: MaintainScrollAtEnd;
  private readonly mvcp: MaintainVisibleContentPosition;
  private readonly sticky: StickyAnchors;
  private readonly stickyPublisher: StickyPublisher;
  private readonly viewability: ViewabilityTracker<TItem>;
  private readonly binder: ContainerBinder;
  private readonly scheduler: LayoutScheduler;
  private readonly contentSize: ContentSize;
  private readonly endSpace: AnchoredEndSpace;
  private readonly readiness: RenderReadiness;
  private readonly initialOffset: InitialOffsetResolver;
  private readonly initialScroll: InitialScroll;
  private readonly programmatic: ProgrammaticScroll;

  private adapter: IScrollAdapter | undefined;
  /** Кромка, разблокированная текущим жестом. */
  private allowedEdge: ListEdge | undefined;
  /** Контейнеры уже прошли первую раскладку — до этого прилипать не к чему. */
  private didLayout = false;
  /** Идёт удержание позиции: замер пустот в это время не имеет смысла. */
  private restoring = false;
  /** Время последнего прохода по скроллу — по нему события сливаются в кадр. */
  private lastPassAt = 0;
  /** Отложенный на следующий кадр проход. */
  private deferredPass: number | undefined;
  /** Ожидание тишины, после которой скорость обнуляется. */
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Список стоит: событий скролла не было дольше {@link SCROLL_IDLE_MS}.
   *
   * От этого зависит запас подрезки — см. {@link bindContainers}.
   */
  private atRest = true;
  /** Направление последнего движения: +1 к концу списка, -1 к началу. */
  private scrollDirection = 0;
  /**
   * Смещение предыдущего события скролла — им определяется направление.
   *
   * Отдельно от применённого смещения: то могло быть подменено живым, и тогда
   * направление переворачивалось бы через событие. См. {@link resolveFreshOffset}.
   */
  private lastEventOffset: number | undefined;
  /**
   * Обычный сдвиг за событие: сглаженное среднее последних дельт.
   *
   * С ним сравнивается очередная дельта при поиске рывка. `undefined` — список
   * стоял, и сравнивать не с чем: первое движение из покоя рывком не бывает.
   */
  private usualEventDelta: number | undefined;
  /** Меняется только когда данные или геометрия требуют полной публикации. */
  private layoutRevision = 0;
  private requestRevision = 0;
  private requestCache:
    | {
        start: number;
        end: number;
        pinned: number[];
        pending: number[];
        revision: number;
        requests: IContainerRequest[];
      }
    | undefined;

  constructor(store: ListStore, props: IAnchorListRuntimeProps<TItem>) {
    this.store = store;
    this.props = props;
    this.metrics = new ListMetrics({
      estimatedItemSize: props.estimatedItemSize,
    });

    const adapter = () => this.adapter;

    this.items = new ItemSource({ metrics: this.metrics });
    this.scheduler = new LayoutScheduler(() => this.flushLayout());
    this.contentSize = new ContentSize({
      metrics: this.metrics,
      isFlushPending: () => this.scheduler.isPending(),
    });

    this.edges = new EdgeThresholds(this.edgeOptions());
    this.maintainAtEnd = new MaintainScrollAtEnd(this.maintainOptions());
    this.programmatic = new ProgrammaticScroll({ adapter });

    this.mvcp = new MaintainVisibleContentPosition({
      store,
      metrics: this.metrics,
      adapter,
      getScroll: () => this.scroll,
      getScrollLength: () => this.scrollLength,
      // В координатах элементов, как и смещение выше: иначе граница скролла,
      // посчитанная из этой высоты, разъедется со смещением на высоту шапки.
      getContentSize: () => this.contentSize.get() - this.getContentOrigin(),
      shouldRestorePosition: index => this.canAnchorAt(index),
    });

    this.sticky = new StickyAnchors({ metrics: this.metrics });
    this.sticky.setConfigs(props.sticky);
    this.stickyPublisher = new StickyPublisher({ store, anchors: this.sticky });

    this.viewability = new ViewabilityTracker<TItem>({
      metrics: this.metrics,
      getItem: index => this.props.data[index],
    });
    this.viewability.setPairs(props.viewabilityPairs);

    this.binder = new ContainerBinder({
      store,
      metrics: this.metrics,
      pool: this.pool,
      getItem: index => this.props.data[index],
      itemsAreEqual: (prev, next, index) =>
        prev !== undefined &&
        next !== undefined &&
        (this.props.itemsAreEqual?.(prev as TItem, next as TItem, index) ??
          false),
      getStickyLimit: index => this.sticky.getLimitOf(index),
    });

    this.endSpace = new AnchoredEndSpace({
      store,
      metrics: this.metrics,
      getConfig: () => this.props.anchoredEndSpace,
      getScrollLength: () => this.scrollLength,
    });

    this.initialOffset = new InitialOffsetResolver({
      metrics: this.metrics,
      getTarget: () => this.props.initialScroll,
      getScrollLength: () => this.scrollLength,
      getContentSize: () => this.contentSize.get(),
      getContentOrigin: () => this.getContentOrigin(),
      isContentMeasured: () => this.contentSize.hasMeasured(),
      getLayoutRevision: () => this.layoutRevision,
      getDrawDistance: () => this.props.drawDistance,
    });
    this.initialScroll = new InitialScroll({
      getTarget: () => this.props.initialScroll,
      resolveOffset: () => this.initialOffset.resolve(),
      // Через ту же пометку, что и остальной программный скролл: доводка
      // стартовой позиции — переезд списка, а не движение пользователя.
      scrollToOffset: offset => this.programmatic.toOffset(offset, false),
      isTargetSettled: () => this.initialOffset.isSettled(),
      // Живое смещение, а не событие: доводка идёт по кадрам, а событие о
      // прошлой команде могло ещё не дойти — по нему список «не доехал» всегда.
      getLiveOffset: () => this.adapter?.getOffset?.(),
      describeTarget: () => this.initialOffset.describe(),
      onFinished: () => {
        this.store.set("readyToRender", true);
        this.props.onLoad?.();
      },
    });
    this.readiness = new RenderReadiness({
      metrics: this.metrics,
      getRange: () => this.range,
      getCount: () => this.items.getCount(),
      hasInitialTarget: () => this.props.initialScroll !== undefined,
      getLayoutRevision: () => this.layoutRevision,
      isPending: () => this.initialScroll.isActive(),
      finish: (cause, rounds) => this.initialScroll.finish(cause, rounds),
    });

    this.items.apply(props.data, props);
  }

  /** Привязка к нативному скроллу; вызывается при монтировании списка. */
  setAdapter(adapter: IScrollAdapter | undefined): void {
    this.adapter = adapter;

    // Первая раскладка могла прийти до пассивного эффекта React, которым
    // подключается ScrollView. Невыполненная тогда команда попыткой не считается
    // и повторяется сразу после появления адаптера.
    if (adapter) this.initialScroll.apply();
  }

  /** Текущий диапазон отрисовки и его буферизованные границы. */
  getRange(): IAnchorListRange {
    return this.range;
  }

  /** Элемент данных по индексу. */
  getItemAt(index: number): TItem | undefined {
    return this.props.data[index];
  }

  /** Ключ элемента по индексу; undefined — индекса нет в данных. */
  getItemKeyAt(index: number): string | undefined {
    return index >= 0 && index < this.props.data.length
      ? this.items.getKey(index)
      : undefined;
  }

  /** Размер объявлен пропом: измерять такую строку не нужно. */
  isItemSizeFixed(key: string): boolean {
    return this.metrics.hasFixedSize(key);
  }

  /** Размер элемента известен точно — измерен или объявлен пропом. */
  isItemSizeKnown(key: string): boolean {
    return this.metrics.hasMeasured(key);
  }

  /** Точно известный размер элемента; undefined — есть только оценка. */
  getKnownItemSize(key: string): number | undefined {
    return this.metrics.getSizeByKey(key);
  }

  /** Переиспользовать поддерево ячейки между элементами одного типа. */
  shouldRecycleItems(): boolean {
    return !!this.props.recycleItems;
  }

  setContainerItemSize(id: number, key: string, size: number): void {
    if (this.pool.getBinding(id)?.key !== key) return;

    this.setItemSize(key, size);
  }

  /**
   * Геометрия якоря для слоя прилипших копий.
   *
   * В координатах элементов — тех же, в которых считается смещение прилипания.
   */
  getStickyGeometry(index: number): IAnchorListStickyGeometry | undefined {
    if (index < 0 || index >= this.items.getCount()) return undefined;

    return {
      position: this.metrics.getPosition(index),
      size: this.metrics.getSize(index),
      limit: this.sticky.getLimitOf(index),
    };
  }

  /** Смещение скролла в координатах контента — то же, что у нативного. */
  getScroll(): number {
    return this.scroll + this.getContentOrigin();
  }

  /** Размер вьюпорта вдоль оси скролла. */
  getScrollLength(): number {
    return this.scrollLength;
  }

  /** Скорость скролла, px/мс: положительная — к концу списка. */
  getVelocity(): number {
    return this.velocity.get();
  }

  /** Полная высота контента: элементы плюс шапка, подвал и распорки. */
  getContentSize(): number {
    return this.contentSize.get();
  }

  /** Замер высоты контента от ScrollView. */
  setContentSize(height: number): void {
    this.contentSize.setMeasured(height);
    this.publishGeometry();

    if (layoutDebug.enabled) {
      const own = this.contentSize.get();
      const diff = height - own;

      // Совпавшие высоты — обычный ход дела: замер приходит каждый кадр
      // прокрутки, и строка о совпадении вытеснила бы из лога всё остальное.
      // Печатается только расхождение — то, из-за чего граница скролла
      // считается не по тому, что нарисовано.
      if (Math.abs(diff) >= MIN_CONTENT_DIFF_PX) {
        logLayoutContent({
          own,
          native: height,
          diff: signed(diff),
          items: this.metrics.getTotalSize(),
          header: this.store.peek("headerSize"),
          footer: this.store.peek("footerSize"),
          spacer: this.store.peek("anchoredEndSpaceSize"),
        });
      }
    }

    // Стартовая позиция «в конец» ждала именно этого замера: без него конец
    // контента — это конец элементов, без подвала и распорок.
    this.initialScroll.apply();
    // Первый scrollToEnd мог опираться на оценки ещё не смонтированных строк.
    // Несколько onContentSizeChange от одной волны замеров склеиваются в одну
    // доводку: иначе отдельный scrollToEnd на каждую строку виден лестницей.
    this.programmatic.scheduleEndCorrection();
  }

  /**
   * Замер шапки списка.
   *
   * Шапка задаёт начало координат элементов. Пока она не измерена, список
   * считает её нулевой; с приходом замера нативное смещение не меняется —
   * сдвигается начало отсчёта, и раскладку нужно пересчитать.
   */
  setHeaderSize(size: number): void {
    const delta = size - this.getContentOrigin();

    this.store.set("headerSize", size);
    // Прилипание живёт на UI-потоке и складывать начало координат само не
    // может: позиции строк приходят к нему из раскладки, а смещение скролла —
    // нативное. Величина отдаётся сигналом, чтобы у обоих был один источник.
    this.store.set("contentOrigin", size);

    if (delta === 0) return;

    this.scroll -= delta;
    this.calculateItemsInView();
    this.checkThresholds();
    this.initialScroll.apply();
  }

  /** Замер подвала списка. */
  setFooterSize(size: number): void {
    this.store.set("footerSize", size);
  }

  /**
   * Замер вьюпорта целиком.
   *
   * Вдоль оси скролла размер приходит отдельно ({@link setScrollLength}) — он
   * участвует в расчётах; ширина нужна только тем, кто строит поверх списка
   * собственную раскладку.
   */
  setScrollSize(width: number, height: number): void {
    const previous = this.store.peek("scrollSize");

    if (previous?.width === width && previous.height === height) return;

    this.store.set("scrollSize", { width, height });
  }

  /**
   * Обновление пропов между рендерами.
   *
   * Смена данных — единственный случай, требующий полного прохода. Якорь
   * снимается до неё, по позициям старой раскладки, и восстанавливается сразу
   * после: разнести это по кадрам значит показать промежуточное состояние.
   */
  setProps(props: IAnchorListRuntimeProps<TItem>): void {
    const keys = Object.keys(props) as (keyof IAnchorListRuntimeProps<TItem>)[];

    if (
      keys.length === Object.keys(this.props).length &&
      keys.every(key => props[key] === this.props[key])
    ) {
      return;
    }

    // Снимается до применения данных: добавленная снизу строка сама уводит
    // список от конца, и прочитанный после неё флаг всегда скажет «не у конца».
    const wasAtEnd =
      this.store.peek("isWithinMaintainScrollAtEndThreshold") ?? false;
    const dataChanged = props.data !== this.props.data;
    const initialChanged = props.initialScroll !== this.props.initialScroll;
    const sourceChanged =
      dataChanged ||
      props.keyExtractor !== this.props.keyExtractor ||
      props.getItemType !== this.props.getItemType ||
      props.getFixedItemSize !== this.props.getFixedItemSize;
    const stickyChanged = props.sticky !== this.props.sticky;
    const rangeChanged = props.drawDistance !== this.props.drawDistance;
    // Выравнивание короткого контента ядру не адресовано: его сдвиг считается
    // на UI-потоке, в такт нижнему отступу.
    const endSpaceChanged =
      props.anchoredEndSpace !== this.props.anchoredEndSpace;

    this.props = props;
    this.edges.setOptions(this.edgeOptions());
    this.maintainAtEnd.setOptions(this.maintainOptions());
    this.viewability.setPairs(props.viewabilityPairs);

    if (!sourceChanged && !stickyChanged && !rangeChanged && !endSpaceChanged) {
      if (initialChanged) {
        this.initialScroll.apply();
        this.readiness.reveal();
      }

      return;
    }

    const maintainData =
      sourceChanged &&
      props.maintainVisibleContentPositionData &&
      !this.initialScroll.isActive();

    if (maintainData) {
      this.mvcp.capture("данные");
    }

    if (sourceChanged) this.items.apply(props.data, props);

    // Строго после данных: индексы прилипания адресуют именно их. Применить
    // новые индексы к прежним строкам — значит на мгновение назвать прилипающими
    // совсем другие места списка, и снятый в этот момент якорь окажется ложным.
    this.sticky.setConfigs(props.sticky);

    if (sourceChanged || stickyChanged) {
      this.layoutRevision++;
      this.requestRevision++;
    }

    if (maintainData) {
      this.restoreVisiblePosition("данные");
    } else {
      this.calculateItemsInView();
    }

    this.endSpace.update();
    this.checkThresholds();
    if (initialChanged) this.initialScroll.apply();

    // Новый контент удлинил список: если пользователь стоял у конца, держим его там.
    if (this.didLayout && !this.initialScroll.isActive()) {
      this.maintainAtEnd.run(wasAtEnd);
    }
  }

  /** Новый размер вьюпорта. */
  setScrollLength(length: number): void {
    if (this.scrollLength === length) return;

    this.scrollLength = length;
    this.store.set("scrollLength", length);
    this.publishGeometry();
    this.calculateItemsInView();
    this.endSpace.update();
    this.checkThresholds();
    this.didLayout = true;
    this.initialScroll.apply();
    this.readiness.reveal();
    this.readiness.scheduleFallback();
  }

  /**
   * Новое смещение нативного скролла — `contentOffset`.
   *
   * `time` — момент самого события, снятый на UI-потоке. По умолчанию берётся
   * текущее время: так вызывают тесты и программный скролл, где событие и его
   * обработка — одно и то же.
   */
  setScroll(offset: number, time: number = Date.now()): void {
    // Событие отправлено до применения компенсации: его смещение уже устарело,
    // и принять его — значит откатить только что сделанный сдвиг. Проверяется
    // до подмены смещения: речь именно об этом событии.
    if (this.mvcp.isStaleScroll(offset - this.getContentOrigin())) {
      logScrollStale({ offset, current: this.getScroll() });

      return;
    }

    const previousEvent = this.lastEventOffset;

    this.lastEventOffset = offset;

    const fresh = resolveFreshOffset({
      offset,
      live: this.adapter?.getOffset?.(),
      // Первое событие направления не имеет — подменять по нему нечего.
      previous: previousEvent ?? offset,
      current: this.getScroll(),
      scrollLength: this.scrollLength,
    });
    const scroll = fresh - this.getContentOrigin();

    // Даже событие с тем же offset подтверждает мгновенный scrollTo. Проверять
    // равенство раньше нельзя: пометка осталась бы активной до таймаута и первый
    // настоящий жест считался бы продолжением программного переезда.
    const ownMove = this.programmatic.isActive();

    this.programmatic.onScrollEvent();

    if (this.scroll === scroll) return;

    const startedAt = listPerf.enabled ? perfNow() : 0;
    const travelled = Math.abs(scroll - this.scroll);

    // Направление и скорость считаются по потоку событий, а не по применённому
    // смещению. Применённое склеено из двух источников: пока JS отстаёт больше
    // чем на полэкрана, вместо события берётся живое смещение UI-потока. В
    // момент, когда JS догоняет, подмена выключается и применённое возвращается
    // к своим часам — назад на величину бывшего отставания. Движение при этом
    // только вперёд, а счётчик показывал бы разворот: на инерции скорость
    // проскакивала в минус, а сторож отложенного прохода на кадр начинал
    // пропускать движение назад.
    //
    // Берётся сырой `contentOffset`, а не координаты элементов: он не зависит
    // от того, измерилась ли уже шапка, и на её замере не даёт скачка.
    this.scrollDirection = Math.sign(offset - (previousEvent ?? offset));
    this.scroll = scroll;

    // Свой переезд — не движение пользователя. Скролл к позиции прыгает на
    // тысячи точек за одно событие, и посчитанная по нему скорость выходит
    // такой, какой палец не даёт. А по скорости список решает, раздувать ли
    // запас отрисовки и стоит ли компенсировать замеры: и то и другое ошиблось
    // бы разом, а на экране это дрожание после каждого перехода.
    if (ownMove) {
      this.velocity.reset();
      this.store.set("velocity", 0);
    } else {
      this.velocity.add(offset, time);
      this.store.set("velocity", this.velocity.get(time));
    }
    this.atRest = false;
    this.scheduleIdleVelocity();

    // На скрабе слияние вредит: проход стоит доли миллисекунды, а каждый
    // пропущенный оставляет на экране картинку, отставшую на несколько экранов.
    if (scrollDebug.enabled) {
      this.reportScrollEvent(offset, previousEvent, ownMove);
    }

    const overrunning = isOverrunning(this.velocity.get(), this.scrollLength);

    if (overrunning) listPerf.count("passOverrun");

    const deferred =
      !overrunning && shouldDeferScrollPass(Date.now() - this.lastPassAt);

    if (deferred) {
      listPerf.count("passDeferred");
      this.deferPass();
    } else {
      this.runScrollPass();
    }

    // Пороги подгрузки считаются на каждом событии: они дёшевы, а отложить их
    // значит запоздать с запросом ровно там, где до кромки осталось меньше кадра.
    this.checkThresholds();

    if (listPerf.enabled) {
      listPerf.count("scrollEvents");
      listPerf.sample("scrollPx", travelled);
      listPerf.sample("velocity", Math.abs(this.velocity.get()));
      // Событие, отложившее проход, стоит одних порогов: считать его наравне с
      // выполненным проходом значит занижать цену прохода вчетверо.
      if (!deferred) listPerf.sample("scrollMs", perfNow() - startedAt);
      // Насколько JS отстал от нативного скролла к концу прохода: пустота в
      // кадре начинается там, где это отставание перерастает буфер отрисовки.
      listPerf.sample(
        "lagPx",
        Math.abs((this.adapter?.getOffset?.() ?? fresh) - fresh),
      );
    }
  }

  /**
   * Обнуление скорости, когда события кончились.
   *
   * Заводится на каждом событии заново: пока скролл идёт, срабатывать нечему.
   */
  private scheduleIdleVelocity(): void {
    if (this.idleTimer !== undefined) clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      // История сбрасывается вместе со значением: следующее движение начнётся
      // с чистого листа, а не продолжит средневзвешенное через паузу.
      logScrollRest({ offset: this.scroll, velocity: this.velocity.get() });
      // Обычный ход забывается вместе со скоростью: следующее движение начнётся
      // с чистого листа, и сравнивать его с тем, как шёл прошлый жест, нечего.
      this.usualEventDelta = undefined;
      this.velocity.reset();
      this.scrollDirection = 0;
      this.store.set("velocity", 0);
      this.atRest = true;
      // Запас подрезки снимается вместе с движением: пересчёт нужен, чтобы
      // строки вплотную за кадром снова закрылись своими границами.
      this.calculateItemsInView();
    }, SCROLL_IDLE_MS);
  }

  /** Начало жеста: направление решает, какая кромка может сработать снова. */
  onGestureBegin(): void {
    // Палец на экране — движение вот-вот начнётся, и запас подрезки нужен
    // раньше первого события скролла.
    this.atRest = false;
    this.allowedEdge = this.edges.beginGesture(this.velocity.get());
    // Список взяли в руки: доводка к концу обязана уступить жесту.
    this.maintainAtEnd.cancel();
    this.programmatic.cancel();
  }

  /** Жест завершён — следующий разблокирует кромку. */
  onGestureEnd(): void {
    this.edges.prepareForNextGesture();
    this.allowedEdge = undefined;
  }

  /**
   * Позиция элемента в координатах контента.
   *
   * Раскладка элементов начинается с нуля, а в контенте над ними лежит шапка:
   * наружу отдаётся позиция с поправкой на неё — та, что годится для скролла.
   */
  getPositionAtIndex(index: number): number | undefined {
    if (index < 0 || index >= this.items.getCount()) return undefined;

    return this.getContentOrigin() + this.metrics.getPosition(index);
  }

  /** Размер элемента; до измерения — оценка, а не факт. */
  getSizeAtIndex(index: number): number | undefined {
    if (index < 0 || index >= this.items.getCount()) return undefined;

    return this.metrics.getSize(index);
  }

  /**
   * Позиция элемента по его ключу.
   *
   * Ключ переживает вставки и удаления, а индекс — нет: после подгрузки сверху
   * тот же элемент лежит на другом индексе.
   */
  getPositionByKey(key: string): number | undefined {
    const position = this.metrics.getPositionByKey(key);

    return position === undefined
      ? undefined
      : this.getContentOrigin() + position;
  }

  /** Индекс элемента по ключу; undefined — ключа нет в данных. */
  getIndexByKey(key: string): number | undefined {
    return this.metrics.getIndexByKey(key);
  }

  /** Скролл к смещению в координатах контента. */
  scrollToOffset(offset: number, animated = false): void {
    this.programmatic.toOffset(offset, animated);
  }

  /** Скролл к концу контента — вместе с подвалом и распорками. */
  scrollToEnd(animated = false): void {
    this.programmatic.toEnd(animated);
  }

  /**
   * Скролл к элементу по ключу; см. {@link getPositionByKey}.
   *
   * @returns false, если элемента с таким ключом в данных нет.
   */
  scrollToKey(params: {
    key: string;
    animated?: boolean;
    viewPosition?: number;
    viewOffset?: number;
  }): boolean {
    const index = this.metrics.getIndexByKey(params.key);

    if (index === undefined) return false;

    this.scrollToIndex({ ...params, index });

    return true;
  }

  /**
   * Скролл к элементу. `viewPosition` — куда прижать элемент во вьюпорте:
   * 0 к началу, 1 к концу, 0.5 по центру.
   */
  scrollToIndex(params: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
    viewOffset?: number;
  }): void {
    const { index, animated = false, viewPosition, viewOffset } = params;

    if (index < 0 || index >= this.items.getCount()) return;

    this.scrollToOffset(
      getItemScrollOffset({
        position: this.metrics.getPosition(index),
        size: this.metrics.getSize(index),
        scrollLength: this.scrollLength,
        viewPosition,
        viewOffset,
        origin: this.getContentOrigin(),
      }),
      animated,
    );
  }

  /**
   * Результат измерения ячейки.
   *
   * Измерение, которое ничего не двигает, отсеивается заранее: якорь снимается
   * до применения первого размера, и без этой проверки он остался бы снятым без
   * пересчёта, который его вернёт.
   *
   * Ключ приходит вместе с высотой и от привязки контейнера не зависит: она
   * измерена на содержимом, отрисованном именно для этого ключа. Событие
   * доставляется в JS асинхронно и вполне может застать контейнер уже под
   * другим элементом — отбрасывать такое измерение нельзя, иначе элемент
   * навсегда останется с оценочным размером, а соседи наползут друг на друга.
   */
  setItemSize(key: string, size: number): void {
    if (!this.metrics.willResize(key, size)) return;

    if (listPerf.enabled) {
      const index = this.metrics.getIndexByKey(key);

      listPerf.count("measureApplied");
      listPerf.sample(
        "resizePx",
        index === undefined ? 0 : Math.abs(size - this.metrics.getSize(index)),
      );
    }

    // Скорость снимается до применения замера: после него контент уже вырос, и
    // тот же вопрос отвечал бы уже про другое состояние списка.
    // Порог скорости — про бросок пальцем: там якорь уже не тот, на который
    // смотрел пользователь. На своём переезде смотреть есть на что, и
    // пропускать компенсацию не за чем.
    const tooFast =
      !this.programmatic.isActive() &&
      isPastCompensationSpeed(this.velocity.get(), this.scrollLength);

    // Пока список скрыт, абсолютная начальная доводка сама учтёт новый размер.
    if (
      this.props.maintainVisibleContentPositionSize &&
      !this.initialScroll.isActive()
    ) {
      if (tooFast) {
        listPerf.count("mvcpSkippedFast");
      } else {
        this.mvcp.capture("размер");
      }
    }

    if (layoutDebug.enabled) {
      const index = this.metrics.getIndexByKey(key);
      const before =
        index === undefined ? undefined : this.metrics.getSize(index);

      // Замер, совпавший с оценкой, ничего не двигает: печатать нечего.
      if (before !== size) {
        logLayoutMeasure({
          index: index ?? key,
          from: before,
          to: size,
          delta: before === undefined ? undefined : signed(size - before),
          velocity: this.velocity.get(),
          compensated:
            this.props.maintainVisibleContentPositionSize && !tooFast,
        });
      }
    }

    if (tooFast) {
      logMvcpSkip({
        velocity: this.velocity.get(),
        limit: getCompensationSpeedLimit(this.scrollLength),
        key,
      });
    }

    // Печатается и после показа: замер, пришедший туда, — это и есть перекладка
    // на глазах у пользователя, ради которой канал чаще всего и включают.
    if (initialDebug.enabled) {
      const index = this.metrics.getIndexByKey(key);

      logInitialMeasure({
        index: index ?? key,
        from: index === undefined ? undefined : this.metrics.getSize(index),
        to: size,
        // Замер после показа списка — это и есть перекладка на глазах.
        revealed: !this.initialScroll.isActive(),
      });
    }

    this.metrics.setMeasuredSize(key, size);
    this.layoutRevision++;

    this.scheduler.schedule();
  }

  /**
   * Диапазон отрисовки и привязка контейнеров.
   *
   * Публичный: удержание позиции вызывает его дважды за проход, а компоненты —
   * после того, как список смонтирован.
   */
  calculateItemsInView(): void {
    this.store.batch(() => this.calculateItemsInViewNow());
  }

  /** Один проход расчёта внутри общей атомарной публикации сигналов. */
  private calculateItemsInViewNow(): void {
    const startedAt = listPerf.enabled ? perfNow() : 0;

    if (this.items.getCount() === 0) {
      this.range = { ...EMPTY_RANGE };
      this.binder.releaseAll();
      this.store.set("totalSize", 0);
      this.publishVisibleRange();
      this.publishGeometry();

      return;
    }

    this.range = computeVisibleRange({
      metrics: this.metrics,
      scroll: this.scroll,
      scrollLength: this.scrollLength,
      drawDistance: this.props.drawDistance,
      // Запас по ходу движения: на броске одного буфера не хватает.
      velocity: this.velocity.get(),
    });

    if (layoutDebug.enabled) this.reportRange();

    if (listPerf.enabled || layoutDebug.enabled)
      this.reportBlankSpace("before");

    this.bindContainers();

    if (listPerf.enabled || layoutDebug.enabled) this.reportBlankSpace("after");
    this.store.set("totalSize", this.metrics.getTotalSize());
    this.publishVisibleRange();
    this.publishGeometry();

    if (this.viewability.hasPairs()) {
      this.viewability.update({
        scroll: this.scroll,
        scrollLength: this.scrollLength,
        startBuffered: this.range.startBuffered,
        endBuffered: this.range.endBuffered,
      });
    }

    if (listPerf.enabled) this.reportLayoutPass(startedAt);
  }

  /** Снятие таймеров и подписок при размонтировании списка. */
  dispose(): void {
    if (this.deferredPass !== undefined) {
      cancelAnimationFrame(this.deferredPass);
      this.deferredPass = undefined;
    }
    if (this.idleTimer !== undefined) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    this.viewability.dispose();
    this.mvcp.reset();
    this.maintainAtEnd.dispose();
    this.readiness.dispose();
    this.initialScroll.dispose();
    this.programmatic.dispose();
  }

  /**
   * Смещение начала элементов в координатах контента.
   *
   * Раскладка элементов начинается с нуля, а в контенте над ними лежит шапка.
   * Величина нужна везде, где позиция элемента превращается в `contentOffset`.
   */
  private getContentOrigin(): number {
    return this.store.peek("headerSize") ?? 0;
  }

  /**
   * Геометрия контента наружу.
   *
   * `maxScroll` считается здесь, а не у читателя: граница зависит и от высоты
   * контента, и от вьюпорта, и посчитать её самому значит повторить ту же
   * формулу — и разойтись с той, по которой список сам себя ограничивает.
   */
  private publishGeometry(): void {
    const contentSize = this.contentSize.get();

    this.store.set("contentSize", contentSize);
    this.store.set("maxScroll", Math.max(0, contentSize - this.scrollLength));
  }

  /** Границы видимого диапазона наружу; -1 — ни один элемент не в кадре. */
  private publishVisibleRange(): void {
    const isEmpty = this.range.end < this.range.start;

    this.store.set("firstVisibleIndex", isEmpty ? -1 : this.range.start);
    this.store.set("lastVisibleIndex", isEmpty ? -1 : this.range.end);
  }

  private edgeOptions() {
    return {
      store: this.store,
      startThreshold: this.props.startReachedThreshold,
      endThreshold: this.props.endReachedThreshold,
      maintainScrollAtEndThreshold: this.props.maintainScrollAtEndThreshold,
      onStartReached: this.props.onStartReached,
      onEndReached: this.props.onEndReached,
    };
  }

  private maintainOptions() {
    return {
      store: this.store,
      adapter: () => this.adapter,
      enabled: this.props.maintainScrollAtEnd,
      animated: this.props.maintainScrollAtEndAnimated,
    };
  }

  /** Применение накопленных изменений раскладки одним проходом. */
  private flushLayout(): void {
    const startedAt = listPerf.enabled ? perfNow() : 0;
    // До применения замеров: выросшая строка уводит список от конца так же, как
    // добавленная, — см. {@link MaintainScrollAtEnd.run}.
    const wasAtEnd =
      this.store.peek("isWithinMaintainScrollAtEndThreshold") ?? false;

    // Пересчёт раскладки — полноценный проход по текущему смещению: отложенному
    // проходу этого кадра после него делать нечего.
    this.lastPassAt = Date.now();
    this.metrics.clearPending();

    // По снятому якорю, а не по пропу: на броске замер якорь не снимает, и
    // проходить через компенсацию не за чем — это стоило бы двух привязок
    // вместо одной ради сдвига, которого не было.
    if (this.props.maintainVisibleContentPositionSize && this.mvcp.isArmed()) {
      this.restoreVisiblePosition("размер");
    } else {
      this.calculateItemsInView();
    }

    this.endSpace.update();
    this.checkThresholds();
    this.initialScroll.apply();
    this.readiness.reveal();

    if (this.didLayout && !this.initialScroll.isActive()) {
      this.maintainAtEnd.run(wasAtEnd);
    }

    if (listPerf.enabled) {
      listPerf.count("flush");
      listPerf.sample("flushMs", perfNow() - startedAt);
    }
  }

  /**
   * Удержание видимой позиции после изменения раскладки.
   *
   * Сдвиг выполняет нативный ScrollView — он делает это в той же
   * mount-транзакции, что и перестановку контейнеров, поэтому промежуточного
   * кадра не возникает. Здесь только приводится внутреннее представление о
   * смещении, чтобы диапазон отрисовки не отставал до прихода события скролла.
   *
   * Вызов обязан идти в том же синхронном проходе, что и запись позиций: React
   * сведёт все сигналы в один рендер, а нативный слой — в одну транзакцию.
   * Разнести их по кадрам — значит увидеть прыжок.
   *
   * Раскладка считается дважды, и оба прохода обязательны. Первый нужен ради
   * привязки контейнеров: она уточняет размеры новых элементов по высоте тех,
   * чьё место они заняли, — а от размеров зависит, на сколько уехал якорь.
   * Посчитать сдвиг раньше значит посчитать его по устаревшим позициям.
   *
   * Идёт первый проход по предсказанному смещению: иначе он промахнулся бы
   * диапазоном ровно на величину будущего сдвига и перепривязал бы контейнеры
   * впустую. Предсказание расходится с итогом лишь на то, что уточнит сам этот
   * проход, — на единицы пикселей.
   */
  private restoreVisiblePosition(reason: string): void {
    this.store.batch(() => {
      const scroll = this.scroll;
      const predicted = scroll + this.mvcp.peekShift();

      this.restoring = true;
      this.scroll = predicted;
      this.calculateItemsInView();

      // Сдвиг считается от настоящего смещения, а не от предсказанного.
      this.scroll = scroll;
      this.scroll = this.mvcp.restore(reason);

      if (listPerf.enabled) {
        listPerf.count("mvcpRestore");
        listPerf.sample("mvcpShiftPx", Math.abs(this.scroll - scroll));
      }

      // Второй проход нужен, только если сдвиг разошёлся с предсказанным. Чаще
      // всего он совпадает — измерение ниже якоря его не двигает вовсе, — и
      // повторный проход слово в слово повторил бы уже опубликованную раскладку.
      //
      // Считается отдельно: это самый дорогой из проходов — полная привязка
      // всего буферизованного набора вторым разом за один flush, — и по общим
      // числам он не отделяется от проходов, вызванных событиями скролла.
      if (this.scroll !== predicted) {
        listPerf.count("mvcpSecondPass");
        this.calculateItemsInView();
      }

      this.restoring = false;
    });
  }

  private checkThresholds(): void {
    // Кромки считаются в координатах контента и по его полной высоте: только
    // так «до конца ноль» означает низ последнего кадра, а не низ последней
    // строки — под ней ещё лежат подвал и распорки.
    const context: IEdgeCheckContext = {
      scroll: this.getScroll(),
      scrollLength: this.scrollLength,
      contentSize: this.contentSize.get(),
      dataLength: this.props.data.length,
      contentInsetEnd: this.store.peek("anchoredEndSpaceSize") ?? 0,
      skipCallbacks:
        this.programmatic.isActive() ||
        this.maintainAtEnd.isActive() ||
        this.mvcp.isSettling() ||
        this.initialScroll.isActive(),
    };

    this.edges.check(context, this.allowedEdge);
  }

  /** Привязка контейнеров к элементам диапазона и раскладка их позиций. */
  private bindContainers(): void {
    const viewportTop = this.scroll;
    const viewportEnd = viewportTop + this.scrollLength;
    // Подрезка снимается заранее: на броске строка попадает в кадр раньше, чем
    // до неё дойдёт пересчёт, и обрезанное содержимое успевает мелькнуть.
    //
    // Пока список стоит, въезжать в кадр нечему, и запас работает против: между
    // тем, как React отрисовал строку новой высотой, и тем, как список узнал её
    // замером, проходит кадр — и в этом кадре разница вылезает за границы
    // строки поверх видимых. Строке, отведённое место которой уже не совпадает
    // с нарисованным, границы нужны именно тогда, когда её никто не двигает.
    const clipMargin = this.atRest ? 0 : this.props.drawDistance / 2;
    const stickyStartedAt = listPerf.enabled ? perfNow() : 0;
    const pinned = this.stickyPublisher.resolve(this.scroll, this.scrollLength);

    if (listPerf.enabled && this.props.sticky?.length) {
      listPerf.sample("stickyMs", perfNow() - stickyStartedAt);
      if (pinned.length > 0) listPerf.count("stickyPinned");
    }

    const pending = this.metrics.getPendingIndices();
    const cached = this.requestCache;
    const canReuseRequests =
      cached !== undefined &&
      cached.start === this.range.startBuffered &&
      cached.end === this.range.endBuffered &&
      cached.revision === this.requestRevision &&
      this.haveSameIndices(cached.pinned, pinned) &&
      this.haveSameIndices(cached.pending, pending);
    const requests = canReuseRequests
      ? cached.requests
      : collectContainerRequests({
          startBuffered: this.range.startBuffered,
          endBuffered: this.range.endBuffered,
          pinned,
          pending,
          getKey: index => this.items.getKey(index),
          getType: index => this.items.getType(index),
          getStickyEdge: index => this.sticky.getEdgeOf(index),
        });

    if (!canReuseRequests) {
      this.requestCache = {
        start: this.range.startBuffered,
        end: this.range.endBuffered,
        pinned: [...pinned],
        pending: [...pending],
        revision: this.requestRevision,
        requests,
      };
    }

    if (listPerf.enabled) {
      listPerf.count("bind");
      if (canReuseRequests) listPerf.count("bindCached");
    }

    this.binder.bind({
      requests,
      revision: this.layoutRevision,
      clipTop: viewportTop - clipMargin,
      clipEnd: viewportEnd + clipMargin,
    });
  }

  /** Пересчёт раскладки по текущему смещению. */
  private runScrollPass(): void {
    this.lastPassAt = Date.now();
    this.calculateItemsInView();
  }

  /**
   * Слить события кадра в один проход.
   *
   * Смещение берётся не из отложившего события, а живое: к моменту кадра оно
   * успевает уехать, и считать по старому — снова делать работу мимо экрана.
   */
  private deferPass(): void {
    if (this.deferredPass !== undefined) return;

    this.deferredPass = requestAnimationFrame(() => {
      this.deferredPass = undefined;

      // Замеры уже ждут полноценного layout-pass. Выполни сейчас scroll-pass —
      // он увидит новые метрики раньше MVCP и опубликует один кадр с новыми
      // позициями, но старой компенсацией. Layout-pass следом вернёт экран на
      // место, а эта пара commit-ов и выглядит как рывок при движении вверх.
      // Если раскладка уже пересчиталась в этом кадре, повторять тоже нечего.
      if (
        this.scheduler.isPending() ||
        shouldDeferScrollPass(Date.now() - this.lastPassAt)
      ) {
        listPerf.count("passMerged");

        return;
      }

      const startedAt = listPerf.enabled ? perfNow() : 0;
      const live = this.adapter?.getOffset?.();

      // Только вперёд по ходу движения — как и в основном проходе: живое
      // смещение позади текущего означает, что устарело как раз оно.
      if (
        live !== undefined &&
        Math.sign(live - this.getScroll()) === this.scrollDirection
      ) {
        this.scroll = live - this.getContentOrigin();
      }

      this.runScrollPass();
      this.checkThresholds();
      listPerf.sample("scrollMs", perfNow() - startedAt);
    });
  }

  /**
   * Годится ли строка в опору удержания позиции.
   *
   * Прилипающие строки не годятся. Их ключ адресует группу — день переписки,
   * заголовок раздела, — а не место в списке: подгрузка того же дня сверху
   * оставляет разделитель тем же элементом, но уводит его выше подгруженной
   * пачки. Удержание, опершись на него, честно оставит на месте разделитель — и
   * увезёт сообщение, на которое смотрит пользователь, ровно на высоту той
   * части пачки, что легла между ними.
   */
  private canAnchorAt(index: number): boolean {
    if (this.sticky.getEdgeOf(index) !== null) return false;

    return this.props.shouldRestorePosition?.(index) ?? true;
  }

  /**
   * Ход смещения по событиям — для диагностики.
   *
   * Величины снимаются здесь, а не в канале: живое нативное смещение стоит
   * вызова в нативный слой, и при выключенной диагностике его быть не должно.
   *
   * Рывок ищется сравнением с прошлой дельтой, а не с порогом в пикселях: на
   * медленном чтении рывком будет и десяток точек, а на броске полсотни —
   * норма. Выпавшей из ряда считается дельта, втрое разошедшаяся с предыдущей.
   */
  private reportScrollEvent(
    offset: number,
    previousEvent: number | undefined,
    ownMove: boolean,
  ): void {
    const native = this.adapter?.getOffset?.();
    const delta = offset - (previousEvent ?? offset);
    const velocity = this.velocity.get();
    const usual = this.usualEventDelta;

    logScrollEvent({
      offset,
      delta: signed(delta),
      velocity,
      native,
      lag: native === undefined ? undefined : Math.abs(native - offset),
      own: ownMove,
    });

    // У первого события дельта нулевая по построению: предыдущего смещения
    // нет. Ни рывком его считать, ни складывать в обычный ход нельзя — иначе
    // первое же настоящее движение окажется втрое больше нуля.
    if (previousEvent === undefined) return;

    // Обычного хода ещё нет — список стоял, и первое движение из покоя рывком
    // не является: сравнивать его не с чем.
    const jumped =
      usual !== undefined && Math.abs(delta) > usual * JUMP_RATIO + JUMP_MIN_PX;

    if (jumped) {
      logScrollJump({
        offset,
        delta: signed(delta),
        usual,
        velocity,
        own: ownMove,
      });
    }

    this.usualEventDelta =
      usual === undefined
        ? Math.abs(delta)
        : usual * (1 - JUMP_SMOOTHING) + Math.abs(delta) * JUMP_SMOOTHING;
  }

  /**
   * Диапазон отрисовки — для диагностики.
   *
   * Печатается после расчёта: смонтировано ровно то, что попало в
   * буферизованные границы, и по ним видно, была ли строка отрисована вообще.
   */
  private reportRange(): void {
    logLayoutRange({
      visible: `${this.range.start}..${this.range.end}`,
      buffered: `${this.range.startBuffered}..${this.range.endBuffered}`,
      scroll: this.scroll,
      velocity: this.velocity.get(),
      lookahead: getRangeLookahead(this.velocity.get(), this.scrollLength),
      count: this.range.endBuffered - this.range.startBuffered + 1,
    });
  }

  /** Замер одного прохода раскладки. */
  private reportLayoutPass(startedAt: number): void {
    listPerf.count("rangeCalc");
    listPerf.sample("rangeMs", perfNow() - startedAt);
    listPerf.sample(
      "windowItems",
      Math.max(0, this.range.end - this.range.start + 1),
    );
    listPerf.sample("containers", this.pool.getCount());
  }

  /**
   * Незакрытая часть вьюпорта на текущий момент.
   *
   * Снимается до привязки контейнеров, и в этом весь смысл: после неё строки
   * уже привязаны к тому месту, где скролл находится сейчас, и пустоты не видно
   * по построению. На экране же нарисовано то, что закоммичено прошлым
   * проходом, — вот его и нужно сравнивать с тем, куда скролл уже уехал.
   */
  private reportBlankSpace(stage: "before" | "after"): void {
    // Во время компенсации смещение UI-потока ещё не сдвинуто: пустота,
    // посчитанная по нему, была бы выдумкой.
    if (this.restoring) return;

    // Скрытый список пуст по построению: до первого показа в кадре нет ничего,
    // и считать это незакрытым вьюпортом значит объявлять дырой каждое
    // открытие — и в логе, и в счётчиках замера.
    if (this.store.peek("readyToRender") !== true) return;

    const blank = this.measureBlankSpace();

    if (blank <= MIN_BLANK_PX) return;

    logLayoutBlank({
      stage: stage === "before" ? "до" : "после",
      px: blank,
      scroll: this.getScroll(),
      buffered: `${this.range.startBuffered}..${this.range.endBuffered}`,
    });

    if (stage === "before") {
      listPerf.count("blankFrames");
      listPerf.sample("blankPx", blank);

      return;
    }

    // Осталось непокрытым даже после привязки: строк на это место у списка нет
    // вовсе. Всё остальное — задержка коммита, а не расчёта.
    listPerf.count("blankAfterBind");
    listPerf.sample("blankAfterPx", blank);
  }

  /**
   * Часть вьюпорта, не закрытая привязанными и измеренными элементами, px.
   *
   * Считается от смещения UI-потока, а не от того, что сейчас обрабатывает JS:
   * пустота видна там, куда скролл уже уехал, а не там, где его догоняет
   * пересчёт. Элементы, ждущие измерения, не считаются закрывшими вьюпорт —
   * на экране они пока оценочной высоты.
   */
  private measureBlankSpace(): number {
    const scroll =
      (this.adapter?.getOffset?.() ?? this.getScroll()) -
      this.getContentOrigin();
    const top = Math.max(0, scroll);
    const bottom = Math.min(
      scroll + this.scrollLength,
      this.metrics.getTotalSize(),
    );
    const expected = bottom - top;

    if (expected <= 0) return 0;

    let covered = 0;

    for (
      let index = this.range.startBuffered;
      index <= this.range.endBuffered;
      index++
    ) {
      const key = this.items.getKey(index);

      if (key === undefined || this.metrics.isPending(key)) continue;
      if (this.pool.getContainerByKey(key) === undefined) continue;

      const position = this.metrics.getPosition(index);
      const end = position + this.metrics.getSize(index);

      covered += Math.max(0, Math.min(end, bottom) - Math.max(position, top));
    }

    return Math.max(0, expected - covered);
  }

  private haveSameIndices(first: number[], second: number[]): boolean {
    return (
      first.length === second.length &&
      first.every((value, index) => value === second[index])
    );
  }
}
