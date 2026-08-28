import { KeyIndex } from "../key-index";

const types = (count: number, type = "") =>
  Array.from({ length: count }, () => type);

describe("KeyIndex", () => {
  it("адресует элементы по ключу", () => {
    const index = new KeyIndex();

    index.setItems(["a", "b", "c"], types(3));

    expect(index.getIndexByKey("b")).toBe(1);
    expect(index.getKey(2)).toBe("c");
    expect(index.getCount()).toBe(3);
    expect(index.getIndexByKey("missing")).toBeUndefined();
  });

  it("отдаёт пустой тип элементу без getItemType", () => {
    const index = new KeyIndex();

    index.setItems(["a"], []);

    expect(index.getType(0)).toBe("");
    expect(index.getType(10)).toBe("");
  });

  it("считает расхождением конец совпадающего префикса", () => {
    const index = new KeyIndex();

    index.setItems(["a", "b", "c"], types(3));

    // Дописанный хвост: всё, что выше, стоит на своих местах.
    expect(index.setItems(["a", "b", "c", "d"], types(4))).toBe(3);
  });

  it("находит расхождение при вставке в начало", () => {
    const index = new KeyIndex();

    index.setItems(["a", "b"], types(2));

    expect(index.setItems(["new", "a", "b"], types(3))).toBe(0);
  });

  it("считает расхождением конец укоротившегося списка", () => {
    const index = new KeyIndex();

    index.setItems(["a", "b", "c"], types(3));

    expect(index.setItems(["a", "b"], types(2))).toBe(2);
  });

  it("забывает ключи, которых больше нет в данных", () => {
    const index = new KeyIndex();

    index.setItems(["a", "b"], types(2));
    index.setItems(["b"], types(1));

    expect(index.getIndexByKey("a")).toBeUndefined();
    expect(index.getIndexByKey("b")).toBe(0);
  });
});
