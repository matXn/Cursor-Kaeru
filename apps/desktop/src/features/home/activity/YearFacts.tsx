import { formatInteger } from "../../../shared/utils/numberFormat";
import { Icon } from "../../../shared/ui/Icon";
import { activeDaysGlyph, conversationsGlyph, favoriteModelGlyph, peakHourGlyph } from "../../../shared/ui/glyphs";
import type { Overview } from "../../../shared/api";
import { Cell, Grid, Rule } from "../../../shell/layout/Grid";
import type { ContributionDay } from "./ContributionCalendar";
import { ModelShare } from "./ModelShare";
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

function percent(part: number, whole: number) {
  return `${whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0"}%`;
}

// Four facts about the past year, three columns each, under a strong rule; the share of
// tokens by model runs underneath them.
export function YearFacts({ days, overview }: { days: ContributionDay[]; overview: Overview }) {
  const shareTotal = overview.model_share.reduce((sum, model) => sum + model.tokens, 0);
  const favorite = overview.model_share[0];
  const facts = [
    {
      glyph: conversationsGlyph,
      label: "Conversations",
      value: formatInteger(overview.metrics.conversations),
      note: t("Cursor 对话"),
    },
    {
      glyph: favoriteModelGlyph,
      label: "Favorite model",
      value: favorite?.display_name ?? "—",
      note: favorite ? t("占全部 Token 的 {share}", { share: percent(favorite.tokens, shareTotal) }) : t("暂无数据"),
    },
    {
      glyph: peakHourGlyph,
      label: "Peak hour",
      value: overview.peak_hour === null ? "—" : `${String(overview.peak_hour).padStart(2, "0")}:00`,
      note: t("一天里最忙的一小时"),
    },
    {
      glyph: activeDaysGlyph,
      label: "Active days",
      value: formatInteger(days.filter((day) => day.tokens > 0).length),
      note: t("最长连续 {days} 天", { days: longestStreak(days) }),
    },
  ];

  return <Grid className={styles.root}>
    <Rule />
    {facts.map((fact, index) => <Cell key={fact.label} from={index * 3 + 1} to={index * 3 + 4} className={styles.fact}>
      <div className={styles.label}><Icon icon={fact.glyph} size="1.2em" />{fact.label}</div>
      <div className={styles.value} title={fact.value}>{fact.value}</div>
      <div className={styles.note}>{fact.note}</div>
    </Cell>)}
    {overview.model_share.length > 0 && <>
      <div className={styles.hair}><Rule hair /></div>
      <Cell from={1} to={13}><ModelShare models={overview.model_share} /></Cell>
    </>}
  </Grid>;
}
