import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

// Canvas charts cannot resolve CSS custom properties, so the visual baseline
// tokens are read once per theme and passed to ECharts as concrete colors.
export type ChartTheme = {
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  grid: string;
  hover: string;
  series: [string, string, string, string];
  heat: [string, string, string, string, string];
  fontUi: string;
  fontMono: string;
};

function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(`--${name}`).trim();
  return {
    text: token("text"),
    textMuted: token("text-muted"),
    textFaint: token("text-faint"),
    border: token("border"),
    grid: token("chart-grid"),
    hover: token("hover"),
    series: [token("chart-1"), token("chart-2"), token("chart-3"), token("chart-4")],
    heat: [token("heat-0"), token("heat-1"), token("heat-2"), token("heat-3"), token("heat-4")],
    fontUi: token("font-ui"),
    fontMono: token("font-mono"),
  };
}

export function useChartTheme(): ChartTheme {
  const { theme } = useAppStore();
  return useMemo(readChartTheme, [theme]);
}
