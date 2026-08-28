import { ListMetrics } from "../../../model";
import { ItemSource } from "../item-source";

interface IRow {
  id: string;
  kind?: string;
  height?: number;
}

const createSource = () => {
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const source = new ItemSource<IRow>({ metrics });

  return { metrics, source };
};

const extractors = {
  keyExtractor: (item: IRow) => item.id,
};

const rows = (count: number, prefix = "k"): IRow[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}` }));

describe("ItemSource", () => {
  it("разбирает данные в ключи и типы", () => {
    const { source } = createSource();

    source.apply([{ id: "a", kind: "photo" }, { id: "b" }], {
      ...extractors,
      getItemType: item => item.kind ?? "",
    });

    expect(source.getCount()).toBe(2);
    expect(source.getKey(0)).toBe("a");
    expect(source.getType(0)).toBe("photo");
    expect(source.getType(1)).toBe("");
    expect(source.getKey(5)).toBeUndefined();
    expect(source.getType(5)).toBe("");
  });

  it("передаёт объявленные размеры в метрики", () => {
    const { metrics, source } = createSource();

    source.apply([{ id: "a", height: 40 }, { id: "b" }], {
      ...extractors,
      getFixedItemSize: item => item.height,
    });

    expect(metrics.getSizeByKey("a")).toBe(40);
    expect(metrics.hasMeasured("b")).toBe(false);
  });

  it("не помечает ожидающими элементы первого наполнения", () => {
    const { metrics, source } = createSource();

    // Там новые все, и до измерений список всё равно не показан.
    source.apply(rows(3), extractors);

    expect(metrics.getPendingIndices()).toEqual([]);
  });

  it("не отводит места элементам, появившимся позже", () => {
    const { metrics, source } = createSource();

    source.apply(rows(3), extractors);
    for (const key of ["k0", "k1", "k2"]) metrics.setMeasuredSize(key, 50);

    source.apply([{ id: "new" }, ...rows(3)], extractors);

    expect(metrics.isPending("new")).toBe(true);
    expect(metrics.getSize(0)).toBe(0);
  });

  it("пропускает пометку у пачки больше предела", () => {
    const { metrics, source } = createSource();

    source.apply(rows(1), extractors);
    metrics.setMeasuredSize("k0", 50);

    // Смонтировать разом страницу истории ради измерения дороже, чем полоса на
    // один кадр: большая пачка идёт по среднему.
    source.apply([...rows(33, "new"), ...rows(1)], extractors);

    expect(metrics.getPendingIndices()).toEqual([]);
  });

  it("помечает пачку ровно по пределу", () => {
    const { metrics, source } = createSource();

    source.apply(rows(1), extractors);
    metrics.setMeasuredSize("k0", 50);

    source.apply([...rows(32, "new"), ...rows(1)], extractors);

    expect(metrics.getPendingIndices()).toHaveLength(32);
  });

  it("не считает появившимся элемент, оставшийся в данных", () => {
    const { metrics, source } = createSource();

    source.apply(rows(2), extractors);
    metrics.setMeasuredSize("k0", 50);
    metrics.setMeasuredSize("k1", 50);

    source.apply([...rows(2), { id: "tail" }], extractors);

    expect(metrics.getPendingIndices()).toEqual([2]);
  });

  it("справляется с полной сменой данных", () => {
    const { metrics, source } = createSource();

    source.apply(rows(3), extractors);
    source.apply([], extractors);

    expect(source.getCount()).toBe(0);
    expect(metrics.getTotalSize()).toBe(0);
  });
});
