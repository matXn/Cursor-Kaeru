import { useState, type CSSProperties, type ReactNode } from "react";
import type { LlmCall } from "../../../shared/api";
import { Icon } from "../../../shared/ui/Icon";
import { chevronDownIcon } from "../../../shared/ui/icons";
import { formatCompactInteger } from "../../../shared/utils/numberFormat";
import { callEnd, formatClock, formatDuration, timeScale, type TimeScale } from "./timeScale";
import { formatOutputSpeed, outputSpeed } from "../outputSpeed";
import styles from "./CallRoadmap.module.scss";

type Group = {
  id: string;
  calls: LlmCall[];
  startMs: number;
  endMs: number;
  tokens: number;
  status: LlmCall["status"];
};

// Conversations are the roadmap's groups; latest activity first, calls oldest-first inside.
function groupByConversation(calls: LlmCall[], nowMs: number): Group[] {
  const groups = new Map<string, LlmCall[]>();
  for (const call of calls) groups.set(call.conversation_id, [...(groups.get(call.conversation_id) ?? []), call]);
  return [...groups.entries()].map(([id, members]) => {
    const ordered = [...members].sort((a, b) => a.created_at_ms - b.created_at_ms);
    const status = ordered.some((call) => call.status === "running") ? "running"
      : ordered.some((call) => call.status === "failed") ? "failed" : "completed";
    return {
      id,
      calls: ordered,
      startMs: ordered[0].created_at_ms,
      endMs: Math.max(...ordered.map((call) => callEnd(call, nowMs))),
      tokens: ordered.reduce((sum, call) => sum + (call.total_tokens ?? 0), 0),
      status,
    };
  }).sort((a, b) => b.endMs - a.endMs);
}

function StatusIcon({ status }: { status: string }) {
  return <svg className={styles.statusIcon} data-status={status} viewBox="0 0 16 16" aria-label={status}>
    <circle cx="8" cy="8" r="6.25" fill="none" strokeWidth="1.5" />
    {status === "completed" && <circle cx="8" cy="8" r="2" stroke="none" />}
    {status === "failed" && <path d="M5.75 5.75l4.5 4.5m0-4.5l-4.5 4.5" strokeWidth="1.5" />}
    {status === "cancelled" && <path d="M4.5 11.5l7-7" strokeWidth="1.5" />}
  </svg>;
}

// Text beside a bar, never on it: on whichever side of the bar has more room in the lane.
function Label({ scale, startMs, endMs, className, children }: { scale: TimeScale; startMs: number; endMs: number; className: string; children: ReactNode }) {
  const before = scale.at(startMs) > 1 - scale.at(endMs);
  const room = before ? scale.at(startMs) : 1 - scale.at(endMs);
  const style = before
    ? { right: `${(1 - scale.at(startMs)) * 100}%`, maxWidth: `${room * 100}%` }
    : { left: `${scale.at(endMs) * 100}%`, maxWidth: `${room * 100}%` };
  return <span className={className} data-anchor={before ? "end" : "start"} style={style}>{children}</span>;
}

function span(scale: TimeScale, startMs: number, endMs: number): CSSProperties {
  const left = scale.at(startMs);
  return { left: `${left * 100}%`, width: `${Math.max(0, scale.at(endMs) - left) * 100}%` };
}

export function CallRoadmap({ calls, nowMs, live, onOpen }: {
  calls: LlmCall[];
  nowMs: number;
  // Draw the "now" line only when viewing the current day.
  live: boolean;
  onOpen: (call: LlmCall) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = groupByConversation(calls, nowMs);
  const scale = timeScale(groups.map((group) => ({ startMs: group.startMs, endMs: live ? Math.max(group.endMs, nowMs) : group.endMs })));
  if (!scale) return null;
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const nowLeft = live ? `${scale.at(nowMs) * 100}%` : null;

  return <div className={styles.root} role="table" aria-label={t("调用时间线")}>
    <div className={styles.header} role="row">
      <div className={styles.side}>
        <span className={styles.index}>#</span>
        <span className={styles.name}>{t("调用")}</span>
        <span className={styles.cell}>{t("开始")}</span>
        <span className={styles.cell}>{t("耗时")}</span>
        <span className={styles.cell}>Token</span>
        <span className={styles.cell}>Token/s</span>
      </div>
      <div className={styles.lane}>
        {/* Edge ticks keep their grid line but drop the label, so labels never collide or clip. */}
        {scale.ticks.slice(1, -1).map((tick) => <span key={tick} className={styles.tick} style={{ left: `${scale.at(tick) * 100}%` }}>{formatClock(tick)}</span>)}
        {nowLeft && <span className={styles.nowMarker} style={{ left: nowLeft }} />}
      </div>
    </div>
    <div className={styles.body}>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.side} />
        <div className={styles.lane}>
          {scale.ticks.map((tick) => <i key={tick} style={{ left: `${scale.at(tick) * 100}%` }} />)}
          {nowLeft && <b style={{ left: nowLeft }} />}
        </div>
      </div>
      {groups.map((group) => {
        const open = !collapsed.has(group.id);
        return <section key={group.id} className={styles.group}>
          <div className={styles.groupRow} role="row">
            <button type="button" className={styles.side} aria-expanded={open} onClick={() => toggle(group.id)}>
              <Icon className={styles.chevron} icon={chevronDownIcon} size="1em" />
              <StatusIcon status={group.status} />
              <span className={styles.groupTitle}>{t("对话")}<code>{group.id.slice(0, 8)}</code></span>
              <span className={styles.count}>{group.calls.length}</span>
            </button>
            <div className={styles.lane}>
              <span className={styles.groupBar} style={span(scale, group.startMs, group.endMs)} />
              <Label scale={scale} startMs={group.startMs} endMs={group.endMs} className={styles.groupLabel}>
                {formatClock(group.startMs)} – {group.status === "running" ? t("进行中") : formatClock(group.endMs)}
                <span> · {formatCompactInteger(group.tokens)} Token</span>
              </Label>
            </div>
          </div>
          {open && group.calls.map((call, index) => {
            const end = callEnd(call, nowMs);
            return <button key={call.call_id} type="button" className={styles.callRow} role="row" onClick={() => onOpen(call)}>
              <span className={styles.side}>
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.name}>
                  <StatusIcon status={call.status} />
                  <span className={styles.model} title={call.model_id}>{call.display_name}</span>
                </span>
                <span className={styles.cell}>{formatClock(call.created_at_ms)}</span>
                <span className={styles.cell}>{call.status === "running" ? t("进行中") : formatDuration(call.duration_ms)}</span>
                <span className={styles.cell}>{call.total_tokens == null ? "—" : formatCompactInteger(call.total_tokens)}</span>
                <span className={styles.cell}>{formatOutputSpeed(outputSpeed(call))}</span>
              </span>
              <span className={styles.lane}>
                <span className={styles.bar} data-status={call.status} style={span(scale, call.created_at_ms, end)} />
                <Label scale={scale} startMs={call.created_at_ms} endMs={end} className={styles.barLabel}>
                  {call.display_name}
                  {call.error_message && <span className={styles.error}> · {call.error_message}</span>}
                </Label>
              </span>
            </button>;
          })}
        </section>;
      })}
    </div>
  </div>;
}
