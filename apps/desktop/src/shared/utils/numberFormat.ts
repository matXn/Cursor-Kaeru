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

const chineseUnits = [
  { value: 1_000_000_000_000, suffix: " 万亿" },
  { value: 100_000_000, suffix: " 亿" },
  { value: 10_000, suffix: " 万" },
] as const;

// Three significant digits ("1.03", "12.4", "103"), choosing the decimals after rounding so
// 9.996 reads "10.0", not "10.00". From 100 up the whole number shows ("2490").
function threeDigits(scaled: number) {
  if (Number(scaled.toFixed(2)) < 10) return scaled.toFixed(2);
  if (Number(scaled.toFixed(1)) < 100) return scaled.toFixed(1);
  return scaled.toFixed(0);
}

// Large totals in the unit the reader thinks in, three significant digits:
// "1.03 亿", "99.9 亿", "100 亿" and "2490 万" in Chinese; "1.03B", "24.9M" in English.
export function formatLocaleCompact(value: number, locale: string) {
  const number = normalizeInteger(value);
  const sign = number < 0 ? "-" : "";
  const magnitude = Math.abs(number);
  const units = locale.startsWith("zh") ? chineseUnits : compactUnits;
  // Largest unit whose rounded figure reaches 1, so 9999.6 万 carries over to "1.00 亿".
  for (const unit of units) {
    const figure = threeDigits(magnitude / unit.value);
    if (Number(figure) >= 1) return `${sign}${figure}${unit.suffix}`;
  }
  return formatInteger(number);
}
