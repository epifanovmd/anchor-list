import type { FC } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Screen, Txt } from "../ui";
import type { DemoId } from "./demo-registry";
import { DEMOS } from "./demo-registry";
import { DemoCard } from "./DemoCard";

interface IDemoGalleryProps {
  onOpen: (id: DemoId) => void;
}

/** Витрина стендов: каждый показывает свою часть внешнего API списка. */
export const DemoGallery: FC<IDemoGalleryProps> = ({ onOpen }) => (
  <Screen title={"AnchorList · стенды"}>
    <ScrollView contentContainerStyle={ss.content}>
      <Txt role={"caption"} muted style={ss.intro}>
        {"Каждый стенд проверяет одну механику списка и подписан пропами, " +
          "которые в нём задействованы."}
      </Txt>

      {DEMOS.map(entry => (
        <DemoCard key={entry.id} entry={entry} onPress={onOpen} />
      ))}
    </ScrollView>
  </Screen>
);

DemoGallery.displayName = "DemoGallery";

const ss = StyleSheet.create({
  content: { padding: 12, paddingBottom: 32 },
  intro: { marginBottom: 4 },
});
