// Local calendar days as YYYY-MM-DD keys. The activity wall and the calls page both address
// days this way, and the server aligns day buckets to the same local midnight.
export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localDayRange(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { startMs: new Date(year, month - 1, day).getTime(), endMs: new Date(year, month - 1, day + 1).getTime() };
}

export function shiftLocalDay(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return localDayKey(new Date(year, month - 1, day + days));
}

// Current offset from UTC, sent with range queries so hour and day buckets start locally.
export function utcOffsetMs() {
  return -new Date().getTimezoneOffset() * 60_000;
}
