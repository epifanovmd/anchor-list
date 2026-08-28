import type { AnchorListStickyEdge } from "../../types";

/**
 * Геометрия якоря и вьюпорта для расчёта смещения прилипания.
 *
 * Здесь встречаются два пространства координат, и путать их нельзя. Позиции и
 * пределы приходят из раскладки — она начинается с нуля на первом элементе.
 * Смещение скролла приходит от нативного `ScrollView` — оно отсчитывается от
 * начала контента, где над элементами лежит шапка. Мостом служит
 * {@link IStickyOffsetParams.contentOrigin}.
 */
export interface IStickyOffsetParams {
  edge: AnchorListStickyEdge;
  /** Позиция элемента в координатах элементов. */
  position: number;
  size: number;
  /** Размер вьюпорта вдоль оси скролла. */
  scrollLength: number;
  /** Смещение скролла в координатах контента — нативный `contentOffset`. */
  scroll: number;
  /**
   * Начало координат элементов внутри контента: шапка списка.
   *
   * Без поправки якорь вставал бы ниже кромки ровно на её высоту, а соседние
   * якоря выталкивали бы друг друга не там, где сходятся их края.
   */
  contentOrigin: number;
  /** Отступ кромки: навбар сверху, панель ввода снизу. */
  edgeOffset: number;
  /**
   * Предел смещения: у начальной кромки — куда элемент выталкивает следующий
   * якорь, у конечной — верх собственной группы.
   */
  limit: number | undefined;
  /**
   * Высота того, что реально прилипает: у строки целиком — её высота, у
   * аватара — высота аватара. Определяет, докуда объект поднимается у конечной
   * кромки.
   */
  stickySize: number;
}

/**
 * Смещение прилипающего элемента относительно его обычной позиции.
 *
 * Worklet: считается на UI-потоке в такт скроллу.
 *
 * У начальной кромки элемент сдвигается вниз ровно настолько, насколько кромка
 * его обогнала, и упирается в следующий якорь — тот выталкивает его за кромку.
 * У конечной зеркально: поднимается, когда низ уходит ниже кромки, и не может
 * подняться выше своей группы.
 */
export const getStickyOffset = ({
  edge,
  position,
  size,
  scrollLength,
  scroll,
  contentOrigin,
  edgeOffset,
  limit,
  stickySize,
}: IStickyOffsetParams): number => {
  "worklet";

  // Дальше всё в координатах элементов — тех же, в которых лежат позиция и
  // предел.
  const viewportTop = scroll - contentOrigin;

  if (edge === "start") {
    const shifted =
      position + Math.max(0, viewportTop - (position - edgeOffset));
    const resolved = limit === undefined ? shifted : Math.min(shifted, limit);

    return resolved - position;
  }

  const viewportBottom = viewportTop + scrollLength - edgeOffset;
  const bottom = position + size;

  // Низ группы виден — объект стоит на своём месте.
  if (viewportBottom >= bottom) return 0;

  // Кромка внутри группы: прижимаем к ней, но не выше начала группы.
  //
  // Зажим заодно закрывает случай «группа ещё не доехала»: пока её начало ниже
  // кромки, объект стоит у этого начала и вместе с ним ждёт за нижним краем
  // экрана. Отдельной ветки с досрочным нулём здесь быть не должно — она
  // разрывала бы движение ровно в тот момент, когда группа подъезжает снизу:
  // объект скачком переходил бы от начала группы к её низу и обратно, то
  // пропадая раньше нижней кромки, то появляясь не из-за края экрана, а в той
  // же точке, где исчез.
  const resolvedBottom =
    limit === undefined
      ? viewportBottom
      : Math.max(viewportBottom, limit + stickySize);

  return resolvedBottom - bottom;
};

/**
 * Стоит ли якорь у кромки, не выталкиваемый следующим.
 *
 * Worklet: считается на UI-потоке рядом со смещением.
 *
 * Зачем нужен: у прилипания три состояния, и покадровое движение есть только в
 * одном из них. Пока якорь не доехал до кромки, он стоит на своём месте в
 * контенте; когда его выталкивает следующий, он упирается в предел и снова
 * стоит на месте в контенте — оба раза его везёт нативный скролл, и трансформ
 * при этом постоянен. И только между ними якорь обязан компенсировать скролл
 * покадрово.
 *
 * Какую проблему решает: именно это состояние отдаётся отдельному слою поверх
 * списка, где элемент вообще не двигается. Покадровая компенсация исчезает, а
 * вместе с ней — рывки от пропущенных кадров скролла и от чужих коммитов.
 */
export const isPinnedAtEdge = ({
  edge,
  position,
  size,
  scrollLength,
  scroll,
  contentOrigin,
  edgeOffset,
  limit,
  stickySize,
}: IStickyOffsetParams): boolean => {
  "worklet";

  const viewportTop = scroll - contentOrigin;

  if (edge === "start") {
    const edgePosition = viewportTop + edgeOffset;

    if (edgePosition <= position) return false;

    return limit === undefined || edgePosition <= limit;
  }

  const viewportBottom = viewportTop + scrollLength - edgeOffset;

  if (viewportBottom >= position + size) return false;

  return limit === undefined || viewportBottom > limit + stickySize;
};
