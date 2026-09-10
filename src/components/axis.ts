import type { ViewStyle } from "react-native";

import type { AnchorListStickyEdge } from "../types";

/**
 * Ось списка в раскладке и стилях.
 *
 * Зачем нужен: расчётное ядро оси не знает вовсе — оно считает смещения и
 * размеры вдоль одной оси, безразлично какой. Про вертикаль и горизонталь знает
 * только слой отрисовки, и знает ровно в этих шести функциях: где у слота
 * позиция, чем он растянут поперёк, какой размер брать из замера и в какую
 * сторону сдвигать прилипший якорь.
 *
 * Какую проблему решает: разнесённые по десятку компонентов тернарники. Ось
 * задаётся один раз на список, но участвует в каждом слоте и каждом
 * трансформе, и разойдясь на одном из них, список рисует строки поверх друг
 * друга — при этом ошибку видно только на устройстве.
 *
 * **Направление.** Положительное смещение — от начала контента к концу: вниз в
 * вертикальном списке, вправо в горизонтальном. RTL не поддерживается: под ним
 * нативный слой считает смещение от правой кромки, а нативное удержание
 * позиции на Android этого не учитывает вовсе (см. `docs/limitations.md`).
 */

/**
 * Размер вдоль оси скролла.
 *
 * Аргументы скалярами, а не объектом: сюда приходят и `measure`, отдающий
 * ширину с высотой отдельными числами, и события раскладки — на быстром
 * скролле замеров сотни в секунду, и лишний объект на каждый ни к чему.
 */
export const getAxisSize = (
  width: number,
  height: number,
  horizontal: boolean,
): number => (horizontal ? width : height);

/** Геометрия слота одной строки. */
export interface IAxisSlot {
  /** Позиция строки вдоль оси скролла, в координатах элементов. */
  position: number;
  /**
   * Размер, по которому слот подрезает содержимое; `undefined` — не подрезает.
   *
   * Нужен прилипанию в режиме `offset`: содержимое внутри строки едет, а слот
   * обязан остаться той же длины, иначе оно вылезает на соседние строки.
   */
  clipSize?: number | undefined;
  horizontal: boolean;
}

/**
 * Слот строки в контенте.
 *
 * Позицию несёт ось скролла, поперёк слот растянут по обеим кромкам: строка
 * получает ширину вьюпорта в вертикальном списке и его высоту — в
 * горизонтальном, а размер вдоль оси остаётся за содержимым. Именно поэтому
 * поперечная кромка задаётся обеими сторонами, а не размером: размера вьюпорта
 * слот не знает, и знать ему его незачем.
 *
 * **Ось скролла — главная ось раскладки слота.** Иначе поперечный размер до
 * содержимого не доходит: flexbox растягивает детей по поперечной оси и не
 * трогает главную. Разложи горизонтальный слот колонкой — и строка растянется
 * по его ширине, которая сама зависит от строки, а высоту возьмёт свою: на
 * экране карточка не достаёт до краёв ленты, хотя слот на всю её высоту.
 */
export const getAxisSlotStyle = ({
  position,
  clipSize,
  horizontal,
}: IAxisSlot): ViewStyle => {
  const style: ViewStyle = horizontal
    ? {
        bottom: 0,
        flexDirection: "row",
        left: position,
        position: "absolute",
        top: 0,
      }
    : {
        flexDirection: "column",
        left: 0,
        position: "absolute",
        right: 0,
        top: position,
      };

  if (clipSize === undefined) return style;

  style.overflow = "hidden";

  if (horizontal) style.width = clipSize;
  else style.height = clipSize;

  return style;
};

/**
 * Раскладка содержимого ячейки: та же ось, что и у слота.
 *
 * Зачем отдельно от {@link getAxisSlotStyle}: между слотом и тем, что вернул
 * `renderItem`, стоит ещё один узел — тот, который список меряет. Оставь его
 * раскладку по умолчанию, и поперечный размер остановится на нём: сам он от
 * слота растянется, а содержимое внутри — уже нет.
 *
 * Заодно этим задаётся место разделителя: он рисуется следом за строкой и
 * встаёт по ходу оси — под строкой в вертикальном списке, справа от неё в
 * горизонтальном.
 *
 * Ссылка постоянная: ось за жизнь списка не меняется, а ячейки
 * перерисовываются на каждом шаге скролла.
 */
export const getAxisContentStyle = (horizontal: boolean): ViewStyle =>
  horizontal ? CONTENT_ROW : CONTENT_COLUMN;

const CONTENT_ROW: ViewStyle = { flexDirection: "row" };
const CONTENT_COLUMN: ViewStyle = { flexDirection: "column" };

/**
 * Длина вдоль оси скролла: высота контента, распорка, подрезанный слот.
 *
 * Worklet: тем же стилем задаётся распорка нижнего отступа, а она меняется
 * каждый кадр клавиатуры и считается на UI-потоке.
 */
export const getAxisLengthStyle = (
  size: number,
  horizontal: boolean,
): ViewStyle => {
  "worklet";

  return horizontal ? { width: size } : { height: size };
};

/**
 * Сдвиг вдоль оси скролла.
 *
 * Worklet: сюда приходят смещение прилипшего якоря и выравнивание короткого
 * контента — оба считаются на UI-потоке покадрово.
 */
export const getAxisTranslate = (
  offset: number,
  horizontal: boolean,
): NonNullable<ViewStyle["transform"]> => {
  "worklet";

  return horizontal ? [{ translateX: offset }] : [{ translateY: offset }];
};

/**
 * Место прилипшей копии во вьюпорте.
 *
 * Слой живёт снаружи `ScrollView`, в координатах экрана, поэтому копия
 * прижимается к своей кромке оси и растягивается поперёк — ровно так же, как
 * слот строки внутри контента.
 */
export const getAxisPinStyle = (
  edge: AnchorListStickyEdge,
  horizontal: boolean,
): ViewStyle => {
  if (horizontal) {
    return edge === "start"
      ? { bottom: 0, left: 0, position: "absolute", top: 0 }
      : { bottom: 0, position: "absolute", right: 0, top: 0 };
  }

  return edge === "start"
    ? { left: 0, position: "absolute", right: 0, top: 0 }
    : { bottom: 0, left: 0, position: "absolute", right: 0 };
};

/**
 * Смещение якоря компенсации: он вынесен далеко за пределы контента.
 *
 * Отдельно от {@link getAxisSlotStyle}: якорь нулевого размера и поперёк не
 * растягивается — растянутый, он попал бы под замер контента.
 */
export const getAxisAnchorStyle = (
  position: number,
  horizontal: boolean,
): ViewStyle =>
  horizontal ? { left: position, top: 0 } : { left: 0, top: position };
