import type { IFrameStats } from "./frame-monitor";
import { FrameMonitor } from "./frame-monitor";
import type {
  IListPerfWindow,
  ListPerfCounter,
  ListPerfStat,
} from "./list-perf-metrics";
import {
  createListPerfWindow,
  mergeListPerfWindow,
  perfNow,
} from "./list-perf-metrics";
import { formatListPerfReport } from "./list-perf-report";

/** Как часто накопленное уходит в консоль, мс. */
const FLUSH_INTERVAL_MS = 1000;

const createFrameStats = (): IFrameStats => ({
  frames: 0,
  longFrames: 0,
  worstMs: 0,
});

/**
 * Замер списка: счётчики копятся, в консоль уходят пачкой раз в секунду.
 *
 * Зачем нужен: на быстром скролле поштучный лог сам становится нагрузкой и
 * меняет то, что измеряет. Здесь на событие приходится сложение числа, а строки
 * собираются раз в окно.
 *
 * Включается только стендами производительности ({@link start}); в остальное
 * время каждая точка замера — одна проверка `enabled`.
 */
class ListPerf {
  /** Читается на каждом вызове в ядре — проверять до вызова методов. */
  enabled = false;

  private label = "";
  private startedAt = 0;
  private windowStartedAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly frameMonitor = new FrameMonitor();
  private window: IListPerfWindow = createListPerfWindow();
  private session: IListPerfWindow = createListPerfWindow();
  private sessionFrames = createFrameStats();

  /** Начать сессию; `label` попадает в каждую строку лога. */
  start(label: string): void {
    if (this.enabled) this.stop();

    this.label = label;
    this.window = createListPerfWindow();
    this.session = createListPerfWindow();
    this.sessionFrames = createFrameStats();
    this.startedAt = perfNow();
    this.windowStartedAt = this.startedAt;
    this.enabled = true;
    this.frameMonitor.start();
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  /** Закрыть сессию и напечатать итог за всё время. */
  stop(): void {
    if (!this.enabled) return;

    this.flush();
    this.enabled = false;
    this.frameMonitor.stop();

    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;

    console.log(
      formatListPerfReport({
        label: this.label,
        title: "итог",
        durationMs: perfNow() - this.startedAt,
        frames: this.sessionFrames,
        window: this.session,
      }),
    );
  }

  /** Отметить событие; вызов при выключенном замере ничего не стоит. */
  count(name: ListPerfCounter, amount = 1): void {
    if (!this.enabled) return;

    this.window.counters[name] += amount;
  }

  /** Добавить замер величины: в отчёт пойдут среднее и максимум. */
  sample(name: ListPerfStat, value: number): void {
    if (!this.enabled) return;

    const stat = this.window.stats[name];

    stat.count++;
    stat.sum += value;
    if (value > stat.max) stat.max = value;
  }

  /** Печать окна и перенос накопленного в итог сессии. */
  private flush(): void {
    const frames = this.frameMonitor.take();
    const durationMs = perfNow() - this.windowStartedAt;
    const hasActivity =
      this.window.counters.scrollEvents > 0 ||
      this.window.counters.renderItem > 0 ||
      this.window.counters.rangeCalc > 0;

    if (hasActivity) {
      console.log(
        formatListPerfReport({
          label: this.label,
          title: "окно",
          durationMs,
          frames,
          window: this.window,
        }),
      );
    }

    mergeListPerfWindow(this.session, this.window);
    this.sessionFrames.frames += frames.frames;
    this.sessionFrames.longFrames += frames.longFrames;
    this.sessionFrames.worstMs = Math.max(
      this.sessionFrames.worstMs,
      frames.worstMs,
    );

    this.window = createListPerfWindow();
    this.windowStartedAt = perfNow();
  }
}

/** Единственный замер на приложение: списки пишут в него, стенды включают. */
export const listPerf = new ListPerf();
