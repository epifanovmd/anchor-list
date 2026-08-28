import { perfNow } from "./list-perf-metrics";

/**
 * Кадр длиннее этого — просадка.
 *
 * Полтора кадра при 60 Гц: до этой границы промах ещё укладывается в один
 * пропущенный vsync, дальше — уже видимый рывок.
 */
const LONG_FRAME_MS = 24;

/** Статистика кадров JS-потока за окно замера. */
export interface IFrameStats {
  frames: number;
  longFrames: number;
  worstMs: number;
}

/**
 * Счётчик кадров JS-потока.
 *
 * Зачем нужен: виртуализация считается в JS, и её цена видна именно как
 * растянутые кадры. Число сравнимо между любыми списками — оно не зависит от
 * их устройства.
 */
export class FrameMonitor {
  private running = false;
  private last = 0;
  private frames = 0;
  private longFrames = 0;
  private worstMs = 0;

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
    };

    this.frames = 0;
    this.longFrames = 0;
    this.worstMs = 0;

    return stats;
  }

  private tick = (): void => {
    if (!this.running) return;

    const time = perfNow();
    const delta = time - this.last;

    this.last = time;
    this.frames++;

    if (delta > LONG_FRAME_MS) this.longFrames++;
    if (delta > this.worstMs) this.worstMs = delta;

    requestAnimationFrame(this.tick);
  };
}
