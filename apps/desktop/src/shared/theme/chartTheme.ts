import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

// Canvas charts cannot resolve CSS custom properties, so the visual baseline
// tokens are read once per theme and passed to the renderer as concrete colors.
export type ChartTheme = {
  heat: [string, string, string, string, string];
};

function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(`--${name}`).trim();
  return {
    heat: [token("heat-0"), token("heat-1"), token("heat-2"), token("heat-3"), token("heat-4")],
  };
}

export function useChartTheme(): ChartTheme {
  const { theme } = useAppStore();
  return useMemo(readChartTheme, [theme]);
}
