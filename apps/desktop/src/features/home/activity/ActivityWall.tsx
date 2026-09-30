import { formatCompactInteger, formatInteger } from "../../../shared/utils/numberFormat";
import { ContributionCalendar, type ContributionDay } from "./ContributionCalendar";
import styles from "./ActivityWall.module.scss";

export type ActivityWallData = {
  days: ContributionDay[];
  tokens: number;
  calls: number;
};

const HEAT_LEVELS = [0, 1, 2, 3, 4];

export function ActivityWall({ data }: { data: ActivityWallData }) {
  const activeDays = data.days.filter((day) => day.tokens > 0).length;

  return <section className={styles.root} aria-label={t("过去一年的 Token 用量")}>
    <header className={styles.header}>
      <h2 className={styles.title}>{t("过去一年")}</h2>
      <dl className={styles.summary}>
        <div><dt>Token</dt><dd title={formatInteger(data.tokens)}>{formatCompactInteger(data.tokens)}</dd></div>
        <div><dt>{t("调用")}</dt><dd title={formatInteger(data.calls)}>{formatCompactInteger(data.calls)}</dd></div>
        <div><dt>{t("活跃天数")}</dt><dd>{activeDays}</dd></div>
      </dl>
    </header>
    <ContributionCalendar data={data.days} />
    <footer className={styles.legend} aria-hidden="true">
      <span>{t("少")}</span>
      {HEAT_LEVELS.map((level) => <i key={level} style={{ background: `var(--heat-${level})` }} />)}
      <span>{t("多")}</span>
    </footer>
  </section>;
}
