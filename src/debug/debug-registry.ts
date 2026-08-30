import { formatDebugLine } from "./debug-format";

/**
 * Каналы диагностики — по одному на механику.
 *
 * Разбиение повторяет разделы документации намеренно: симптом на экране
 * приводит к разделу, раздел — к каналу с тем же именем.
 */
export type AnchorListDebugChannel =
  | "scroll"
  | "mvcp"
  | "layout"
  | "sticky"
  | "initial"
  | "edges"
  | "view"
  | "insets";

/** Все каналы в порядке, в котором их печатает справка. */
export const ANCHOR_LIST_DEBUG_CHANNELS: AnchorListDebugChannel[] = [
  "scroll",
  "layout",
  "mvcp",
  "initial",
  "sticky",
  "edges",
  "view",
  "insets",
];

/**
 * Как канал включают.
 *
 * - `true` / `false` — канал целиком;
 * - список имён событий — только они: на быстрой прокрутке включить канал
 *   целиком значит утопить в потоке ровно то событие, ради которого включали.
 */
export type DebugChannelSelection = boolean | string[];

/** Чем включают диагностику: см. {@link setAnchorListDebug}. */
export type AnchorListDebugSpec =
  | boolean
  | AnchorListDebugChannel
  | AnchorListDebugChannel[]
  | Partial<Record<AnchorListDebugChannel, DebugChannelSelection>>;

/** Описание одного события канала — для справки. */
export interface IDebugEventDescriptor {
  name: string;
  /** Что печатает событие и о чём говорит сам факт его появления. */
  about: string;
  /** Каждая величина: что показывает и о чём говорит. */
  fields: Record<string, string>;
  /** Подробность: включается только по имени, а не вместе с каналом. */
  detail: boolean;
}

/** Описание канала — для справки. */
export interface IDebugChannelDescriptor {
  name: AnchorListDebugChannel;
  /** Что за механика и почему по экрану о ней не судить. */
  about: string;
  events: IDebugEventDescriptor[];
}

/** Настройки печати. */
export interface IDebugOptions {
  /**
   * Потолок строк в секунду на всю диагностику.
   *
   * Печать сама стоит кадров: сотня строк в секунду растягивает кадры сильнее,
   * чем то, что ими измеряют. Сверх потолка строки не печатаются, но считаются,
   * и число подавленных выходит следующей строкой — молча терять лог нельзя,
   * иначе по нему сделают неверный вывод.
   */
  maxLinesPerSecond: number;
  /** Куда печатать. Подменяется в тестах и стендах. */
  sink: (line: string) => void;
}

const DEFAULT_OPTIONS: IDebugOptions = {
  maxLinesPerSecond: 120,
  sink: line => console.log(line),
};

/** Часы диагностики: монотонные, если движок их даёт. */
export const debugNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Реестр каналов диагностики.
 *
 * Зачем один на всех: включение живёт отдельно от каналов. Стенд зовёт
 * `setAnchorListDebug("mvcp")` до того, как список смонтирован и модуль
 * компенсации вообще загружен, — состояние должно пережить этот порядок.
 * Поэтому реестр хранит выбор по имени, а канал спрашивает его при каждой
 * печати.
 *
 * Второе назначение — общий бюджет строк и общая шкала времени: без них каналы
 * заглушали бы друг друга и печатали несводимые между собой отметки.
 */
class DebugRegistry {
  private selection = new Map<AnchorListDebugChannel, DebugChannelSelection>();
  private readonly channels = new Map<
    AnchorListDebugChannel,
    IDebugChannelDescriptor
  >();
  /** Признаки каналов для UI-потока: worklet видит только shared values. */
  private readonly flags = new Map<
    AnchorListDebugChannel,
    { value: boolean }
  >();
  /**
   * Начало шкалы времени для UI-потока.
   *
   * Отметки обоих потоков обязаны идти по одной шкале: прилипание считается в
   * worklet-е, а решение, к чему прилипать, — в JS, и расходятся они как раз во
   * времени. Начало отсчёта поэтому одно и лежит в shared value.
   */
  private clock: { value: number } | undefined;
  private options: IDebugOptions = { ...DEFAULT_OPTIONS };

  /** Начало общей шкалы времени: ставится первым включением. */
  private startedAt = debugNow();
  /**
   * Номер поколения выбора: растёт на каждое изменение включённого.
   *
   * По нему события сбрасывают память о напечатанном. Без сброса диагностика,
   * включённая второй раз, молчала бы о состояниях, не изменившихся с прошлого
   * раза, — а именно их и включали смотреть.
   */
  private generation = 0;
  /** Начало текущей секунды бюджета и сколько строк в неё уже ушло. */
  private budgetStartedAt = 0;
  private budgetLines = 0;
  private suppressed = 0;

  /** Канал объявляет себя при загрузке своего модуля. */
  register(descriptor: IDebugChannelDescriptor): void {
    this.channels.set(descriptor.name, descriptor);
  }

  /** Описания каналов — для справки и тестов. */
  getChannels(): IDebugChannelDescriptor[] {
    return ANCHOR_LIST_DEBUG_CHANNELS.map(name =>
      this.channels.get(name),
    ).filter(
      (channel): channel is IDebugChannelDescriptor => channel !== undefined,
    );
  }

  /**
   * Канал включён хотя бы одним событием.
   *
   * Под этой проверкой стоят дорогие подготовки: собрать величины бывает
   * дороже, чем напечатать строку, — и при выключенной диагностике этого не
   * должно происходить вовсе.
   */
  isChannelEnabled(name: AnchorListDebugChannel): boolean {
    const selection = this.selection.get(name);

    return (
      selection === true || (Array.isArray(selection) && selection.length > 0)
    );
  }

  /** Событие включено: канал взят целиком или названо поимённо. */
  isEventEnabled(name: AnchorListDebugChannel, event: string): boolean {
    const selection = this.selection.get(name);

    if (selection === true) return true;

    return this.isEventListed(name, event);
  }

  /**
   * Событие названо поимённо.
   *
   * По этому спрашивают события-подробности: канал целиком их не включает —
   * поштучных строк на кадр приходится по нескольку, и обзор канала в них
   * тонет.
   */
  isEventListed(name: AnchorListDebugChannel, event: string): boolean {
    const selection = this.selection.get(name);

    return Array.isArray(selection) && selection.includes(event);
  }

  /** Поколение выбора: сменилось — накопленная память о повторах не годится. */
  getGeneration(): number {
    return this.generation;
  }

  /** Секунды от включения диагностики — общая шкала всех каналов. */
  elapsed(): number {
    return (debugNow() - this.startedAt) / 1000;
  }

  /**
   * Напечатать строку, если бюджет секунды ещё не выбран.
   *
   * Подавленные считаются: следующая прошедшая строка идёт вместе с их числом.
   * Так по логу видно, что часть событий не показана, — иначе редкое важное
   * событие пропало бы молча.
   */
  emit(line: string): void {
    const now = debugNow();

    if (now - this.budgetStartedAt >= 1000) {
      this.budgetStartedAt = now;
      this.budgetLines = 0;

      if (this.suppressed > 0) {
        const skipped = this.suppressed;

        this.suppressed = 0;
        this.options.sink(
          formatDebugLine({
            elapsed: this.elapsed(),
            channel: "debug",
            event: "budget",
            key: "",
            problem: true,
            values: `suppressed=${skipped} limit=${this.options.maxLinesPerSecond}/с`,
          }),
        );
      }
    }

    if (this.budgetLines >= this.options.maxLinesPerSecond) {
      this.suppressed++;

      return;
    }

    this.budgetLines++;
    this.options.sink(line);
  }

  /** Признак канала, читаемый с UI-потока. */
  getFlag(name: AnchorListDebugChannel): { value: boolean } | undefined {
    return this.flags.get(name);
  }

  /** Признак заводится лениво — тем, кому он нужен в worklet-е. */
  setFlag(name: AnchorListDebugChannel, flag: { value: boolean }): void {
    flag.value = this.isChannelEnabled(name);
    this.flags.set(name, flag);
  }

  /** Начало шкалы времени, читаемое с UI-потока. */
  setClock(clock: { value: number }): void {
    clock.value = this.startedAt;
    this.clock = clock;
  }

  /** Настройки печати: потолок строк и приёмник. */
  configure(options: Partial<IDebugOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /** Текущий выбор — что именно включено. */
  getSelection(): Map<AnchorListDebugChannel, DebugChannelSelection> {
    return new Map(this.selection);
  }

  /**
   * Применить выбор.
   *
   * Шкала времени перезапускается на переходе «ничего не включено → включено»:
   * секунды в логе отсчитываются от начала разбора, а не от старта приложения,
   * где они давно ушли в тысячи.
   */
  apply(selection: Map<AnchorListDebugChannel, DebugChannelSelection>): void {
    const wasEnabled = this.isAnyEnabled();

    this.selection = selection;
    this.generation++;

    if (!wasEnabled && this.isAnyEnabled()) {
      this.startedAt = debugNow();
      this.budgetStartedAt = this.startedAt;
      this.budgetLines = 0;
      this.suppressed = 0;
    }

    for (const [name, flag] of this.flags) {
      flag.value = this.isChannelEnabled(name);
    }

    if (this.clock) this.clock.value = this.startedAt;
  }

  /** Хоть один канал включён. */
  isAnyEnabled(): boolean {
    for (const name of this.selection.keys()) {
      if (this.isChannelEnabled(name)) return true;
    }

    return false;
  }
}

/** Единственный реестр на приложение. */
export const debugRegistry = new DebugRegistry();
