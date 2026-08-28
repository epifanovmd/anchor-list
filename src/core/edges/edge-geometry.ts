/** Кромка списка. */
export type ListEdge = "start" | "end";

/** Условия одной проверки порогов. */
export interface IEdgeCheckContext {
  scroll: number;
  scrollLength: number;
  contentSize: number;
  dataLength: number;
  /** Отступ у конца контента, не считающийся расстоянием до кромки. */
  contentInsetEnd: number;
  /** Идёт начальный или программный скролл — пороги не трогаем. */
  skipCallbacks: boolean;
}

/** Расстояния до обеих кромок на текущей позиции. */
export interface IEdgeGeometry {
  /** Расстояние до начала контента. */
  distanceFromStart: number;
  /** Расстояние до конца контента, без учёта отступа конца. */
  distanceFromEnd: number;
  /** Контент короче вьюпорта: конец достигнут при любом смещении. */
  isContentShorter: boolean;
}

/** Выход за порог засчитывается с запасом — иначе колбэк дребезжит у границы. */
const HYSTERESIS = 1.3;

/**
 * Геометрия кромок.
 *
 * Зачем нужна: и проверка порогов, и разблокировка общего гейта считают одни и
 * те же расстояния. Разъехавшись, эти два расчёта дали бы состояние, в котором
 * кромка одновременно и достигнута, и «далеко за порогом».
 *
 * Отступ конца (`contentInsetEnd`) — распорка, а не контент: расстоянием до
 * кромки он не считается, иначе подгрузка срабатывала бы на пустом месте.
 */
export const getEdgeGeometry = ({
  scroll,
  scrollLength,
  contentSize,
  contentInsetEnd,
}: IEdgeCheckContext): IEdgeGeometry => ({
  distanceFromStart: scroll,
  distanceFromEnd: contentSize - scroll - scrollLength - contentInsetEnd,
  isContentShorter: contentSize < scrollLength,
});

/**
 * Ушли ли за порог настолько, чтобы кромка считалась покинутой.
 *
 * Запас в {@link HYSTERESIS} обязателен: без него достаточно дрогнуть на
 * границе порога, чтобы защёлка снялась и подгрузка ушла повторно. Кромка,
 * достигнутая точно (`atEdge`), не покидается никогда — стоять у самого конца
 * короткого контента и «выйти за порог» нельзя.
 */
export const isOutsideThreshold = (
  distance: number,
  atEdge: boolean,
  threshold: number,
): boolean => {
  if (atEdge) return false;

  const absolute = Math.abs(distance);

  return threshold > 0 ? absolute >= threshold * HYSTERESIS : absolute > 0;
};
