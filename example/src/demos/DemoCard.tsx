import type { FC } from "react";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Txt, useTheme } from "../ui";
import type { DemoId, IDemoEntry } from "./demo-registry";

interface IDemoCardProps {
  entry: IDemoEntry;
  onPress: (id: DemoId) => void;
}

/** Карточка стенда: название, о чём он и какие пропы показывает. */
export const DemoCard: FC<IDemoCardProps> = memo(({ entry, onPress }) => {
  const { palette } = useTheme();

  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      style={[
        ss.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Txt role={"title"}>{entry.title}</Txt>
      <Txt role={"caption"} muted style={ss.description}>
        {entry.description}
      </Txt>

      <View style={ss.tags}>
        {entry.covers.map(prop => (
          <View key={prop} style={[ss.tag, { backgroundColor: palette.pill }]}>
            <Txt role={"caption"}>{prop}</Txt>
          </View>
        ))}
      </View>
    </Pressable>
  );
});

DemoCard.displayName = "DemoCard";

const ss = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    padding: 12,
  },
  description: { marginTop: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
});
