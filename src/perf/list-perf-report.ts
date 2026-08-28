import type { IFrameStats } from "./frame-monitor";
import type { IListPerfStatValue, IListPerfWindow } from "./list-perf-metrics";

/** Всё, из чего собирается одна строка лога. */
export interface IListPerfReport {
  /** Какой список замеряется: свой или эталонный. */
  label: string;
  /** Заголовок строки: окно или итог сессии. */
  title: string;
  durationMs: number;
  frames: IFrameStats;
  window: IListPerfWindow;
}

const avg = (stat: IListPerfStatValue): number =>
  stat.count === 0 ? 0 : stat.sum / stat.count;

/** Среднее и максимум одной величины — «сред/макс». */
const pair = (stat: IListPerfStatValue, digits = 1): string =>
  `${avg(stat).toFixed(digits)}/${stat.max.toFixed(digits)}`;

/**
 * Отчёт одного окна замера — одной строкой на раздел.
 *
 * Разделы, по которым за окно ничего не происходило, не печатаются: в логе
 * быстрого скролла важно видеть, что изменилось между итерациями, а не полную
 * таблицу нулей.
 */
export const formatListPerfReport = ({
  label,
  title,
  durationMs,
  frames,
  window,
}: IListPerfReport): string => {
  const seconds = Math.max(durationMs, 1) / 1000;
  const { counters, stats } = window;
  const lines = [`[list·${label}] ${title} ${seconds.toFixed(1)}с`];

  lines.push(
    `  кадры     ${(frames.frames / seconds).toFixed(0)}fps · длинных ${
      frames.longFrames
    } · худший ${frames.worstMs.toFixed(0)}мс`,
  );

  if (counters.scrollEvents > 0) {
    const parts = [
      `${counters.scrollEvents} соб`,
      `${stats.scrollPx.sum.toFixed(0)}px`,
    ];

    if (stats.velocity.count > 0) {
      parts.push(`v ${stats.velocity.max.toFixed(1)}px/мс`);
    }

    if (stats.lagPx.count > 0) parts.push(`лаг ${pair(stats.lagPx, 0)}px`);
    if (stats.scrollMs.count > 0) parts.push(`JS ${pair(stats.scrollMs, 2)}мс`);

    lines.push(`  скролл    ${parts.join(" · ")}`);
  }

  if (counters.rangeCalc > 0) {
    lines.push(
      `  диапазон  ${counters.rangeCalc} пересчётов · ${pair(
        stats.rangeMs,
        2,
      )}мс · слито ${counters.passDeferred}+${counters.passMerged} · окно ${avg(
        stats.windowItems,
      ).toFixed(0)} · контейнеров ${stats.containers.max}`,
    );
  }

  if (counters.bind > 0) {
    lines.push(
      `  привязка  ${counters.bind} (кэш ${counters.bindCached}, без правок ${counters.bindSkipped}) · перепривязок ${counters.rebind} · освобождено ${counters.release} · новых ${counters.containerNew}`,
    );
  }

  if (counters.rangeCalc > 0) {
    lines.push(
      counters.blankFrames > 0
        ? `  пустоты   ${counters.blankFrames} проходов · ${pair(
            stats.blankPx,
            0,
          )}px · не привязано ${counters.blankAfterBind} · ${pair(
            stats.blankAfterPx,
            0,
          )}px`
        : `  пустоты   нет`,
    );
  }

  if (stats.stickyMs.count > 0) {
    lines.push(
      `  стики     ${counters.stickyPinned} закреплений · ${pair(
        stats.stickyMs,
        2,
      )}мс`,
    );
  }

  if (counters.measure > 0 || counters.measureSkipped > 0) {
    lines.push(
      `  измерения ${counters.measure} · принято ${
        counters.measureApplied
      } · пропущено ${counters.measureSkipped} · правка ${pair(
        stats.resizePx,
        0,
      )}px`,
    );
  }

  if (counters.flush > 0) {
    lines.push(
      `  раскладка ${counters.flush} flush · задержка ${pair(
        stats.flushDelayMs,
        1,
      )}мс · ${pair(stats.flushMs, 2)}мс`,
    );
  }

  if (counters.mvcpCapture > 0 || counters.mvcpRestore > 0) {
    lines.push(
      `  mvcp      ${counters.mvcpCapture} захватов · ${counters.mvcpRestore} восстановлений (данные ${counters.mvcpByData} / размер ${counters.mvcpBySize}) · сдвиг ${pair(
        stats.mvcpShiftPx,
        0,
      )}px`,
    );

    if (
      counters.mvcpClamped > 0 ||
      counters.mvcpNoAnchor > 0 ||
      counters.mvcpFallbackAnchor > 0 ||
      counters.mvcpMissed > 0
    ) {
      lines.push(
        `            упор ${counters.mvcpClamped} · потеряно ${pair(
          stats.mvcpLostPx,
          0,
        )}px · без якоря ${counters.mvcpNoAnchor} · запасной якорь ${
          counters.mvcpFallbackAnchor
        } · промах ${counters.mvcpMissed} на ${pair(stats.mvcpErrorPx, 0)}px`,
      );
    }
  }

  if (counters.renderItem > 0 || counters.cellRender > 0) {
    const perThousand =
      stats.scrollPx.sum > 0
        ? (counters.renderItem / stats.scrollPx.sum) * 1000
        : 0;

    const cells =
      counters.cellRender > 0 ? ` · ячеек ${counters.cellRender}` : "";

    lines.push(
      `  рендеры   renderItem ${
        counters.renderItem
      }${cells} · на 1000px ${perThousand.toFixed(0)}`,
    );
  }

  return lines.join("\n");
};
