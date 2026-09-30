import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/store";
import { formatInteger, formatLocaleCompact } from "../../../shared/utils/numberFormat";
import { ContributionCalendar, type ContributionDay } from "./ContributionCalendar";
import styles from "./ActivityWall.module.scss";

const HEAT_LEVELS = [0, 1, 2, 3, 4];

function longestStreak(days: ContributionDay[]) {
  let best = 0;
  let current = 0;
  for (const day of days) {
    current = day.tokens > 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

// Past-year story: one headline number, a line of facts, the wall, and a hover readout.
export function ActivityWall({ days }: { days: ContributionDay[] }) {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<ContributionDay | null>(null);
  const dayFormatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });
  const shortDay = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const formatDay = (day: ContributionDay, formatter: Intl.DateTimeFormat) => formatter.format(new Date(`${day.date}T00:00:00Z`));
  const total = days.reduce((sum, day) => sum + day.tokens, 0);
  const activeDays = days.filter((day) => day.tokens > 0).length;
  const busiest = days.reduce<ContributionDay | null>((best, day) => day.tokens > (best?.tokens ?? 0) ? day : best, null);

  return <section className={styles.root} aria-label={t("过去一年的 Token 用量")}>
    <header>
      <h2 className={styles.headline}>
        <span className={styles.total} title={formatInteger(total)}>{formatLocaleCompact(total, locale)}</span>
        <span>{t("Token，过去一年")}</span>
      </h2>
      <p className={styles.facts}>
        {t("活跃 {days} 天", { days: activeDays })}
        <span aria-hidden="true"> · </span>
        {t("最长连续 {days} 天", { days: longestStreak(days) })}
        {busiest && <>
          <span aria-hidden="true"> · </span>
          {t("最忙 {day}", { day: formatDay(busiest, shortDay) })}
        </>}
      </p>
    </header>
    <ContributionCalendar
      days={days}
      onHover={setHovered}
      onSelect={(day) => navigate(`/calls?day=${day.date}`)}
    />
    <footer className={styles.footer}>
      <span className={styles.readout} aria-live="polite">
        {hovered
          ? <><strong>{formatDay(hovered, dayFormatter)}</strong> · {hovered.tokens > 0
            ? `${formatLocaleCompact(hovered.tokens, locale)} Token`
            : t("没有调用")}</>
          : t("悬停查看某一天，点击查看当天的调用")}
      </span>
      <span className={styles.legend} aria-hidden="true">
        {t("少")}
        {HEAT_LEVELS.map((level) => <i key={level} style={{ background: `var(--heat-${level})` }} />)}
        {t("多")}
      </span>
    </footer>
  </section>;
}
