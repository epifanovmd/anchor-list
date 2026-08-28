/** Что печатается одной строкой: имя величины и её значение. */
type DebugValues = Record<string, unknown>;

const format = (value: unknown): string => {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  return String(value);
};

const describe = (values: DebugValues): string =>
  Object.entries(values)
    .map(([name, value]) => `${name}=${format(value)}`)
    .join(" ");

/** Последняя напечатанная строка на ключ — по ней отсекаются повторы. */
const previous = new Map<string, string>();

let enabled = false;

/**
 * Диагностика прилипания.
 *
 * Зачем нужна: прилипание считается в трёх местах сразу — ядро выбирает
 * активный якорь, привязка публикует его геометрию контейнеру, worklet считает
 * смещение на каждом кадре. Расхождение любых двух видно на экране как
 * исчезнувший или застывший якорь, но по самому экрану не сказать, какое из
 * трёх ошиблось.
 *
 * Печатает только изменения: повтор той же строки с тем же ключом отбрасывается,
 * иначе на скролле лог сам стал бы нагрузкой.
 *
 * Выключена по умолчанию; включается на время разбора:
 * `anchorListStickyDebug.enable()`.
 */
export const anchorListStickyDebug = {
  get enabled(): boolean {
    return enabled;
  },

  enable(): void {
    enabled = true;
    previous.clear();
  },

  disable(): void {
    enabled = false;
    previous.clear();
  },

  /**
   * Строка лога, если она отличается от прошлой с тем же ключом.
   *
   * @param scope раздел: `active`, `bind`, `frame`, `pin`.
   * @param key что считать одним и тем же наблюдением — обычно индекс якоря.
   */
  log(scope: string, key: string, values: DebugValues): void {
    if (!enabled) return;

    const line = describe(values);

    if (previous.get(`${scope}:${key}`) === line) return;

    previous.set(`${scope}:${key}`, line);
    console.log(`[sticky·${scope}] ${key} ${line}`);
  },
};
