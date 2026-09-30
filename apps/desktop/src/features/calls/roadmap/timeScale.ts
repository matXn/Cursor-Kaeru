const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720].map((minutes) => minutes * MINUTE_MS);
const MAX_TICKS = 10;

export type TimeScale = {
  startMs: number;
  endMs: number;
  ticks: number[];
  // Position as a fraction of the lane width, clamped to [0, 1].
  at: (ms: number) => number;
};

// Fits the shared axis to the visible calls with a little breathing room on both sides,
// and picks the smallest round tick step that keeps the axis readable.
export function timeScale(spans: Array<{ startMs: number; endMs: number }>): TimeScale | null {
  if (spans.length === 0) return null;
  const first = Math.min(...spans.map((span) => span.startMs));
  const last = Math.max(...spans.map((span) => span.endMs));
  const padding = Math.max(MINUTE_MS, (last - first) * 0.03);
  const step = TICK_STEPS.find((candidate) => (last - first + padding * 2) / candidate <= MAX_TICKS) ?? 12 * HOUR_MS;
  const startMs = Math.floor((first - padding) / step) * step;
  const endMs = Math.ceil((last + padding) / step) * step;
  const ticks: number[] = [];
  for (let tick = startMs; tick <= endMs; tick += step) ticks.push(tick);
  const span = endMs - startMs;
  return { startMs, endMs, ticks, at: (ms) => Math.min(1, Math.max(0, (ms - startMs) / span)) };
}

export function callEnd(call: { created_at_ms: number; duration_ms: number | null }, nowMs: number) {
  return call.duration_ms == null ? nowMs : call.created_at_ms + call.duration_ms;
}

export function formatClock(ms: number) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1_000) return `${ms} ms`;
  if (ms < MINUTE_MS) return `${(ms / 1_000).toFixed(1)} s`;
  const minutes = Math.floor(ms / MINUTE_MS);
  return `${minutes}m ${String(Math.round((ms % MINUTE_MS) / 1_000)).padStart(2, "0")}s`;
}
