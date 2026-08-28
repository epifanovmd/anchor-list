import { listPerf, perfNow } from "../../perf";

/**
 * Пакетирование пересчёта раскладки.
 *
 * Зачем нужно: при первом наполнении списка измерения ячеек приходят десятками
 * подряд, каждое отдельным событием. Пересчёт на каждое из них стоил бы стольких
 * же полных проходов по раскладке.
 *
 * Какую проблему решает: изменения копятся до конца кадра и применяются одним
 * проходом. Заодно это даёт удержанию позиции единую базу: якорь снимается до
 * первого изменения пачки, а восстанавливается после последнего.
 */
export class LayoutScheduler {
  private readonly run: () => void;
  private pending = false;

  constructor(run: () => void) {
    this.run = run;
  }

  /** Идёт ожидание конца кадра. */
  isPending(): boolean {
    return this.pending;
  }

  /** Запросить пересчёт; повторные запросы в том же кадре ничего не стоят. */
  schedule(): void {
    if (this.pending) return;

    this.pending = true;

    const scheduledAt = listPerf.enabled ? perfNow() : 0;

    requestAnimationFrame(() => {
      // Задержка до кадра — прямая мера занятости JS-потока: пока он занят,
      // измеренные высоты не применяются, и на экране остаются оценочные.
      listPerf.sample("flushDelayMs", perfNow() - scheduledAt);
      this.pending = false;
      this.run();
    });
  }
}
