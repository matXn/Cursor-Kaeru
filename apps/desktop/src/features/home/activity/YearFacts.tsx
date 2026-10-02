import { formatCompactInteger, formatInteger } from "../../../shared/utils/numberFormat";
import { Icon } from "../../../shared/ui/Icon";
import { activeDaysGlyph, callCountGlyph, peakGlyph, tokensGlyph } from "../../../shared/ui/glyphs";
import type { OverviewMetrics } from "../../../shared/api";
import { Cell, Grid, Rule } from "../../../shell/layout/Grid";
import type { ContributionDay } from "./ContributionCalendar";
import styles from "./YearFacts.module.scss";

function longestStreak(days: ContributionDay[]) {
  let best = 0;
  let current = 0;
  for (const day of days) {
    current = day.tokens > 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

// Four facts about the past year, three columns each, under a strong rule.
export function YearFacts({ days, metrics }: { days: ContributionDay[]; metrics: OverviewMetrics }) {
  const active = days.filter((day) => day.tokens > 0);
  const total = active.reduce((sum, day) => sum + day.tokens, 0);
  const busiest = active.reduce<ContributionDay | null>((best, day) => day.tokens > (best?.tokens ?? 0) ? day : best, null);
  const facts = [
    { glyph: activeDaysGlyph, label: "Active days", value: formatInteger(active.length), note: t("最长连续 {days} 天", { days: longestStreak(days) }) },
    { glyph: peakGlyph, label: "Peak day", value: busiest ? busiest.date.slice(5) : "—", note: busiest ? `${formatCompactInteger(busiest.tokens)} Token` : t("暂无数据") },
    {
      glyph: callCountGlyph,
      label: "Calls",
      value: formatCompactInteger(metrics.llm_calls),
      title: formatInteger(metrics.llm_calls),
      note: t("成功 {successful} / 异常 {failed}", {
        successful: formatCompactInteger(metrics.successful_calls),
        failed: formatCompactInteger(metrics.failed_calls),
      }),
    },
    { glyph: tokensGlyph, label: "Daily average", value: active.length ? formatCompactInteger(Math.round(total / active.length)) : "—", note: t("每个活跃日的 Token") },
  ];

  return <Grid className={styles.root}>
    <Rule />
    {facts.map((fact, index) => <Cell key={fact.label} from={index * 3 + 1} to={index * 3 + 4} className={styles.fact}>
      <div className={styles.label}><Icon icon={fact.glyph} size="1.2em" />{fact.label}</div>
      <div className={styles.value} title={fact.title}>{fact.value}</div>
      <div className={styles.note}>{fact.note}</div>
    </Cell>)}
  </Grid>;
}
