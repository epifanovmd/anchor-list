import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useListSignal } from "../hooks";

/**
 * Смещение, на которое отодвинута распорка.
 *
 * Нативное удержание позиции выбирает первого ребёнка контента, чей нижний край
 * ниже текущего смещения скролла. Распорка обязана попадать под это условие при
 * любом смещении, поэтому её позиция вынесена далеко за пределы контента.
 *
 * Значение подобрано под точность float32, в котором Yoga хранит раскладку: до
 * 2^24 целые числа представимы точно, поэтому смещение сохраняется без потерь,
 * пока компенсация остаётся целой и не переваливает за миллионы точек.
 */
const ADJUST_BIAS = 10000000;

/**
 * Якорь компенсации позиции.
 *
 * Первый ребёнок контента и нулевой размер: нативное удержание позиции
 * (`minIndexForVisible: 0`) запоминает его кадр перед mount-транзакцией и после
 * неё добавляет смещение этого кадра к `contentOffset`. Скролл и раскладка
 * меняются в одной транзакции, поэтому промежуточного кадра не возникает — в
 * отличие от программного скролла, который приходит отдельно и вдобавок
 * обрывает жест и инерцию.
 */
export const ListScrollAdjust = memo(() => {
  const adjust = useListSignal("scrollAdjust") ?? 0;
  // Дробная часть до нативного слоя не доходит: iOS отбрасывает смещение кадра
  // меньше половины точки, Android считает кадр в целых пикселях.
  const style = useMemo(
    () => [styles.anchor, { top: Math.round(adjust) + ADJUST_BIAS }],
    [adjust],
  );

  return <View style={style} pointerEvents={"none"} />;
});

ListScrollAdjust.displayName = "ListScrollAdjust";

const styles = StyleSheet.create({
  anchor: {
    height: 0,
    left: 0,
    position: "absolute",
    width: 0,
  },
});
