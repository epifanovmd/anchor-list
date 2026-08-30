import { perfNow } from "./list-perf-metrics";

/**
 * Кадр длиннее этого — просадка.
 *
 * Полтора кадра при 60 Гц: до этой границы промах ещё укладывается в один
 * пропущенный vsync, дальше — уже видимый рывок.
 */
const LONG_FRAME_MS = 24;

/**
 * Потолок гистограммы, мс.
 *
 * Всё, что дольше, попадает в последнюю корзину: отличать кадр в 300 мс от
 * кадра в 500 мс незачем — оба означают остановившийся список, а худший кадр
 * считается точно и отдельно.
 */
const HISTOGRAM_LIMIT_MS = 250;

/** Статистика кадров JS-потока за окно замера. */
export interface IFrameStats {
  frames: number;
  longFrames: number;
  worstMs: number;
  /**
   * Половина кадров уложилась в это время.
   *
   * Медиана отвечает на вопрос «как список идёт обычно» — среднее на неё не
   * годится: одна остановка в полсекунды поднимает его так, что ровный участок
   * становится неотличим от рваного.
   */
  medianMs: number;
  /**
   * Девяносто пять процентов кадров уложились в это время.
   *
   * Здесь живёт рывок: единичный худший кадр бывает и от чужой работы в
   * приложении, а вот выросший p95 — это уже сам список.
   */
  p95Ms: number;
}

/** Пустая статистика: окно, в котором кадров не было. */
export const createFrameStats = (): IFrameStats => ({
  frames: 0,
  longFrames: 0,
  worstMs: 0,
  medianMs: 0,
  p95Ms: 0,
});

/**
 * Счётчик кадров JS-потока.
 *
 * Зачем нужен: виртуализация считается в JS, и её цена видна именно как
 * растянутые кадры. Число сравнимо между любыми списками — оно не зависит от
 * их устройства.
 *
 * Длительности копятся гистограммой по миллисекунде, а не списком: за минуту
 * замера кадров тысячи, и хранить их все ради двух процентилей значит платить
 * памятью за то, что считается сложением.
 */
export class FrameMonitor {
  private running = false;
  private last = 0;
  private frames = 0;
  private longFrames = 0;
  private worstMs = 0;
  private readonly histogram = new Uint32Array(HISTOGRAM_LIMIT_MS + 1);

  /** Начать счёт кадров; повторный вызов ничего не меняет. */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.last = perfNow();
    requestAnimationFrame(this.tick);
  }

  /** Прекратить счёт: обход кадров больше не планируется. */
  stop(): void {
    this.running = false;
  }

  /** Забрать статистику окна и начать новое. */
  take(): IFrameStats {
    const stats: IFrameStats = {
      frames: this.frames,
      longFrames: this.longFrames,
      worstMs: this.worstMs,
      medianMs: this.percentile(0.5),
      p95Ms: this.percentile(0.95),
    };

    this.frames = 0;
    this.longFrames = 0;
    this.worstMs = 0;
    this.histogram.fill(0);

    return stats;
  }

  /** Квантиль по гистограмме: первая корзина, накрывшая нужную долю кадров. */
  private percentile(share: number): number {
    if (this.frames === 0) return 0;

    const target = this.frames * share;
    let seen = 0;

    for (let ms = 0; ms < this.histogram.length; ms++) {
      seen += this.histogram[ms]!;

      if (seen >= target) return ms;
    }

    return HISTOGRAM_LIMIT_MS;
  }

  private tick = (): void => {
    if (!this.running) return;

    const time = perfNow();
    const delta = time - this.last;

    this.last = time;
    this.frames++;
    this.histogram[Math.min(Math.round(delta), HISTOGRAM_LIMIT_MS)]!++;

    if (delta > LONG_FRAME_MS) this.longFrames++;
    if (delta > this.worstMs) this.worstMs = delta;

    requestAnimationFrame(this.tick);
  };
}
