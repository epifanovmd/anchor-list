/**
 * Доступ к нативному скроллу.
 *
 * Зачем нужен: расчётное ядро живёт вне React и ссылки на `ScrollView` не
 * имеет. Адаптер — единственная его связь с нативным слоем, и подменить его на
 * заглушку в тестах стоит одной строки.
 */
export interface IScrollAdapter {
  scrollToEnd: (animated: boolean) => void;
  scrollToOffset: (offset: number, animated: boolean) => void;
  /** Фактическое смещение нативного скролла — нужно сверке компенсации. */
  getOffset?: () => number;
}

/** Отложенное получение адаптера: список монтируется позже создания ядра. */
export type ScrollAdapterRef = () => IScrollAdapter | undefined;
