/**
 * Имена сигналов одного контейнера.
 *
 * Зачем нужны: у каждого контейнера свой набор сигналов, адресованный его
 * номером. Именно поэтому смещение одной строки при скролле не перерисовывает
 * остальные — подписка идёт на конкретное имя, а не на общее состояние списка.
 *
 * `scrollLength` в наборе не по ошибке: прилипание к конечной кромке считается
 * от неё, и контейнеру она нужна наравне с собственной позицией.
 */
export const getContainerSignalNames = (id: number) =>
  [
    `containerPosition${id}`,
    `containerItemKey${id}`,
    `containerItemIndex${id}`,
    `containerItemData${id}`,
    `containerItemType${id}`,
    `containerItemSize${id}`,
    `containerSticky${id}`,
    `containerStickyLimit${id}`,
    `containerClipped${id}`,
    "scrollLength",
  ] as const;
