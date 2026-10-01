import { createElement, isValidElement } from "react";

import { renderListSlot, resolveSlotGaps } from "../list-slots";

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

describe("resolveSlotGaps", () => {
  const present = { hasHeader: true, hasFooter: true, hasItems: true };

  /**
   * Жалоба: `gap` действует только между строками, а между шапкой и первой
   * строкой зазора нет. Отступ внутри шапки — не выход: он остаётся и тогда,
   * когда строк нет вовсе.
   */
  it("кладёт зазор между шапкой, строками и подвалом, как flexbox", () => {
    expect(resolveSlotGaps({ gap: 8, ...present })).toEqual({
      header: 8,
      footer: 8,
    });
  });

  it("берёт свои зазоры шапки и подвала вместо общего", () => {
    expect(
      resolveSlotGaps({ gap: 8, headerGap: 16, footerGap: 0, ...present }),
    ).toEqual({ header: 16, footer: 0 });
  });

  it("не кладёт зазор, когда строк нет", () => {
    expect(resolveSlotGaps({ gap: 8, ...present, hasItems: false })).toEqual({
      header: 0,
      footer: 0,
    });
  });

  it("не кладёт зазор у отсутствующего слота", () => {
    expect(
      resolveSlotGaps({
        gap: 8,
        ...present,
        hasHeader: false,
        hasFooter: false,
      }),
    ).toEqual({ header: 0, footer: 0 });
  });
});
