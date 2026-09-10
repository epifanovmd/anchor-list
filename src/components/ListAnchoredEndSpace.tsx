import React, { memo, useMemo } from "react";
import { View } from "react-native";

import { useListSignal } from "../hooks";
import { useListHorizontal } from "../model";
import { getAxisLengthStyle } from "./axis";

/**
 * Распорка у конца списка.
 *
 * Резервирует место, чтобы якорный элемент мог дойти до начальной кромки
 * вьюпорта, когда контента за ним не хватает.
 */
export const ListAnchoredEndSpace = memo(() => {
  const size = useListSignal("anchoredEndSpaceSize") ?? 0;
  const horizontal = useListHorizontal();
  const style = useMemo(
    () => getAxisLengthStyle(size, horizontal),
    [size, horizontal],
  );

  if (size <= 0) return null;

  return <View style={style} pointerEvents="none" />;
});

ListAnchoredEndSpace.displayName = "ListAnchoredEndSpace";
