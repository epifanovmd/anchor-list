import React, { memo, ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useListSticky } from "../model";
import type { IAnchorListRenderItemProps } from "../types";
import { ListStickyPin } from "./ListStickyPin";
import { resolveOverlayRenderer } from "./sticky-placement";

/** Пропы слоя прилипших копий: чем и с какими данными рисовать якорь. */
export interface IAnchorListStickyOverlayProps {
  renderItem: (props: IAnchorListRenderItemProps<unknown>) => ReactNode;
  extraData: unknown;
}

/**
 * Слой прилипших якорей поверх списка.
 *
 * Зачем нужен: якорь у кромки обязан стоять на месте экрана, а всё внутри
 * `ScrollView` едет вместе с контентом — держаться на месте там можно только
 * покадровой компенсацией скролла. Любой пропущенный кадр доставки события
 * такую компенсацию рвёт, и это видно как дрожание.
 *
 * Какую проблему решает: пока якорь стоит у кромки, его рисует этот слой —
 * снаружи `ScrollView`, на постоянной позиции и вовсе без покадрового
 * трансформа. Двигаться начинает только копия внутри контента: и когда якорь
 * ещё не доехал до кромки, и когда его выталкивает следующий, её смещение
 * постоянно, а везёт её нативный скролл.
 */
export const ListStickyOverlay = memo<IAnchorListStickyOverlayProps>(
  ({ renderItem, extraData }) => {
    const configs = useListSticky();
    const pinned = useMemo(
      () =>
        configs.filter(
          config => resolveOverlayRenderer(config, renderItem) !== undefined,
        ),
      [configs, renderItem],
    );

    if (pinned.length === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={"none"}>
        {pinned.map(config => (
          <ListStickyPin
            key={config.edge}
            config={config}
            renderItem={renderItem}
            extraData={extraData}
          />
        ))}
      </View>
    );
  },
);

ListStickyOverlay.displayName = "ListStickyOverlay";
