import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/store";
import { formatCompactInteger, formatInteger, formatLocaleCompact } from "../../../shared/utils/numberFormat";
import { Icon } from "../../../shared/ui/Icon";
import { activeDaysGlyph, peakGlyph, registrationGlyph, streakGlyph } from "../../../shared/ui/glyphs";
import { ContributionCalendar, type ContributionDay } from "./ContributionCalendar";
import styles from "./ActivityWall.module.scss";

const HEAT_LEVELS = [0, 1, 2, 3, 4];
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function longestStreak(days: ContributionDay[]) {
  let best = 0;
  let current = 0;
  for (const day of days) {
    current = day.tokens > 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

// Log-style reading of one day: "2026-07-04 SAT — 312K TOKEN".
function logLine(day: ContributionDay) {
  const name = weekday.format(new Date(`${day.date}T00:00:00Z`)).toUpperCase();
  return `${day.date} ${name} — ${day.tokens > 0 ? `${formatCompactInteger(day.tokens)} TOKEN` : "IDLE"}`;
}

// Past-year story: a debossed headline number, three gauges, the wall pressed into the page.
export function ActivityWall({ days }: { days: ContributionDay[] }) {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<ContributionDay | null>(null);
  const total = days.reduce((sum, day) => sum + day.tokens, 0);
  const activeDays = days.filter((day) => day.tokens > 0).length;
  const busiest = days.reduce<ContributionDay | null>((best, day) => day.tokens > (best?.tokens ?? 0) ? day : best, null);
  const [number, unit = ""] = formatLocaleCompact(total, locale).split(" ");

  return <section className={styles.root} aria-label={t("过去一年的 Token 用量")}>
    <Icon className={styles.registration} icon={registrationGlyph} size="1.7em" />
    <p className={styles.range}>{days[0]?.date} → {days.at(-1)?.date}</p>
    <header className={styles.header}>
      <h2 className={styles.headline} title={formatInteger(total)}>
        <span className={`deboss ${styles.total}`}>{number}</span>
        <span className={styles.unit}>{unit} Token</span>
      </h2>
      <dl className={styles.facts}>
        <div><dt><Icon icon={activeDaysGlyph} size="1.3em" />ACTIVE</dt><dd>{activeDays}d</dd></div>
        <div><dt><Icon icon={streakGlyph} size="1.3em" />STREAK</dt><dd>{longestStreak(days)}d</dd></div>
        <div><dt><Icon icon={peakGlyph} size="1.3em" />PEAK</dt><dd>{busiest ? busiest.date.slice(5) : "—"}</dd></div>
      </dl>
    </header>
    <div className={styles.pocket}>
      <ContributionCalendar
        days={days}
        onHover={setHovered}
        onSelect={(day) => navigate(`/calls?day=${day.date}`)}
      />
    </div>
    <footer className={styles.footer}>
      <span className={styles.readout} aria-live="polite">
        {hovered ? logLine(hovered) : t("悬停查看某一天，点击查看当天的调用")}
      </span>
      <span className={styles.legend} aria-hidden="true">
        Less
        {HEAT_LEVELS.map((level) => <i key={level} style={{ background: `var(--heat-${level})` }} />)}
        More
      </span>
    </footer>
  </section>;
}
