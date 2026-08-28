import type { FC } from "react";
import { memo } from "react";
import { StyleSheet } from "react-native";

import { Txt } from "./Txt";

interface IStatusLineProps {
  text: string;
}

/** Строка состояния: значения, за которыми в стенде и наблюдают. */
export const StatusLine: FC<IStatusLineProps> = memo(({ text }) => (
  <Txt role={"caption"} muted style={ss.status}>
    {text}
  </Txt>
));

StatusLine.displayName = "StatusLine";

const ss = StyleSheet.create({
  status: { marginTop: 4 },
});
