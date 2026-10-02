export const themeIds = ["default-dark", "default-light"] as const;
export type ThemeId = (typeof themeIds)[number];

export const themeOptions = [
  { id: "default-dark" },
  { id: "default-light" },
] satisfies { id: ThemeId }[];

export function isThemeId(value: string | null): value is ThemeId {
  return value !== null && themeIds.some((id) => id === value);
}

import { getCurrentWindow } from "@tauri-apps/api/window";

export function applyTheme(themeId: ThemeId) {
  document.documentElement.dataset.theme = themeId;
  // Acrylic tints itself from the window's own light/dark mode; keep it on the app's theme.
  if (document.documentElement.dataset.material === "acrylic") {
    void getCurrentWindow().setTheme(themeId === "default-light" ? "light" : "dark");
  }
}
