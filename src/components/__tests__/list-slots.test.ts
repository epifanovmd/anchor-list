import { createElement, isValidElement } from "react";

import {
  getContentContainerStyle,
  getEmptySlotStyle,
  renderListSlot,
  resolveSlotGaps,
} from "../list-slots";

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

describe("пустое состояние", () => {
  /**
   * Жалоба: заглушку пустого списка нельзя поставить по центру — ей не на что
   * растянуться: контент высотой с неё саму.
   */
  it("растягивает контент на вьюпорт, пока показана заглушка", () => {
    const user = { paddingTop: 24 };

    expect(getContentContainerStyle(user, true)).toEqual([
      { flexGrow: 1 },
      user,
    ]);
  });

  it("не трогает контент со строками", () => {
    const user = { paddingTop: 24 };

    // Растянутый контент сломал бы короткий список: он перестал бы быть
    // короче вьюпорта.
    expect(getContentContainerStyle(user, false)).toBe(user);
  });

  it("растягивает саму заглушку вдоль оси", () => {
    expect(getEmptySlotStyle(false)).toMatchObject({
      flexDirection: "column",
      flexGrow: 1,
    });
    expect(getEmptySlotStyle(true)).toMatchObject({
      flexDirection: "row",
      flexGrow: 1,
    });
  });
});
