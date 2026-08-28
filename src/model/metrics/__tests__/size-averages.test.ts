import { TypeSizeAverages } from "../size-averages";

describe("TypeSizeAverages", () => {
  it("не знает среднего до первого замера", () => {
    const averages = new TypeSizeAverages();

    expect(averages.get("row")).toBeUndefined();
  });

  it("считает среднее по каждому типу отдельно", () => {
    const averages = new TypeSizeAverages();

    averages.add("photo", undefined, 300);
    averages.add("text", undefined, 40);
    averages.add("text", undefined, 60);

    expect(averages.get("photo")).toBe(300);
    expect(averages.get("text")).toBe(50);
  });

  it("правит сумму при повторном замере того же элемента", () => {
    const averages = new TypeSizeAverages();

    averages.add("row", undefined, 100);
    // Тот же элемент, а не новый образец: число замеров не растёт.
    averages.add("row", 100, 200);

    expect(averages.get("row")).toBe(200);
  });

  it("перестаёт двигать среднее, набрав достаточно замеров", () => {
    const averages = new TypeSizeAverages();

    for (let index = 0; index < 32; index++) averages.add("row", undefined, 40);

    const settled = averages.get("row");

    // Замер, резко выбивающийся из набранного, оценку соседей уже не сдвинет:
    // иначе каждое измерение переставляло бы разом все неотрисованные строки.
    averages.add("row", undefined, 400);

    expect(averages.get("row")).toBe(settled);
  });
});
