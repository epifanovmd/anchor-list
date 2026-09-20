import { ListMetrics } from "../list-metrics";

const createMetrics = () => new ListMetrics({ estimatedItemSize: 100 });

describe("ListMetrics — зазоры", () => {
  it("раскладывает строки с зазорами из данных", () => {
    const metrics = createMetrics();

    metrics.setItems(["a", "b", "c"], ["", "", ""], [0, 4, 12]);

    expect(metrics.getPosition(1)).toBe(104);
    expect(metrics.getPosition(2)).toBe(216);
    expect(metrics.getTotalSize()).toBe(316);
    expect(metrics.getGap(2)).toBe(12);
  });

  it("без зазоров раскладывает как раньше", () => {
    const metrics = createMetrics();

    metrics.setItems(["a", "b"], ["", ""]);

    expect(metrics.getPosition(1)).toBe(100);
    expect(metrics.getGap(1)).toBe(0);
  });

  it("сменившийся зазор двигает раскладку и при тех же ключах", () => {
    // Зазор — свойство пары строк: сообщение отредактировали, и оно сменило
    // автора группы. Ключи те же, а раскладка ниже поехала.
    const metrics = createMetrics();

    metrics.setItems(["a", "b", "c"], ["", "", ""], [0, 4, 4]);
    metrics.getTotalSize();
    metrics.setItems(["a", "b", "c"], ["", "", ""], [0, 4, 12]);

    expect(metrics.getPosition(2)).toBe(216);
    expect(metrics.getTotalSize()).toBe(316);
  });

  it("зазор перед первой строкой не применяется", () => {
    const metrics = createMetrics();

    metrics.setItems(["a", "b"], ["", ""], [20, 20]);

    expect(metrics.getPosition(0)).toBe(0);
    expect(metrics.getPosition(1)).toBe(120);
  });
});
