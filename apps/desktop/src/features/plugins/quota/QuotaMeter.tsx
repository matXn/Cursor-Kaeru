import { useI18n } from "../../../i18n/store";
import { pluginText, type PluginResourceMetric } from "../../../shared/api";
import styles from "./QuotaMeter.module.scss";

const CELLS = 20;
const LOW_PERCENT = 20;

const weekdayTime = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// When the window resets, in English like the quota names: "Fri 3:40 AM" within a week,
// otherwise the date, "Oct 12".
export function resetText(resetAtMs: number, nowMs = Date.now()) {
  const date = new Date(resetAtMs);
  return resetAtMs - nowMs < 7 * 24 * 60 * 60_000 ? weekdayTime.format(date).replace(",", "") : monthDay.format(date);
}

/** Remaining quota of one window as a row of lit cells, the same cells as the activity wall. */
export function QuotaMeter({ metric, compact = false }: { metric: PluginResourceMetric; compact?: boolean }) {
  const { locale } = useI18n();
  const label = pluginText(metric.label, locale);
  if (metric.unit !== "percent") {
    return <div className={styles.root} data-compact={compact || undefined}>
      <div className={styles.head}><span className={styles.label}>{label}</span></div>
      <div className={styles.count}>{metric.value}</div>
    </div>;
  }
  const remaining = Math.max(0, Math.min(100, Math.round(metric.value)));
  const lit = Math.round((remaining / 100) * CELLS);
  const level = remaining === 0 ? "empty" : remaining <= LOW_PERCENT ? "low" : "ok";
  return <div className={styles.root} data-level={level} data-compact={compact || undefined} aria-label={t("{label} 剩余 {percent}%", { label, percent: remaining })}>
    <div className={styles.head}>
      <span className={styles.label}>{label}</span>
      {metric.resetAtMs != null && <span className={styles.reset}>{resetText(metric.resetAtMs)}</span>}
    </div>
    <div className={styles.body}>
      <span className={styles.percent}>{remaining === 0 ? t("已用完") : `${remaining}%`}</span>
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: CELLS }, (_, index) => <i key={index} data-lit={index < lit || undefined} />)}
      </span>
    </div>
  </div>;
}
