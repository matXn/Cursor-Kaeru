import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../../../i18n/runtime";
import { useI18n } from "../../../i18n/store";
import styles from "./ContributionCalendar.module.scss";

export type ContributionDay = {
  date: string;
  tokens: number;
};

type Cell = ContributionDay & { column: number; row: number; level: number };

const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed GitHub-like grid: cells never stretch; narrow windows drop the oldest weeks.
const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const GUTTER = 28;
const HEADER = 18;

function parseDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function mondayIndex(date: Date) {
  return (date.getUTCDay() + 6) % 7;
}

// Levels are quartiles of active days, so one outlier does not flatten the rest.
function levelScale(days: ContributionDay[]) {
  const active = days.map((day) => day.tokens).filter((tokens) => tokens > 0).sort((a, b) => a - b);
  const quantile = (p: number) => active[Math.floor(p * (active.length - 1))] ?? 0;
  const cuts = [quantile(0.25), quantile(0.5), quantile(0.75)];
  return (tokens: number) => tokens === 0 ? 0 : tokens <= cuts[0] ? 1 : tokens <= cuts[1] ? 2 : tokens <= cuts[2] ? 3 : 4;
}

function buildCells(days: ContributionDay[]) {
  const level = levelScale(days);
  const first = parseDate(days[0].date);
  const start = first.getTime() - mondayIndex(first) * DAY_MS;
  const cells: Cell[] = days.map((day) => {
    const date = parseDate(day.date);
    const offset = Math.round((date.getTime() - start) / DAY_MS);
    return { ...day, column: Math.floor(offset / 7), row: mondayIndex(date), level: level(day.tokens) };
  });
  return { cells, columnCount: cells.at(-1)!.column + 1 };
}

function labels(locale: Locale) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const monday = Date.UTC(2024, 0, 1);
  return {
    weekdays: [0, 2, 4].map((row) => ({ row, text: weekday.format(monday + row * DAY_MS) })),
    month: (date: Date) => month.format(date),
  };
}

export function ContributionCalendar({ days, onHover, onSelect }: {
  days: ContributionDay[];
  onHover: (day: ContributionDay | null) => void;
  onSelect: (day: ContributionDay) => void;
}) {
  const { locale } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { cells, columnCount } = useMemo(() => buildCells(days), [days]);
  const text = useMemo(() => labels(locale), [locale]);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fitColumns = Math.max(1, Math.floor((width - GUTTER + GAP) / STEP));
  const visibleColumns = Math.min(columnCount, fitColumns);
  const firstColumn = columnCount - visibleColumns;
  const visible = cells.filter((cell) => cell.column >= firstColumn);
  const months = visible.reduce<Array<{ key: string; text: string; x: number }>>((ticks, cell) => {
    const date = parseDate(cell.date);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    // Label each month at its first week column; skip labels that would collide.
    if (cell.row !== 0 || ticks.at(-1)?.key === key) return ticks;
    const x = GUTTER + (cell.column - firstColumn) * STEP;
    if (ticks.length && x - ticks.at(-1)!.x < STEP * 3) return ticks;
    ticks.push({ key, text: text.month(date), x });
    return ticks;
  }, []);
  const today = days.at(-1)?.date;
  const svgWidth = GUTTER + visibleColumns * STEP - GAP;
  const svgHeight = HEADER + 7 * STEP - GAP;

  return <div ref={root} className={styles.root}>
    {width > 0 && <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      role="img"
      aria-label={t("过去一年的 Token 用量日历")}
      onMouseLeave={() => onHover(null)}
    >
      {months.map((month) => <text key={month.key} className={styles.label} x={month.x} y={10}>{month.text}</text>)}
      {text.weekdays.map((day) => <text key={day.row} className={styles.label} x={0} y={HEADER + day.row * STEP + 9}>{day.text}</text>)}
      {visible.map((cell) => <rect
        key={cell.date}
        className={styles.cell}
        x={GUTTER + (cell.column - firstColumn) * STEP}
        y={HEADER + cell.row * STEP}
        width={CELL}
        height={CELL}
        rx={2}
        fill={`var(--heat-${cell.level})`}
        data-today={cell.date === today || undefined}
        onMouseEnter={() => onHover(cell)}
        onClick={() => onSelect(cell)}
      />)}
    </svg>}
  </div>;
}
