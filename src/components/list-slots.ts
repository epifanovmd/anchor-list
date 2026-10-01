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

/** Что известно о слотах, когда решается, где лежат зазоры. */
export interface ISlotGapsParams {
  /** Зазор между строками. */
  gap?: number;
  /** Свой зазор после шапки; по умолчанию — `gap`. */
  headerGap?: number;
  /** Свой зазор перед подвалом; по умолчанию — `gap`. */
  footerGap?: number;
  /** Шапка отрисована. */
  hasHeader: boolean;
  /** Подвал отрисован. */
  hasFooter: boolean;
  /** Есть строки: без них зазору не между чем лежать. */
  hasItems: boolean;
}

/**
 * Зазоры между шапкой, строками и подвалом.
 *
 * Как `gap` во flexbox: между соседями, которые есть. Шапка и подвал — такие
 * же соседи строк, как строки друг другу, поэтому по умолчанию зазор тот же.
 * Пустой список зазора не получает: отступ внутри шапки, которым его
 * заменяли раньше, оставался и над заглушкой.
 */
export const resolveSlotGaps = ({
  gap = 0,
  headerGap,
  footerGap,
  hasHeader,
  hasFooter,
  hasItems,
}: ISlotGapsParams): { header: number; footer: number } => ({
  header: hasItems && hasHeader ? (headerGap ?? gap) : 0,
  footer: hasItems && hasFooter ? (footerGap ?? gap) : 0,
});
