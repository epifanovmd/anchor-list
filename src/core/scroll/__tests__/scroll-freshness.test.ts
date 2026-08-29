import { resolveFreshOffset } from "../scroll-freshness";

const params = {
  offset: 1000,
  live: undefined as number | undefined,
  previous: 0,
  current: 0,
  scrollLength: 700,
};

describe("resolveFreshOffset", () => {
  it("оставляет смещение события, пока оно не отстало", () => {
    expect(resolveFreshOffset({ ...params, live: 1100 })).toBe(1000);
  });

  it("берёт живое смещение, когда событие отстало по ходу движения", () => {
    expect(resolveFreshOffset({ ...params, live: 9000 })).toBe(9000);
  });

  it("берёт живое смещение и при движении назад", () => {
    expect(
      resolveFreshOffset({
        ...params,
        offset: 9000,
        previous: 10000,
        current: 10000,
        live: 1000,
      }),
    ).toBe(1000);
  });

  it("не прыгает против направления события", () => {
    expect(resolveFreshOffset({ ...params, live: 0, previous: 0 })).toBe(1000);
  });

  it("без живого смещения остаётся событие", () => {
    expect(resolveFreshOffset(params)).toBe(1000);
  });

  it("до замера вьюпорта подменять не по чему", () => {
    expect(resolveFreshOffset({ ...params, live: 9000, scrollLength: 0 })).toBe(
      1000,
    );
  });

  /**
   * Очередь устаревших событий: JS не успевает, и события приходят пачкой, все
   * далеко позади живого смещения. Направление обязано читаться по самой пачке —
   * она идёт вперёд, — а не по тому, куда список уже переставили.
   *
   * Если считать направление от применённого смещения, то после первой же
   * подмены следующее событие выглядит движением назад, подмена не срабатывает,
   * и список откатывается к устаревшему смещению. Через событие — снова вперёд.
   * Это и есть моргание на месте: контейнеры перепривязываются на каждом
   * проходе, а на экране мелькает пустота.
   */
  it("не мечется между устаревшими событиями и живым смещением", () => {
    const live = 50000;
    const queued = [1000, 1024, 1048, 1072, 1096];
    let current = 0;

    const resolved = queued.map((offset, index) => {
      current = resolveFreshOffset({
        offset,
        live,
        // Предыдущее событие пачки, а не то, что применили в прошлый раз.
        previous: queued[index - 1] ?? offset,
        current,
        scrollLength: 700,
      });

      return current;
    });

    // Первое событие направления не имеет, дальше пачка целиком идёт на живое.
    expect(resolved).toEqual([1000, live, live, live, live]);
  });

  it("не откатывается к событию, когда lag только что стал меньше порога", () => {
    // Реальная последовательность из устройства: на предыдущем событии lag
    // был 721px и раскладка уже перешла на живые 4883px. Следующее событие всё
    // ещё старее нативной позиции, но отстаёт уже меньше половины вьюпорта.
    // Возврат к 5238 откатывал виртуализацию назад на 355px.
    expect(
      resolveFreshOffset({
        offset: 5238,
        previous: 5604.7,
        current: 4883.3,
        live: 4883.3,
        scrollLength: 741,
      }),
    ).toBe(4883.3);
  });
});
