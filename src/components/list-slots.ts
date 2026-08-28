import type { ComponentType, ReactElement, ReactNode } from "react";
import { createElement, isValidElement } from "react";

/** Header/Footer/Empty принимаются и элементом, и типом компонента. */
export type ListSlot = ComponentType<unknown> | ReactElement | null | undefined;

/**
 * Отрисовка необязательного слота списка.
 *
 * Зачем нужна: шапка, подвал и заглушка пустого списка исторически задаются
 * двумя способами — готовым элементом (`<Header />`) и типом компонента
 * (`Header`). Оба варианта в ходу, и оба обязаны работать.
 *
 * Какую проблему решает: одно место вместо трёх одинаковых проверок в теле
 * списка. Тип компонента здесь именно создаётся элементом, а не вызывается как
 * функция, — иначе хуки внутри такого слота оказались бы хуками самого списка.
 */
export const renderListSlot = (slot: ListSlot): ReactNode => {
  if (!slot) return null;
  if (isValidElement(slot)) return slot;

  return createElement(slot as ComponentType<unknown>);
};
