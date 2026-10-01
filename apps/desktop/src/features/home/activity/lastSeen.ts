// What the overview showed the last time it was looked at, so the next view can roll from it.
const KEY = "kaeru.overview.lastSeen";

export type LastSeen = { total: number; day: string };

export function readLastSeen(): LastSeen | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return typeof value?.total === "number" && typeof value?.day === "string" ? value : null;
  } catch {
    return null;
  }
}

export function writeLastSeen(value: LastSeen) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
