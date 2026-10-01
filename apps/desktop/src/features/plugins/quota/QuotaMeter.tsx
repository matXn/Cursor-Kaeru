import { useI18n } from "../../../i18n/store";
import { pluginText, type PluginResourceMetric } from "../../../shared/api";
import styles from "./QuotaMeter.module.scss";

const CELLS = 20;
const LOW_PERCENT = 20;

// "42 分钟后重置" within a day, otherwise the weekday or date it resets on.
export function resetText(resetAtMs: number, locale: string, nowMs = Date.now()) {
  const minutes = Math.max(0, Math.round((resetAtMs - nowMs) / 60_000));
  if (minutes < 60) return t("{minutes} 分钟后重置", { minutes });
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? t("{hours} 小时 {minutes} 分后重置", { hours, minutes: rest }) : t("{hours} 小时后重置", { hours });
  }
  const date = new Date(resetAtMs);
  const when = minutes < 7 * 24 * 60
    ? `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)} ${new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`
    : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
  return t("{when} 重置", { when });
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
      {metric.resetAtMs != null && <span className={styles.reset}>{resetText(metric.resetAtMs, locale)}</span>}
    </div>
    <div className={styles.body}>
      <span className={styles.percent}>{remaining === 0 ? t("已用完") : `${remaining}%`}</span>
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: CELLS }, (_, index) => <i key={index} data-lit={index < lit || undefined} />)}
      </span>
    </div>
  </div>;
}
