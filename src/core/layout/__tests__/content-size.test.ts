import { ListMetrics } from "../../../model";
import { ContentSize } from "../content-size";

const createContentSize = () => {
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const keys = Array.from({ length: 10 }, (_, index) => `k${index}`);
  const state = { flushPending: false };

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );
  // Размеры объявлены: раскладка не зависит от среднего по типу.
  for (const key of keys) metrics.setFixedSize(key, 100);

  const contentSize = new ContentSize({
    metrics,
    isFlushPending: () => state.flushPending,
  });

  return { metrics, contentSize, state };
};

describe("ContentSize", () => {
  it("до замера считает контент суммой элементов", () => {
    const { contentSize } = createContentSize();

    expect(contentSize.get()).toBe(1000);
  });

  it("запоминает вклад шапки и подвала", () => {
    const { contentSize } = createContentSize();

    // Сумма элементов 1000, замер 1140 — 140 приходится на шапку и подвал.
    contentSize.setMeasured(1140);

    expect(contentSize.get()).toBe(1140);
  });

  it("держит отступ между обновлениями данных", () => {
    const { metrics, contentSize } = createContentSize();

    contentSize.setMeasured(1140);
    metrics.setFixedSize("k0", 300);

    // Отступ меняется куда реже самих элементов.
    expect(contentSize.get()).toBe(1340);
  });

  it("игнорирует замер, пока пересчёт раскладки отложен", () => {
    const { contentSize, state } = createContentSize();

    contentSize.setMeasured(1140);
    state.flushPending = true;
    // Замер сделан по старой сумме элементов: разница ушла бы в отступ.
    contentSize.setMeasured(2000);

    expect(contentSize.get()).toBe(1140);
  });

  it("отбрасывает замер ниже суммы элементов", () => {
    const { contentSize } = createContentSize();

    contentSize.setMeasured(1140);
    // Контент не может быть ниже своих элементов: замер отстал от раскладки.
    contentSize.setMeasured(800);

    expect(contentSize.get()).toBe(1140);
  });

  it("принимает нулевой отступ", () => {
    const { contentSize } = createContentSize();

    contentSize.setMeasured(1140);
    contentSize.setMeasured(1000);

    expect(contentSize.get()).toBe(1000);
  });
});
