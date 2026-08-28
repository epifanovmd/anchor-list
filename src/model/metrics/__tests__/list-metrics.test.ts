import { ListMetrics } from "../list-metrics";

const createMetrics = (estimatedItemSize = 100) =>
  new ListMetrics({ estimatedItemSize });

const keys = (count: number, prefix = "k") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

const types = (count: number, type = "") =>
  Array.from({ length: count }, () => type);

describe("ListMetrics", () => {
  it("до измерения раскладывает элементы по оценке", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(3), types(3));

    expect(metrics.getPosition(0)).toBe(0);
    expect(metrics.getPosition(1)).toBe(100);
    expect(metrics.getPosition(2)).toBe(200);
    expect(metrics.getTotalSize()).toBe(300);
  });

  it("пересчитывает суммарный размер при укорачивании хвоста", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(5), types(5));
    expect(metrics.getTotalSize()).toBe(500);

    metrics.setItems(keys(3), types(3));

    expect(metrics.getTotalSize()).toBe(300);
  });

  it("не считает средним по типу элемент, чей размер уже задан", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(4), types(4));
    metrics.setMeasuredSize("k0", 40);
    metrics.setMeasuredSize("k1", 40);

    // Переиспользованный контейнер отдаёт новому элементу свою высоту: без неё
    // тот остался бы на среднем и ездил бы при каждом новом измерении.
    metrics.setMeasuredSize("k2", 40);
    metrics.setMeasuredSize("k3", 200);

    expect(metrics.getPosition(2)).toBe(80);
    expect(metrics.getPosition(3)).toBe(120);
    expect(metrics.getTotalSize()).toBe(320);
  });

  it("не отводит места элементу до первого измерения", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(3), types(3));
    for (const key of keys(3)) metrics.setMeasuredSize(key, 50);

    // Появился новый элемент в начале: пока он не измерен, места он не занимает
    // и раскладку остальных не двигает.
    metrics.setItems(["new", ...keys(3)], types(4));
    metrics.markPending("new");

    expect(metrics.getSize(0)).toBe(0);
    expect(metrics.getPosition(1)).toBe(0);
    expect(metrics.getTotalSize()).toBe(150);

    // Измерение возвращает элементу его место одним шагом.
    metrics.setMeasuredSize("new", 70);

    expect(metrics.getPosition(1)).toBe(70);
    expect(metrics.getTotalSize()).toBe(220);
  });

  it("называет ожидающих поимённо — их обязан отрисовать список", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(3), types(3));
    for (const key of keys(3)) metrics.setMeasuredSize(key, 50);

    metrics.setItems(["a", "b", ...keys(3)], types(5));
    metrics.markPending("a");
    metrics.markPending("b");

    // Нулевой слот схлопывает их в одну точку: сами в диапазон отрисовки они
    // не попадут, и измерить их будет нечем.
    expect(metrics.getPendingIndices().sort()).toEqual([0, 1]);
    expect(metrics.isPending("a")).toBe(true);

    metrics.setMeasuredSize("a", 30);

    expect(metrics.getPendingIndices()).toEqual([1]);
  });

  it("возвращает обычный размер тем, до кого измерение так и не дошло", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(3), types(3));
    for (const key of keys(3)) metrics.setMeasuredSize(key, 50);

    metrics.setItems(["new", ...keys(3)], types(4));
    metrics.markPending("new");
    metrics.clearPending();

    // Элемент вне буфера отрисовки измерить некому — он идёт по среднему.
    expect(metrics.getSize(0)).toBe(50);
    expect(metrics.getTotalSize()).toBe(200);
  });

  it("перестаёт двигать оценку, набрав достаточно замеров", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(64), types(64));
    for (let index = 0; index < 32; index++) {
      metrics.setMeasuredSize(`k${index}`, 40);
    }

    const estimate = metrics.getSize(63);

    metrics.setMeasuredSize("k32", 400);

    expect(metrics.getSize(63)).toBe(estimate);
  });

  it("оценивает соседей по первому измерению их типа", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(3), types(3));
    metrics.setMeasuredSize("k0", 50);

    // k1 и k2 не измерены, но их тип уже имеет измерение — оценка идёт по нему.
    expect(metrics.getSize(1)).toBe(50);
    expect(metrics.getPosition(2)).toBe(100);
    expect(metrics.getTotalSize()).toBe(150);
  });

  it("сохраняет измеренные размеры при вставке в начало", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], types(2));
    metrics.setMeasuredSize("a", 30);
    metrics.setMeasuredSize("b", 70);

    metrics.setItems(["new", "a", "b"], types(3));

    expect(metrics.getSizeByKey("a")).toBe(30);
    expect(metrics.getSizeByKey("b")).toBe(70);
    // Вставленный элемент не измерен: его размер — среднее по типу, (30 + 70) / 2.
    expect(metrics.getPosition(1)).toBe(50);
    expect(metrics.getPosition(2)).toBe(80);
  });

  it("возвращает индекс расхождения при смене данных", () => {
    const metrics = createMetrics();

    metrics.setItems(["a", "b", "c"], types(3));

    expect(metrics.setItems(["a", "b", "x"], types(3))).toBe(2);
    expect(metrics.setItems(["z", "b", "x"], types(3))).toBe(0);
  });

  it("оценивает неизмеренный элемент средним по его типу", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["photo1", "photo2", "text1"], ["photo", "photo", "text"]);
    metrics.setMeasuredSize("photo1", 300);

    expect(metrics.getSize(1)).toBe(300);
    expect(metrics.getSize(2)).toBe(100);
  });

  it("обновляет среднее при повторном измерении того же элемента", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], ["row", "row"]);
    metrics.setMeasuredSize("a", 200);
    metrics.setMeasuredSize("a", 400);

    // Уточнённое среднее достаётся тем, кто оценки ещё не получал.
    metrics.setItems(["a", "b", "c"], ["row", "row", "row"]);

    expect(metrics.getSize(2)).toBe(400);
  });

  it("не меняет выданную оценку задним числом", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], ["row", "row"]);
    metrics.setMeasuredSize("a", 200);

    expect(metrics.getSize(1)).toBe(200);

    metrics.setMeasuredSize("a", 400);

    // Иначе каждое измерение переставляло бы разом все неизмеренные строки:
    // суммарная высота гуляет, а позиции ниже вьюпорта едут на десятки.
    expect(metrics.getSize(1)).toBe(200);
  });

  it("сообщает об изменении раскладки только при новом размере", () => {
    const metrics = createMetrics();

    metrics.setItems(["a"], types(1));

    expect(metrics.setMeasuredSize("a", 50)).toBe(true);
    expect(metrics.setMeasuredSize("a", 50)).toBe(false);
  });

  it("принимает измерение элемента, которого уже нет в данных", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], types(2));
    metrics.setItems(["b"], types(1));

    // Измерение приходит асинхронно и застаёт элемент удалённым: замер всё
    // равно сохраняется — элемент может вернуться.
    expect(metrics.setMeasuredSize("a", 33)).toBe(true);
    expect(metrics.getSizeByKey("a")).toBe(33);
  });

  it("находит элемент по смещению", () => {
    const metrics = createMetrics(100);

    metrics.setItems(keys(5), types(5));

    expect(metrics.findIndexAtOffset(0)).toBe(0);
    expect(metrics.findIndexAtOffset(250)).toBe(2);
    expect(metrics.findIndexAtOffset(10000)).toBe(4);
  });

  it("не падает на пустых данных", () => {
    const metrics = createMetrics();

    metrics.setItems([], []);

    expect(metrics.getTotalSize()).toBe(0);
    expect(metrics.findIndexAtOffset(100)).toBe(0);
    expect(metrics.getCount()).toBe(0);
  });

  it("учитывает объявленные размеры без измерения", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], types(2));
    metrics.setFixedSize("a", 20);

    expect(metrics.hasMeasured("a")).toBe(true);
    expect(metrics.getPosition(1)).toBe(20);

    // Повторное объявление того же размера раскладку не двигает.
    metrics.setFixedSize("a", 20);

    expect(metrics.getPosition(1)).toBe(20);
  });

  it("отдаёт ключ, индекс и позицию по ключу", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], types(2));

    expect(metrics.getKey(1)).toBe("b");
    expect(metrics.getIndexByKey("b")).toBe(1);
    expect(metrics.getPositionByKey("b")).toBe(100);
    expect(metrics.getPositionByKey("missing")).toBeUndefined();
  });

  it("не перебивает объявленный размер измерением", () => {
    const metrics = createMetrics(100);

    metrics.setItems(["a", "b"], types(2));
    metrics.setFixedSize("a", 120);

    expect(metrics.setMeasuredSize("a", 120.33)).toBe(false);
    expect(metrics.getSize(0)).toBe(120);
    expect(metrics.willResize("a", 200)).toBe(false);
  });
});
