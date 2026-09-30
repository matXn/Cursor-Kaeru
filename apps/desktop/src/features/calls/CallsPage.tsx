import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/store";
import { api, type LlmCall } from "../../shared/api";
import { appStore } from "../../shared/store/appStore";
import controls from "../../shared/ui/Controls.module.scss";
import { Icon } from "../../shared/ui/Icon";
import { chevronLeftIcon, chevronRightIcon } from "../../shared/ui/icons";
import { formatCompactInteger } from "../../shared/utils/numberFormat";
import { PageContent } from "../../shell/layout/PageContent";
import { CallRoadmap } from "./roadmap/CallRoadmap";
import styles from "./CallsPage.module.scss";

const CALL_REFRESH_INTERVAL_MS = 2_000;
const DAY_MS = 24 * 60 * 60_000;

// Days are local calendar days, addressed as YYYY-MM-DD in the ?day= query.
function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayRange(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function shiftDay(key: string, days: number) {
  const { startMs } = dayRange(key);
  return localDayKey(new Date(startMs + days * DAY_MS + DAY_MS / 2));
}

function matches(call: LlmCall, keyword: string) {
  if (!keyword) return true;
  const needle = keyword.toLowerCase();
  return [call.display_name, call.model_id, call.status, call.error_message ?? "", call.conversation_id]
    .some((field) => field.toLowerCase().includes(needle));
}

// One day of calls as a roadmap: conversations are groups, each call is a bar on the shared time axis.
export function CallsPage() {
  const { locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const today = localDayKey(new Date());
  const day = params.get("day") ?? today;
  const live = day === today;
  const [calls, setCalls] = useState<LlmCall[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let disposed = false;
    const range = dayRange(day);
    const load = () => {
      if (disposed || document.visibilityState !== "visible") return;
      void api.calls(range).then((next) => {
        if (disposed) return;
        setCalls(next);
        setNowMs(Date.now());
      });
    };
    load();
    // Only the current day changes while you watch it.
    const interval = live ? window.setInterval(load, CALL_REFRESH_INTERVAL_MS) : undefined;
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [day, live]);

  const visible = useMemo(() => calls.filter((call) => matches(call, keyword)), [calls, keyword]);
  const tokens = visible.reduce((sum, call) => sum + (call.total_tokens ?? 0), 0);
  const failed = visible.filter((call) => call.status === "failed").length;
  const dayLabel = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short" }).format(new Date(dayRange(day).startMs));
  const goTo = (next: string) => setParams(next === today ? {} : { day: next });

  const content = <div className={styles.page}>
    <div className={styles.toolbar}>
      <div className={styles.dayNav}>
        <button type="button" className={controls.iconButton} aria-label={t("前一天")} onClick={() => goTo(shiftDay(day, -1))}>
          <Icon icon={chevronLeftIcon} size="1.1em" />
        </button>
        <span className={styles.day}>{dayLabel}</span>
        <button type="button" className={controls.iconButton} aria-label={t("后一天")} disabled={live} onClick={() => goTo(shiftDay(day, 1))}>
          <Icon icon={chevronRightIcon} size="1.1em" />
        </button>
        {!live && <button type="button" className={styles.todayButton} onClick={() => goTo(today)}>{t("今天")}</button>}
      </div>
      <input
        className={styles.filter}
        type="search"
        placeholder={t("按模型、状态或对话筛选")}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <span className={styles.summary}>
        {t("{count} 次调用", { count: visible.length })}
        <span> · {formatCompactInteger(tokens)} Token</span>
        {failed > 0 && <span className={styles.failed}> · {t("{count} 次异常", { count: failed })}</span>}
      </span>
    </div>
    <div className={styles.scroll}>
      {visible.length > 0
        ? <CallRoadmap calls={visible} nowMs={nowMs} live={live} onOpen={(call) => void appStore.openCallDetails(call.call_id)} />
        : <p className={styles.empty}>{calls.length > 0 ? t("没有符合筛选条件的调用") : t("这一天没有调用")}</p>}
    </div>
  </div>;
  return <PageContent fixed title={t("调用")} contentClassName={styles.pageContent} sections={[{ key: "calls", estimatedHeight: 720, content }]} />;
}
