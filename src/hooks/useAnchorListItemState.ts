import { Dispatch, SetStateAction, useRef, useState } from "react";

import { useListItemKey } from "../model";

/** Начальное значение или его ленивое вычисление — как в `useState`. */
type AnchorListItemStateInit<T> = T | (() => T);

const resolveInit = <T>(initial: AnchorListItemStateInit<T>): T =>
  typeof initial === "function" ? (initial as () => T)() : initial;

/**
 * Состояние ячейки, привязанное к элементу, а не к контейнеру.
 *
 * Зачем нужен: контейнер — единица монтирования, и при `recycleItems` он
 * переживает смену элемента. Обычный `useState` живёт вместе с контейнером,
 * поэтому раскрытый текст, начатое проигрывание или снятая отметка достаются
 * следующему элементу, занявшему то же место. Здесь состояние адресовано ключом
 * элемента: сменился ключ — значение вернулось к начальному.
 *
 * Что этот хук **не** делает: он не хранит состояние за пределами жизни ячейки.
 * Строка, ушедшая дальше `drawDistance`, размонтируется в любом списке, и с ней
 * уходит всё локальное — переработка тут ни при чём. Состояние, которое обязано
 * пережить возврат к строке, живёт во внешнем сторе по ключу элемента.
 *
 * Вызывать его можно только внутри компонента, который вернул `renderItem`:
 * прямо в теле `renderItem` хук привязался бы к контейнеру, а перед ним — и
 * вовсе к другому дереву.
 */
export const useAnchorListItemState = <T>(
  initial: AnchorListItemStateInit<T>,
): [T, Dispatch<SetStateAction<T>>] => {
  const itemKey = useListItemKey();

  if (itemKey === null) {
    throw new Error(
      "useAnchorListItemState: хук вызван вне ячейки списка. Он работает " +
        "внутри компонента, который вернул renderItem; вызов в теле самого " +
        "renderItem привязал бы состояние к контейнеру, а не к элементу.",
    );
  }

  const [state, setState] = useState<T>(initial);
  const boundKey = useRef(itemKey);
  let value = state;

  // Сброс идёт прямо в рендере, а не в эффекте. Эффект отработал бы после
  // коммита, и один кадр строка была бы нарисована состоянием предыдущего
  // элемента — этот кадр не только виден, им же ячейку измеряют, и в метрики
  // ушла бы чужая высота. React такой `setState` не коммитит, а сразу повторяет
  // рендер этого же компонента.
  //
  // Начальное значение берётся текущее: `renderItem` уже вызван с новым
  // элементом, и `useAnchorListItemState(() => item.expanded)` обязан вернуть
  // ответ про него, а не про того, кто занимал контейнер до него.
  if (boundKey.current !== itemKey) {
    boundKey.current = itemKey;
    value = resolveInit(initial);
    setState(() => value);
  }

  return [value, setState];
};
