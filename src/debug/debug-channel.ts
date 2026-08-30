import {
  formatDebugLine,
  formatDebugValue,
  formatDebugValues,
} from "./debug-format";
import type {
  AnchorListDebugChannel,
  IDebugEventDescriptor,
} from "./debug-registry";
import { debugNow, debugRegistry } from "./debug-registry";

/**
 * Как часто печатать событие.
 *
 * - `"always"` — каждое. Для редких событий, где важен сам факт: компенсация
 *   применена, кромка сработала, список показан;
 * - `"changes"` — только когда строка отличается от прошлой с тем же ключом.
 *   Для состояний: пока прилипший якорь тот же, повторять его геометрию нечем;
 * - `{ everyMs }` — не чаще раза в интервал на ключ. Для потока: событий
 *   скролла десятки в секунду, и печать каждого меняет то, что измеряется.
 */
export type DebugRepeat = "always" | "changes" | { everyMs: number };

/** Величины события: имя → что показывает и о чём говорит. */
export type DebugFields = Record<string, string>;

/** Объявление одного события канала. */
export interface IDebugEventSpec<TFields extends DebugFields> {
  /**
   * Что печатает событие и о чём говорит сам факт его появления.
   *
   * Это первое, что читают в справке: по описанию решают, включать канал или
   * нет, — поэтому здесь именно наблюдаемый смысл, а не место в коде.
   */
  about: string;
  /**
   * Величины в порядке печати.
   *
   * Каждая подписана: что показывает и какой вывод из неё следует. Величина без
   * такого объяснения в лог не попадает — по числу, смысл которого приходится
   * вспоминать, разбор идёт дольше, чем без него.
   */
  fields: TFields;
  /** По умолчанию — `"always"`. */
  repeat?: DebugRepeat;
  /**
   * Подробность: включается только по имени, а не вместе с каналом.
   *
   * Зачем: у механики есть обзорные события — где список стоит, что пошло не
   * так, — и поштучные, которых на каждый кадр приходится по нескольку.
   * Включённые вместе с каналом, вторые топят первые: на прокрутке в логе
   * остаётся возня с контейнерами, а не то, ради чего его открыли.
   *
   * Числа за окно по таким событиям и так есть — их считает замер. Здесь они
   * нужны поштучно и только тогда, когда разбор дошёл именно до них:
   * `setAnchorListDebug({ layout: ["recycle"] })`.
   */
  detail?: boolean;
  /**
   * По каким величинам считать строку изменившейся.
   *
   * Нужно там, где рядом с состоянием печатается живая величина: диапазон
   * отрисовки меняется редко, а смещение, по которому он посчитан, — каждый
   * кадр. Сравнивая строку целиком, отсечение повторов не отсекло бы ничего, и
   * состояние утонуло бы в потоке собственного контекста.
   *
   * Работает и вместе с интервалом: тогда строка печатается не чаще раза в
   * интервал **и** только если названные величины изменились.
   */
  compare?: (keyof TFields & string)[];
  /**
   * Поле, по которому различаются наблюдения.
   *
   * Оно же печатается ключом строки. Повторы отсекаются в пределах ключа:
   * геометрия двух прилипших якорей не должна заглушать друг друга.
   */
  key?: keyof TFields & string;
  /**
   * Событие говорит о том, что механика не сделала того, ради чего есть.
   *
   * Такие строки помечаются `!` за скобкой имени и ищутся в логе первыми:
   * компенсация не нашла якоря, строка не удержала место, вьюпорт остался
   * незакрытым.
   */
  problem?: boolean;
}

/** Печать события: величины передаются все, порядок задан объявлением. */
export type DebugEventLogger<TFields extends DebugFields> = (values: {
  [K in keyof TFields]: unknown;
}) => void;

/** Канал диагностики одной механики. */
export interface IDebugChannel {
  readonly name: AnchorListDebugChannel;
  /**
   * Канал включён хотя бы одним событием.
   *
   * Проверяется до сбора величин: снять живое нативное смещение или пройти по
   * диапазону дороже, чем напечатать строку.
   */
  readonly enabled: boolean;
  /** Включено ли конкретное событие — для тех же дорогих подготовок. */
  on(event: string): boolean;
  /** Объявить событие и получить его печать. */
  event<TFields extends DebugFields>(
    name: string,
    spec: IDebugEventSpec<TFields>,
  ): DebugEventLogger<TFields>;
  /**
   * Объявить событие, которое печатает UI-поток.
   *
   * Печать там своя — {@link logFromWorklet}: реестр worklet-у не виден, а
   * отсечение повторов держится на shared values самого вызывающего. Здесь
   * объявляются только величины, чтобы такое событие стояло в справке рядом с
   * остальными и подписи не разъезжались с тем, что печатается.
   *
   * @returns имя события — его же передают в печать.
   */
  worklet<TFields extends DebugFields>(
    name: string,
    spec: IDebugEventSpec<TFields>,
  ): string;
}

/**
 * Канал диагностики.
 *
 * **Единый принцип всех каналов.** Канал — это одна механика. Он объявляет
 * события, событие объявляет свои величины, каждая величина подписана. Из этих
 * объявлений собирается и строка лога, и справка `anchorListDebug.help()` — так
 * они не могут разойтись между собой.
 *
 * Из этого следует три правила, общих для всех каналов:
 *
 * 1. **Событие печатает всё, из чего сложилось решение**, а не только итог.
 *    Компенсация без величины, на которую уехал якорь, отвечает «сдвинул на
 *    18» — и не отвечает, почему именно на 18. Разбор упирается в это на
 *    первом же шаге;
 * 2. **Событие знает, как часто оно бывает** — см. {@link DebugRepeat}. Поток
 *    прореживается интервалом, состояние — сравнением с прошлой строкой. Канал,
 *    печатающий каждый кадр, меняет то, что измеряет;
 * 3. **Событие знает, проблема это или ход дела.** Строки с `problem` ищут
 *    первыми, поэтому признак ставится только там, где механика действительно
 *    не сделала своего дела.
 */
export const createDebugChannel = (
  name: AnchorListDebugChannel,
  about: string,
): IDebugChannel => {
  const events: IDebugEventDescriptor[] = [];
  /** Имена событий-подробностей: их не включает канал целиком. */
  const details = new Set<string>();

  /** Событие печатается: обзорное — с каналом, подробность — только по имени. */
  const isOn = (event: string): boolean =>
    details.has(event)
      ? debugRegistry.isEventListed(name, event)
      : debugRegistry.isEventEnabled(name, event);

  debugRegistry.register({ name, about, events });

  return {
    name,

    get enabled(): boolean {
      return debugRegistry.isChannelEnabled(name);
    },

    on(event: string): boolean {
      return isOn(event);
    },

    worklet<TFields extends DebugFields>(
      eventName: string,
      spec: IDebugEventSpec<TFields>,
    ): string {
      events.push({
        name: eventName,
        about: spec.about,
        fields: spec.fields,
        detail: spec.detail ?? false,
      });
      if (spec.detail) details.add(eventName);

      return eventName;
    },

    event<TFields extends DebugFields>(
      eventName: string,
      spec: IDebugEventSpec<TFields>,
    ): DebugEventLogger<TFields> {
      events.push({
        name: eventName,
        about: spec.about,
        fields: spec.fields,
        detail: spec.detail ?? false,
      });
      if (spec.detail) details.add(eventName);

      const repeat = spec.repeat ?? "always";
      const problem = spec.problem ?? false;
      const fieldNames = Object.keys(spec.fields);
      /** Прошлая строка и её время — на ключ: повторы отсекаются в пределах ключа. */
      const lastLine = new Map<string, string>();
      const lastAt = new Map<string, number>();
      /** Поколение выбора, при котором накоплена память о повторах. */
      let generation = debugRegistry.getGeneration();

      return values => {
        if (!isOn(eventName)) return;

        // Диагностику включили заново: то, что было напечатано в прошлый раз,
        // на экране давно не видно, и гасить по нему первую строку нельзя —
        // именно с неё начинается разбор.
        if (generation !== debugRegistry.getGeneration()) {
          generation = debugRegistry.getGeneration();
          lastLine.clear();
          lastAt.clear();
        }

        // Порядок печати задаётся объявлением, а не порядком ключей у
        // вызывающего: колонки в логе обязаны стоять на одних местах, иначе
        // строки не читаются столбиком.
        const printed: Record<string, unknown> = {};

        // Ключевое поле уже стоит своей колонкой — второй раз оно только
        // удлиняет строку.
        for (const field of fieldNames) {
          if (field !== spec.key) printed[field] = values[field];
        }

        const key =
          spec.key === undefined
            ? ""
            : `${values[spec.key] === undefined ? "—" : String(values[spec.key])}`;

        // Интервал и сравнение работают вместе: поток состояния прореживается
        // временем, а внутри интервала печатается только то, что изменилось.
        if (repeat !== "always" && repeat !== "changes") {
          const now = debugNow();

          if (now - (lastAt.get(key) ?? -Infinity) < repeat.everyMs) return;

          lastAt.set(key, now);
        }

        if (repeat === "changes" || spec.compare) {
          const compared = spec.compare
            ? spec.compare
                .map(field => formatDebugValue(values[field]))
                .join(" ")
            : formatDebugValues(printed);

          if (lastLine.get(key) === compared) return;

          lastLine.set(key, compared);
        }

        debugRegistry.emit(
          formatDebugLine({
            elapsed: debugRegistry.elapsed(),
            channel: name,
            event: eventName,
            key,
            problem,
            values: formatDebugValues(printed),
          }),
        );
      };
    },
  };
};
