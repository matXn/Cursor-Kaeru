import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/store";
import { formatCompactInteger, formatInteger, formatLocaleCompact } from "../../../shared/utils/numberFormat";
import { Cell, Grid, Rule } from "../../../shell/layout/Grid";
import { ContributionCalendar, type ContributionDay } from "./ContributionCalendar";
import { randomBook } from "./books";
import { readLastSeen, writeLastSeen } from "./lastSeen";
import { RollingNumber } from "./RollingNumber";
import styles from "./ActivityWall.module.scss";

const HEAT_LEVELS = [0, 1, 2, 3, 4];
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

// Log-style reading of one day: "2026-07-04 SAT — 312K TOKEN".
function logLine(day: ContributionDay) {
  const name = weekday.format(new Date(`${day.date}T00:00:00Z`)).toUpperCase();
  return `${day.date} ${name} — ${day.tokens > 0 ? `${formatCompactInteger(day.tokens)} TOKEN` : "IDLE"}`;
}

type Roll = { from: string | null; runId: number; delta: number; freshFrom: string | null };

// Past-year story on the page grid. Columns 1–8 carry the engraved total with its unit right
// at its foot, and the yardstick on its own row below; `aside` (the range block) takes 9–12
// across both rows and `filter` heads it. The wall spans the full width.
export function ActivityWall({ days, filter, aside }: { days: ContributionDay[]; filter: ReactNode; aside: ReactNode }) {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<ContributionDay | null>(null);
  const total = days.reduce((sum, day) => sum + day.tokens, 0);
  const loaded = days.length > 0;
  const [number, unit = ""] = formatLocaleCompact(total, locale).split(" ");
  const [book, setBook] = useState(randomBook);
  // A new yardstick each time the overview is opened; it stays put while you look at it.
  useEffect(() => setBook(randomBook()), []);
  const [roll, setRoll] = useState<Roll>({ from: null, runId: 0, delta: 0, freshFrom: null });

  // Each time the overview is shown (kept-alive pages re-run effects when they become visible)
  // and whenever the total moves while it is open: roll from what was seen last.
  // The first view ever rolls up from zero.
  useEffect(() => {
    const today = days.at(-1)?.date;
    if (!today) return;
    const seen = readLastSeen();
    writeLastSeen({ total, day: today });
    if (seen?.total === total) return;
    const [seenNumber, seenUnit = ""] = seen ? formatLocaleCompact(seen.total, locale).split(" ") : [];
    const from = seen && seenUnit === unit ? seenNumber : number.replace(/\d/g, "0");
    setRoll((current) => ({
      from,
      runId: current.runId + 1,
      delta: seen ? total - seen.total : 0,
      freshFrom: seen ? seen.day : null,
    }));
  }, [total]);

  return <section aria-label={t("过去一年的 Token 用量")}>
    <Grid>
      <Rule />
      <Cell from={1} to={9} className={styles.label}>Activity · {t("过去一年")}</Cell>
      <Cell from={9} to={13} className={styles.filter}>{filter}</Cell>

      <Cell from={1} to={9} className={styles.headline}>
        <h2 className={styles.total} title={formatInteger(total)}>
          {loaded && <RollingNumber className={styles.engraved} value={number} from={roll.from} runId={roll.runId} />}
        </h2>
        <span className={styles.unitStack}>
          {roll.delta > 0 && <span key={roll.runId} className={styles.delta}>{t("较上次查看 +{delta}", { delta: formatLocaleCompact(roll.delta, locale) })}</span>}
          {loaded && <span className={styles.unit}>{unit} Token</span>}
        </span>
      </Cell>
      <Cell from={9} to={13} style={{ gridRow: "span 2" }}>{aside}</Cell>
      <Cell from={1} to={9}>
        {loaded && total >= book.tokens && <p className={styles.yardstick}>
          You've used <b>~{formatInteger(Math.round(total / book.tokens))}×</b> more tokens than {book.title}.
        </p>}
      </Cell>

      {loaded && <Cell from={1} to={13} className={styles.pocket}>
        <ContributionCalendar
          days={days}
          freshFrom={roll.freshFrom}
          freshRun={roll.runId}
          onHover={setHovered}
          onSelect={(day) => navigate(`/calls?day=${day.date}`)}
        />
      </Cell>}
      <Cell from={1} to={13} className={styles.footer}>
        <span className={styles.readout} aria-live="polite">
          {hovered ? logLine(hovered) : t("悬停查看某一天，点击查看当天的调用")}
        </span>
        <span className={styles.legend} aria-hidden="true">
          Less
          {HEAT_LEVELS.map((level) => <i key={level} style={{ background: `var(--heat-${level})` }} />)}
          More
        </span>
      </Cell>
    </Grid>
  </section>;
}
