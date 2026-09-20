/**
 * Геометрия строки и вьюпорта для расчёта видимости.
 *
 * Те же два пространства координат, что и у прилипания: позиция строки — из
 * раскладки, от нуля на первом элементе; смещение скролла — нативное, от
 * начала контента, где над элементами лежит шапка. Мостом служит
 * {@link IItemVisibilityParams.contentOrigin}.
 */
export interface IItemVisibilityParams {
  /** Позиция строки в координатах элементов. */
  position: number;
  size: number;
  /** Смещение скролла в координатах контента — нативный `contentOffset`. */
  scroll: number;
  /** Начало координат элементов внутри контента: шапка списка. */
  contentOrigin: number;
  /** Размер вьюпорта вдоль оси скролла. */
  scrollLength: number;
  /**
   * Сколько конца вьюпорта занято не списком: панель ввода, клавиатура.
   *
   * Строка под панелью не видна, хотя и лежит внутри вьюпорта `ScrollView`.
   */
  insetEnd: number;
  /**
   * Сдвиг строки трансформом относительно её позиции в раскладке.
   *
   * Прилипший якорь стоит не там, где лежит; прижатый к концу короткий контент
   * сдвинут целиком. Оба сдвига — трансформы, раскладка о них не знает.
   */
  shift: number;
}

/**
 * Доля строки, попавшей во вьюпорт: от 0 до 1.
 *
 * Worklet: считается на UI-потоке в такт скроллу, без рендера.
 *
 * Считается доля самой строки, а не вьюпорта: «насколько видна эта строка» —
 * вопрос о ней. Строка длиннее экрана не бывает видна целиком — это норма, и
 * порог для неё выбирается ниже.
 */
export const getItemVisibility = ({
  position,
  size,
  scroll,
  contentOrigin,
  scrollLength,
  insetEnd,
  shift,
}: IItemVisibilityParams): number => {
  "worklet";

  if (size <= 0) return 0;

  const start = contentOrigin + position + shift;
  const end = start + size;
  const viewportStart = scroll;
  const viewportEnd = scroll + scrollLength - insetEnd;
  const visible = Math.min(end, viewportEnd) - Math.max(start, viewportStart);

  if (visible <= 0) return 0;

  return Math.min(1, visible / size);
};
