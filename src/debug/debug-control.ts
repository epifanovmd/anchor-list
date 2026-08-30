import type {
  AnchorListDebugChannel,
  AnchorListDebugSpec,
  DebugChannelSelection,
  IDebugEventDescriptor,
  IDebugOptions,
} from "./debug-registry";
import { ANCHOR_LIST_DEBUG_CHANNELS, debugRegistry } from "./debug-registry";

/** Выбор из того, чем диагностику включают. */
const parseSpec = (
  spec: AnchorListDebugSpec,
): Map<AnchorListDebugChannel, DebugChannelSelection> => {
  const selection = new Map<AnchorListDebugChannel, DebugChannelSelection>();

  if (spec === false) return selection;

  if (spec === true) {
    for (const name of ANCHOR_LIST_DEBUG_CHANNELS) selection.set(name, true);

    return selection;
  }

  if (typeof spec === "string") {
    selection.set(spec, true);

    return selection;
  }

  if (Array.isArray(spec)) {
    for (const name of spec) selection.set(name, true);

    return selection;
  }

  for (const name of Object.keys(spec) as AnchorListDebugChannel[]) {
    const value = spec[name];

    if (value === undefined || value === false) continue;

    selection.set(name, value);
  }

  return selection;
};

/**
 * Включить диагностику.
 *
 * Заменяет выбор целиком — включённое прошлым вызовом гаснет. Так разбор всегда
 * начинается с известного состояния, а не с того, что осталось от прошлого.
 *
 * ```ts
 * setAnchorListDebug(true);                       // все каналы
 * setAnchorListDebug("mvcp");                     // одна механика
 * setAnchorListDebug(["mvcp", "layout"]);         // компенсация и раскладка
 * setAnchorListDebug({ scroll: ["jump"] });      // одно событие канала
 * setAnchorListDebug(false);                      // выключить всё
 * ```
 *
 * Канал целиком уместен, пока ищут, где ошиблось. Как только место известно,
 * стоит сузиться до событий: на быстрой прокрутке канал целиком утопит нужное
 * событие в потоке соседних.
 */
export const setAnchorListDebug = (spec: AnchorListDebugSpec): void => {
  debugRegistry.apply(parseSpec(spec));
};

/** Одна строка справки по событию: имя, частота и описание. */
const describeEvent = (
  channel: AnchorListDebugChannel,
  event: IDebugEventDescriptor,
): string => {
  // Подробность помечена прямо в справке: иначе включивший канал целиком будет
  // ждать строк, которых по замыслу не будет.
  const mark = event.detail ? " · подробность, включается по имени" : "";
  const lines = [`  ${channel}·${event.name} — ${event.about}${mark}`];

  for (const field of Object.keys(event.fields)) {
    lines.push(`      ${field.padEnd(12)} ${event.fields[field]}`);
  }

  return lines.join("\n");
};

/**
 * Управление диагностикой.
 *
 * Единая точка на все механики: каналы объявляют себя сами, а включение,
 * бюджет строк и справка живут здесь. Всё выключено по умолчанию и стоит одной
 * проверки признака на точку печати.
 */
export const anchorListDebug = {
  /** Добавить каналы к уже включённым. */
  enable(...names: AnchorListDebugChannel[]): void {
    const selection = debugRegistry.getSelection();

    for (const name of names) selection.set(name, true);

    debugRegistry.apply(selection);
  },

  /** Убрать каналы из включённых. */
  disable(...names: AnchorListDebugChannel[]): void {
    const selection = debugRegistry.getSelection();

    for (const name of names) selection.delete(name);

    debugRegistry.apply(selection);
  },

  /** Оставить включёнными только эти каналы. */
  only(...names: AnchorListDebugChannel[]): void {
    setAnchorListDebug(names);
  },

  /** Выключить всё. */
  off(): void {
    setAnchorListDebug(false);
  },

  /** Включён ли канал — целиком или отдельным событием. */
  isEnabled(channel: AnchorListDebugChannel, event?: string): boolean {
    return event === undefined
      ? debugRegistry.isChannelEnabled(channel)
      : debugRegistry.isEventEnabled(channel, event);
  },

  /** Потолок строк в секунду и приёмник печати. */
  configure(options: Partial<IDebugOptions>): void {
    debugRegistry.configure(options);
  },

  /** Что включено прямо сейчас. */
  status(): string {
    const parts: string[] = [];

    for (const [name, selection] of debugRegistry.getSelection()) {
      if (selection === true) parts.push(name);
      else if (Array.isArray(selection) && selection.length > 0) {
        parts.push(`${name}:${selection.join(",")}`);
      }
    }

    const line =
      parts.length === 0
        ? "диагностика выключена"
        : `включено: ${parts.join(" ")}`;

    console.log(line);

    return line;
  },

  /**
   * Справка: каналы, их события и подписи всех величин.
   *
   * Собирается из тех же объявлений, из которых печатаются строки, — значит
   * описание величины не может разойтись с тем, что стоит в логе.
   *
   * @param channel показать один канал; без него — оглавление всех.
   */
  help(channel?: AnchorListDebugChannel): string {
    const channels = debugRegistry
      .getChannels()
      .filter(item => channel === undefined || item.name === channel);

    const lines: string[] = [];

    for (const item of channels) {
      lines.push(`${item.name} — ${item.about}`);

      if (channel === undefined) {
        const overview = item.events.filter(event => !event.detail);
        const details = item.events.filter(event => event.detail);

        lines.push(`  события: ${overview.map(e => e.name).join(", ")}`);

        if (details.length > 0) {
          lines.push(
            `  подробности (по имени): ${details.map(e => e.name).join(", ")}`,
          );
        }
        continue;
      }

      for (const event of item.events) {
        lines.push(describeEvent(item.name, event));
      }
    }

    if (channel === undefined) {
      lines.push(
        "",
        'включение: setAnchorListDebug(true | "mvcp" | ["mvcp","layout"] | { scroll: ["jump"] })',
        'подробно о канале: anchorListDebug.help("mvcp")',
      );
    }

    const text = lines.join("\n");

    console.log(text);

    return text;
  },
};
