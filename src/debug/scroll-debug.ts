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
 * Диагностика дрожания при прокрутке.
 *
 * Зачем нужна: строка меряется, когда до неё дошла отрисовка, — то есть уже на
 * ходу. Её настоящий размер расходится с оценкой, контент под ней уезжает, и
 * ровно на столько же список правит смещение. Расхождение любых двух величин в
 * этой цепочке видно на экране рывком, но по экрану не сказать, где именно
 * разошлось: в замере, в компенсации или в том, что список не успел отрисовать.
 *
 * Разделы:
 *
 * - `resize` — замер, применённый на ходу: насколько строка разошлась с
 *   оценкой. Это исходная причина любого сдвига;
 * - `mvcp` — компенсация: на сколько уехал якорь и сколько из этого доехало до
 *   смещения. `anchor=нет` означает, что держать было не за что и контент
 *   поехал без компенсации;
 * - `blank` — незакрытая часть вьюпорта: список не успел отрисовать то, куда
 *   уехал скролл. Видно полосой;
 * - `event` — ход самого смещения: на ровной прокрутке дельты соседних событий
 *   близки, а рывок — это дельта, выпавшая из ряда. `native` и `lag` говорят,
 *   дошёл ли сдвиг до нативного слоя;
 * - `miss` — опорная строка не удержала своё место на экране: `before` и
 *   `after` — её расстояние до верхней кромки до изменения и после. Это то
 *   самое, что видно глазом.
 *
 * Печать сама стоит кадров: сравнивать по ней нужно числа, а не ощущение
 * плавности.
 *
 * Выключена по умолчанию; включается на время разбора: `setScrollDebug(true)`.
 */
export const anchorListScrollDebug = {
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

    console.log(`[scroll·${scope}] ${line}`);
  },
};

/** Признак диагностики прокрутки. */
export const setScrollDebug = (value: boolean): void => {
  if (value) anchorListScrollDebug.enable();
  else anchorListScrollDebug.disable();
};
