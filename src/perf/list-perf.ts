import { createFrameStats, FrameMonitor } from "./frame-monitor";
import type {
  IListPerfWindow,
  ListPerfCounter,
  ListPerfStat,
} from "./list-perf-metrics";
import {
  createListPerfWindow,
  describeListPerfMetrics,
  mergeListPerfWindow,
  perfNow,
} from "./list-perf-metrics";
import type { IListPerfReport } from "./list-perf-report";
import { formatListPerfReport } from "./list-perf-report";

/** Как часто накопленное уходит в консоль, мс. */
const FLUSH_INTERVAL_MS = 1000;

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
  /** Куда уходит отчёт; подменяется стендом, который рисует числа сам. */
  private sink: (report: IListPerfReport, text: string) => void = (_, text) =>
    console.log(text);

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

    this.report({
      label: this.label,
      title: "итог",
      durationMs: perfNow() - this.startedAt,
      frames: this.sessionFrames,
      window: this.session,
    });
  }

  /**
   * Куда отдавать готовый отчёт.
   *
   * Зачем: стенду числа нужны на экране, а не в логе — на устройстве консоль
   * читать неоткуда, да и сама печать стоит кадров, которые же и меряются.
   * Отчёт отдаётся и структурой, и готовой строкой: рисовать по нему можно
   * что угодно, а печатать — тем же форматом, что и всегда.
   */
  setSink(sink: (report: IListPerfReport, text: string) => void): void {
    this.sink = sink;
  }

  /**
   * Накопленное за сессию на текущий момент.
   *
   * Нужно тому, кто показывает числа сам: окно закрывается раз в секунду, а
   * экран обновляется чаще.
   */
  getSnapshot(): IListPerfReport {
    return {
      label: this.label,
      title: "сессия",
      durationMs: perfNow() - this.startedAt,
      frames: this.sessionFrames,
      window: this.session,
    };
  }

  /** Справка по метрикам: что каждая считает и о чём говорит. */
  help(): string {
    const text = describeListPerfMetrics();

    console.log(text);

    return text;
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

  /** Отчёт наружу: структурой и готовой строкой сразу. */
  private report(report: IListPerfReport): void {
    this.sink(report, formatListPerfReport(report));
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
      this.report({
        label: this.label,
        title: "окно",
        durationMs,
        frames,
        window: this.window,
      });
    }

    mergeListPerfWindow(this.session, this.window);
    this.sessionFrames.frames += frames.frames;
    this.sessionFrames.longFrames += frames.longFrames;
    this.sessionFrames.worstMs = Math.max(
      this.sessionFrames.worstMs,
      frames.worstMs,
    );
    // Процентили сессии — худшие из оконных, а не среднее: сложить их нельзя,
    // а брать большее честно — так видно самое плохое окно прогона.
    this.sessionFrames.medianMs = Math.max(
      this.sessionFrames.medianMs,
      frames.medianMs,
    );
    this.sessionFrames.p95Ms = Math.max(this.sessionFrames.p95Ms, frames.p95Ms);

    this.window = createListPerfWindow();
    this.windowStartedAt = perfNow();
  }
}

/** Единственный замер на приложение: списки пишут в него, стенды включают. */
export const listPerf = new ListPerf();
