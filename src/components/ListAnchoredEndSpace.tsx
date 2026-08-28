import React, { memo, useMemo } from "react";
import { View } from "react-native";

import { useListSignal } from "../hooks";

/**
 * Распорка у конца списка.
 *
 * Резервирует место, чтобы якорный элемент мог подняться к верхней кромке
 * вьюпорта, когда контента под ним не хватает.
 */
export const ListAnchoredEndSpace = memo(() => {
  const size = useListSignal("anchoredEndSpaceSize") ?? 0;
  const style = useMemo(() => ({ height: size }), [size]);

  if (size <= 0) return null;

  return <View style={style} pointerEvents="none" />;
});

ListAnchoredEndSpace.displayName = "ListAnchoredEndSpace";
