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

let enabled = false;

/**
 * Диагностика стартовой позиции.
 *
 * Зачем нужна: цель начального скролла считается по метрикам, а те до
 * измерения ячеек оценочные — поэтому позиция уточняется по кадрам и сдаётся
 * либо когда перестала уезжать, либо через десять попыток. По экрану не
 * сказать, чем кончилось: список открылся не там и от оценок, или цель была
 * посчитана верно, а увёл её кто-то следом.
 *
 * Печатает по строке на попытку — со всем, из чего цель сложилась.
 *
 * Выключена по умолчанию; включается на время разбора:
 * `setInitialScrollDebug(true)`.
 */
export const anchorListInitialScrollDebug = {
  get enabled(): boolean {
    return enabled;
  },

  enable(): void {
    enabled = true;
  },

  disable(): void {
    enabled = false;
  },

  log(scope: string, values: DebugValues): void {
    if (!enabled) return;

    const line = Object.entries(values)
      .map(([name, value]) => `${name}=${format(value)}`)
      .join(" ");

    console.log(`[initial·${scope}] ${line}`);
  },
};

/** Признак диагностики стартовой позиции. */
export const setInitialScrollDebug = (value: boolean): void => {
  if (value) anchorListInitialScrollDebug.enable();
  else anchorListInitialScrollDebug.disable();
};
