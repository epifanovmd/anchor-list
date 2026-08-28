import { useColorScheme } from "react-native";

/** Палитра стенда: ровно те цвета, что нужны примерам, и ни одного лишнего. */
export interface IPalette {
  background: string;
  surface: string;
  panel: string;
  bubble: string;
  pill: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
}

const LIGHT: IPalette = {
  background: "#FFFFFF",
  surface: "#F7F9FC",
  panel: "#F3F5F8",
  bubble: "#EEF1F5",
  pill: "#DDE3EA",
  border: "#D7DEE7",
  text: "#12181F",
  textMuted: "#65717F",
  accent: "#3B82F6",
  accentText: "#FFFFFF",
};

const DARK: IPalette = {
  background: "#12161B",
  surface: "#181D24",
  panel: "#22262C",
  bubble: "#2A2F36",
  pill: "#3A4048",
  border: "#333A43",
  text: "#EDF1F6",
  textMuted: "#94A2B3",
  accent: "#5B9DF9",
  accentText: "#0B1017",
};

/** Тема стенда; следует системной. */
export const useTheme = (): { palette: IPalette; isDark: boolean } => {
  const isDark = useColorScheme() === "dark";

  return { palette: isDark ? DARK : LIGHT, isDark };
};
