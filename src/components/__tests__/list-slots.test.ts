import { createElement, isValidElement } from "react";

import { renderListSlot } from "../list-slots";

const Header = () => null;

describe("renderListSlot", () => {
  it("ничего не рисует без слота", () => {
    expect(renderListSlot(undefined)).toBeNull();
    expect(renderListSlot(null)).toBeNull();
  });

  it("отдаёт готовый элемент как есть", () => {
    const element = createElement(Header);

    expect(renderListSlot(element)).toBe(element);
  });

  it("создаёт элемент из типа компонента", () => {
    const result = renderListSlot(Header);

    // Тип именно создаётся элементом, а не вызывается функцией: иначе хуки
    // внутри слота оказались бы хуками самого списка.
    expect(isValidElement(result)).toBe(true);
    expect((result as { type: unknown }).type).toBe(Header);
  });
});
