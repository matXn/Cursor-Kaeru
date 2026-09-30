const integerFormatter = new Intl.NumberFormat("en-US");

const compactUnits = [
  { value: 1_000_000_000_000, suffix: "T" },
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
] as const;

function normalizeInteger(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatInteger(value: number) {
  return integerFormatter.format(normalizeInteger(value));
}

export function formatCompactInteger(value: number) {
  const number = normalizeInteger(value);
  const unit = compactUnits.find(({ value: threshold }) => Math.abs(number) >= threshold);
  if (!unit) return formatInteger(number);

  const scaled = number / unit.value;
  const fractionDigits = Math.abs(scaled) < 100 ? 1 : 0;
  return `${trimTrailingZeros(scaled.toFixed(fractionDigits))}${unit.suffix}`;
}

// Large totals in the unit the reader thinks in: "3142 万" in Chinese, "31.4M" in English.
export function formatLocaleCompact(value: number, locale: string) {
  if (!locale.startsWith("zh")) return formatCompactInteger(value);
  const format = (fractionDigits: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: fractionDigits }).formatToParts(normalizeInteger(value));
  // One decimal only while the scaled number is small ("3.1 万"), none once it reaches 100 ("2111 万").
  const rough = format(1);
  const scaled = Number(rough.filter((part) => part.type === "integer").map((part) => part.value).join(""));
  const parts = scaled >= 100 ? format(0) : rough;
  const number = parts.filter((part) => part.type !== "compact").map((part) => part.value).join("");
  const unit = parts.find((part) => part.type === "compact")?.value;
  return unit ? `${number} ${unit}` : number;
}
