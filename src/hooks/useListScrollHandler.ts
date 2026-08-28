import type { SharedValue } from "react-native-reanimated";
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Шаг, с которым пересчёт диапазона уходит в JS, по умолчанию, px.
 *
 * Величина подобрана под то, ради чего шаг и нужен: буфер отрисовки на порядок
 * больше, и точность в один пиксель привязке контейнеров не нужна. Меньше —
 * больше проходов на том же движении, больше — позже узнают о нём те, кто
 * читает состояние через React.
 */
export const DEFAULT_SCROLL_THROTTLE_DISTANCE = 24;

/**
 * Полоса у кромки контента, в которой шаг не применяется, px.
 *
 * Зачем нужна: «упёрлись в кромку» считается с точностью до пикселя, а шаг в
 * шаг такой точности не даёт — последнее событие перед
 * остановкой у самого верха отличается от предыдущего меньше чем на шаг и в JS
 * не уходит. Флаги `isAtStart`/`isAtEnd` тогда загораются не под пальцем, а
 * только после его отпускания, когда точное смещение досылается отдельно.
 *
 * Внутри полосы событие уходит на каждое изменение смещения, снаружи — по шагу.
 */
const EDGE_REPORT_PX = 2;

/** Что обработчик скролла пишет на UI-потоке и что уводит в JS. */
export interface IAnchorListScrollHandlerOptions {
  /** Смещение скролла на UI-потоке — из него считается прилипание. */
  scrollOffset: SharedValue<number>;
  /**
   * Смещение, запрошенное наружу через `sharedValues.scrollOffset`.
   *
   * Пишется здесь же, а не зеркалится из стора: смещение меняется на каждом
   * кадре и в JS не заходит вовсе. Значение вызывающего держится отдельно от
   * внутреннего намеренно — на внутреннем висит прилипание, и чужая запись в
   * него сдвинула бы якоря.
   */
  publishedScrollOffset?: SharedValue<number>;
  /** Палец на экране; пишется на UI-потоке, без захода в JS. */
  isDragging?: SharedValue<boolean>;
  /** Идёт инерция после броска; пишется там же. */
  isMomentum?: SharedValue<boolean>;
  /**
   * Пересчёт диапазона отрисовки; вызывается шагами, а не на каждый пиксель.
   *
   * Время снимается здесь же, на UI-потоке, и уходит вместе со смещением.
   * Считать его в JS нельзя: смещение относится к моменту события, а до
   * обработки может пройти сколько угодно — на броске JS занят как раз сильнее
   * всего. Скорость, посчитанная по этим двум часам, тем сильнее занижена, чем
   * больше список загружен.
   */
  onScroll: (offset: number, time: number) => void;
  /**
   * Шаг перехода в JS, px; по умолчанию {@link DEFAULT_SCROLL_THROTTLE_DISTANCE}.
   *
   * У кромок не применяется — там точность важнее экономии, см.
   * {@link EDGE_REPORT_PX}.
   */
  scrollThrottleDistance?: number;
  onBeginDrag: () => void;
  onEndDrag: () => void;
  onMomentumEnd: () => void;
}

/**
 * Обработка скролла одним worklet-обработчиком.
 *
 * Зачем нужен: смещение обязано попадать в shared value синхронно с нативным
 * скроллом — от него зависит прилипание, и отставание хотя бы на кадр видно как
 * дрожание заголовка.
 *
 * Какую проблему решает: переход в JS на каждом кадре скролла. Туда уходит
 * только пересчёт диапазона отрисовки, и то шагами по `scrollThrottleDistance`:
 * он определяет, какие ячейки смонтированы, и точность в один пиксель ему не
 * нужна — буфер отрисовки на порядок больше этого шага.
 *
 * Фаза жеста пишется прямо здесь, без захода в JS: она нужна тем, кто реагирует
 * на прикосновение в тот же кадр — спрятать кнопку под пальцем, закрыть
 * клавиатуру, притормозить тяжёлый эффект на время инерции.
 */
export const useListScrollHandler = ({
  scrollOffset,
  publishedScrollOffset,
  isDragging,
  isMomentum,
  onScroll,
  scrollThrottleDistance = DEFAULT_SCROLL_THROTTLE_DISTANCE,
  onBeginDrag,
  onEndDrag,
  onMomentumEnd,
}: IAnchorListScrollHandlerOptions) => {
  /** Смещение, при котором в JS уходил последний пересчёт диапазона. */
  const lastReportedScroll = useSharedValue(0);

  return useAnimatedScrollHandler({
    onScroll: event => {
      const offset = event.contentOffset.y;

      // До проверки шага: наружу смещение обязано идти каждым кадром, а шаг
      // ограничивает только пересчёт диапазона.
      scrollOffset.value = offset;
      if (publishedScrollOffset) publishedScrollOffset.value = offset;

      if (offset === lastReportedScroll.value) return;

      // Границы берутся из самого события: размеры контента и вьюпорта
      // приходят вместе со смещением, и спрашивать их у JS не нужно.
      const maxScroll =
        event.contentSize.height - event.layoutMeasurement.height;
      const atEdge =
        offset <= EDGE_REPORT_PX || offset >= maxScroll - EDGE_REPORT_PX;

      if (
        !atEdge &&
        Math.abs(offset - lastReportedScroll.value) < scrollThrottleDistance
      )
        return;

      lastReportedScroll.value = offset;
      scheduleOnRN(onScroll, offset, Date.now());
    },
    onBeginDrag: () => {
      if (isDragging) isDragging.value = true;

      scheduleOnRN(onBeginDrag);
    },
    onEndDrag: event => {
      if (isDragging) isDragging.value = false;

      const offset = event.contentOffset.y;

      if (offset !== lastReportedScroll.value) {
        lastReportedScroll.value = offset;
        scheduleOnRN(onScroll, offset, Date.now());
      }

      scheduleOnRN(onEndDrag);
    },
    // Инерция начинается только после отпускания пальца, и только если бросок
    // был: короткое перетаскивание завершается на `onEndDrag` без неё.
    onMomentumBegin: () => {
      if (isMomentum) isMomentum.value = true;
    },
    onMomentumEnd: event => {
      if (isMomentum) isMomentum.value = false;

      const offset = event.contentOffset.y;

      if (offset !== lastReportedScroll.value) {
        lastReportedScroll.value = offset;
        scheduleOnRN(onScroll, offset, Date.now());
      }

      scheduleOnRN(onMomentumEnd);
    },
  });
};
