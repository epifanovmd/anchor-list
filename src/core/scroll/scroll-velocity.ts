/** Точка истории скролла. */
interface IScrollSample {
  scroll: number;
  time: number;
}

/** Точки старше окна в расчёт не идут — скорость должна затухать на паузе. */
const VELOCITY_WINDOW_MS = 1000;
/** Вес точки падает вдвое каждые столько миллисекунд. */
const VELOCITY_HALF_LIFE_MS = 200;
const MAX_SAMPLES = 10;

/**
 * Скорость скролла по недавней истории смещений, px/мс.
 *
 * Свежие точки весят больше старых, а на смене направления история обрывается:
 * иначе после разворота жеста скорость какое-то время показывает старую сторону,
 * и буфер отрисовки уезжает не туда.
 */
export class ScrollVelocityTracker {
  private samples: IScrollSample[] = [];

  /** Добавить точку истории; время — для тестов, обычно берётся текущее. */
  add(scroll: number, time: number = Date.now()): void {
    this.samples.push({ scroll, time });

    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  /** Забыть историю: следующая скорость посчитается с нуля. */
  reset(): void {
    this.samples = [];
  }

  /** Положительная — к концу списка, отрицательная — к началу. */
  get(now: number = Date.now()): number {
    const newest = this.samples[this.samples.length - 1];

    if (this.samples.length < 2 || !newest) return 0;
    if (now - newest.time > VELOCITY_WINDOW_MS) return 0;

    let direction = 0;
    let weightedSum = 0;
    let totalWeight = 0;

    for (let index = this.samples.length - 1; index > 0; index--) {
      const current = this.samples[index]!;
      const previous = this.samples[index - 1]!;

      const scrollDelta = current.scroll - previous.scroll;
      const timeDelta = current.time - previous.time;
      const sign = Math.sign(scrollDelta);

      if (sign !== 0) {
        if (direction === 0) {
          direction = sign;
        } else if (sign !== direction) {
          break;
        }
      }

      if (newest.time - previous.time > VELOCITY_WINDOW_MS) break;
      if (scrollDelta === 0 || timeDelta <= 0) continue;

      const weight = Math.exp(
        -(newest.time - current.time) / VELOCITY_HALF_LIFE_MS,
      );

      weightedSum += (scrollDelta / timeDelta) * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}
