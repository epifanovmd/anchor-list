import { ItemSizes } from "../item-sizes";

const createSizes = (estimatedItemSize = 100) =>
  new ItemSizes({ estimatedItemSize });

describe("ItemSizes — источники размера", () => {
  it("до измерения отдаёт общую оценку", () => {
    const sizes = createSizes(100);

    expect(sizes.resolve("a", "")).toBe(100);
    expect(sizes.resolve(undefined, "")).toBe(100);
  });

  it("предпочитает измеренный размер оценке", () => {
    const sizes = createSizes(100);

    sizes.setMeasured("a", 42, "");

    expect(sizes.resolve("a", "")).toBe(42);
    expect(sizes.getKnown("a")).toBe(42);
  });

  it("оценивает неизмеренный элемент средним по его типу", () => {
    const sizes = createSizes(100);

    sizes.setMeasured("photo1", 300, "photo");

    // Того же типа — среднее по типу, а не общая оценка.
    expect(sizes.resolve("photo2", "photo")).toBe(300);
    // Тип без измерений остаётся на оценке.
    expect(sizes.resolve("text1", "text")).toBe(100);
  });
});

describe("ItemSizes — объявленные размеры", () => {
  it("не перебивает объявленный размер измерением", () => {
    const sizes = createSizes(100);

    sizes.setFixed("a", 120);

    // Фактическая высота приходит округлённой к пикселям устройства.
    expect(sizes.setMeasured("a", 120.33, "")).toBe(false);
    expect(sizes.resolve("a", "")).toBe(120);
    expect(sizes.willResize("a", 200)).toBe(false);
  });

  it("сообщает об изменении только при новом объявленном размере", () => {
    const sizes = createSizes(100);

    expect(sizes.setFixed("a", 20)).toBe(true);
    expect(sizes.setFixed("a", 20)).toBe(false);
    expect(sizes.isKnown("a")).toBe(true);
  });
});

describe("ItemSizes — приём измерений", () => {
  it("игнорирует расхождение меньше пикселя", () => {
    const sizes = createSizes(100);

    sizes.setMeasured("a", 120, "");

    // iOS округляет кадр к сетке экрана: принять такое значит замкнуть цикл
    // «пересчёт → сдвиг → новое округление».
    expect(sizes.willResize("a", 120.4)).toBe(false);
    expect(sizes.willResize("a", 121)).toBe(true);
  });

  it("принимает первое измерение любой величины", () => {
    const sizes = createSizes(100);

    expect(sizes.willResize("a", 0.5)).toBe(true);
  });

  it("сообщает об изменении раскладки только при новом размере", () => {
    const sizes = createSizes(100);

    expect(sizes.setMeasured("a", 50, "")).toBe(true);
    expect(sizes.setMeasured("a", 50, "")).toBe(false);
  });
});

describe("ItemSizes — ожидание первого измерения", () => {
  it("не отводит места ожидающему элементу", () => {
    const sizes = createSizes(100);

    expect(sizes.markPending("new")).toBe(true);
    expect(sizes.isPending("new")).toBe(true);
    expect(sizes.resolve("new", "")).toBe(0);
  });

  it("не помечает элемент, размер которого уже известен", () => {
    const sizes = createSizes(100);

    sizes.setMeasured("a", 50, "");
    sizes.setFixed("b", 50);

    expect(sizes.markPending("a")).toBe(false);
    expect(sizes.markPending("b")).toBe(false);
  });

  it("не помечает повторно уже ожидающего", () => {
    const sizes = createSizes(100);

    sizes.markPending("new");

    expect(sizes.markPending("new")).toBe(false);
  });

  it("снимает ожидание измерением", () => {
    const sizes = createSizes(100);

    sizes.markPending("new");
    sizes.setMeasured("new", 70, "");

    expect(sizes.isPending("new")).toBe(false);
    expect(sizes.resolve("new", "")).toBe(70);
  });

  it("возвращает обычный размер тем, до кого измерение не дошло", () => {
    const sizes = createSizes(100);

    sizes.setMeasured("a", 50, "");
    sizes.markPending("new");

    expect(sizes.getPendingKeys()).toEqual(["new"]);
    expect(sizes.clearPending()).toEqual(["new"]);

    // Элемент вне буфера отрисовки измерить некому — он идёт по среднему.
    expect(sizes.resolve("new", "")).toBe(50);
    expect(sizes.clearPending()).toEqual([]);
  });
});

describe("ItemSizes — замороженная оценка", () => {
  it("не меняет выданную оценку при уточнении среднего", () => {
    const sizes = new ItemSizes({ estimatedItemSize: 100 });

    expect(sizes.resolve("b", "row")).toBe(100);

    sizes.setMeasured("a", 300, "row");

    // Иначе строка переезжает от чужого измерения, ни разу не отрисовавшись.
    expect(sizes.resolve("b", "row")).toBe(100);
  });

  it("новому ключу отдаёт накопленное среднее", () => {
    const sizes = new ItemSizes({ estimatedItemSize: 100 });

    sizes.setMeasured("a", 300, "row");

    expect(sizes.resolve("b", "row")).toBe(300);
  });

  it("измерение отменяет оценку", () => {
    const sizes = new ItemSizes({ estimatedItemSize: 100 });

    expect(sizes.resolve("a", "row")).toBe(100);

    sizes.setMeasured("a", 240, "row");

    expect(sizes.resolve("a", "row")).toBe(240);
  });

  it("объявленный размер отменяет оценку", () => {
    const sizes = new ItemSizes({ estimatedItemSize: 100 });

    expect(sizes.resolve("a", "row")).toBe(100);

    sizes.setFixed("a", 55);

    expect(sizes.resolve("a", "row")).toBe(55);
  });

  it("ожидающий не занимает места и не тратит оценку", () => {
    const sizes = new ItemSizes({ estimatedItemSize: 100 });

    sizes.markPending("a");

    expect(sizes.resolve("a", "row")).toBe(0);

    sizes.setMeasured("b", 300, "row");
    sizes.clearPending();

    // Оценка выдаётся по среднему на момент, когда место действительно нужно.
    expect(sizes.resolve("a", "row")).toBe(300);
  });
});
