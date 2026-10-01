import { useEffect, useState } from "react";
import { api, pluginText, type Overview } from "../../shared/api";
import { ActivityWall } from "./activity/ActivityWall";
import type { ContributionDay } from "./activity/ContributionCalendar";
import { HomeMetrics } from "./metrics/HomeMetrics";
import { Nameplate } from "./Nameplate";
import { PageContent } from "../../shell/layout/PageContent";
import type { VirtualPageSection } from "../../shell/layout/VirtualPage";
import { OverviewTimeRangeFilter, type OverviewRangePreset } from "./overview/OverviewTimeRangeFilter";
import { appStore, useAppStore } from "../../shared/store/appStore";
import { localDayKey, shiftLocalDay } from "../../shared/utils/localDay";
import { formatTimeInput, parseTimeInput } from "../../shared/utils/parseTimeInput";
import { modelProviderName } from "../../shared/utils/modelProvider";
import { claudeIcon, flatColorOrganizationIcon, openAiIcon } from "../../shared/ui/icons";
import { useI18n } from "../../i18n/store";
import styles from "./HomePage.module.scss";

type TimeRange = { startMs: number; endMs: number };

const CALENDAR_DAYS = 365;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function contributionDays(overview: Overview, endMs: number): ContributionDay[] {
  const tokensByDate = new Map<string, number>();
  for (const bucket of overview.token_usage_series) {
    const date = localDayKey(new Date(bucket.bucket_start_ms));
    const tokens = bucket.input_tokens + bucket.cache_read_tokens + bucket.cache_write_tokens + bucket.output_tokens;
    tokensByDate.set(date, (tokensByDate.get(date) ?? 0) + tokens);
  }
  const lastDay = localDayKey(new Date(Math.max(0, endMs - 1)));
  return Array.from({ length: CALENDAR_DAYS }, (_, offset) => {
    const date = shiftLocalDay(lastDay, offset - (CALENDAR_DAYS - 1));
    return { date, tokens: tokensByDate.get(date) ?? 0 };
  });
}

const presetDurations: Record<Exclude<OverviewRangePreset, "custom" | "today">, number> = {
  "ten-minutes": 10 * MINUTE_MS,
  hour: HOUR_MS,
  "four-hours": 4 * HOUR_MS,
  "twenty-four-hours": DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
};

function presetRange(preset: Exclude<OverviewRangePreset, "custom">, now = new Date()): TimeRange {
  const endMs = now.getTime();
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs };
  }
  return { startMs: endMs - presetDurations[preset], endMs };
}

function formatRange(range: TimeRange | null) {
  if (!range) return t("自定义");
  const format = (ms: number) => formatTimeInput(new Date(ms)).slice(5);
  return `${format(range.startMs)} – ${format(range.endMs)}`;
}

// Overview: the past-year wall is the page; range-scoped stats sit quietly below it.
export function HomePage() {
  const { overview, busy, models, plugins } = useAppStore();
  const { locale } = useI18n();
  const [preset, setPreset] = useState<OverviewRangePreset>("hour");
  const [customRange, setCustomRange] = useState<TimeRange | null>(null);
  const [customStart, setCustomStart] = useState(() => formatTimeInput(new Date(Date.now() - HOUR_MS)));
  const [customEnd, setCustomEnd] = useState(() => formatTimeInput(new Date()));
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [appliedModels, setAppliedModels] = useState<string[]>([]);
  const [rangeOverview, setRangeOverview] = useState<Overview | null>(null);
  const [rangeBusy, setRangeBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [year, setYear] = useState<{ overview: Overview; endMs: number } | null>(null);
  const selectedRange = preset === "custom" ? customRange : presetRange(preset);

  useEffect(() => {
    if (!selectedRange) return;
    let active = true;
    setRangeBusy(true);
    void api.overview({ ...selectedRange, modelHashes: appliedModels }).then((next) => {
      if (active) setRangeOverview(next);
    }).finally(() => {
      if (active) setRangeBusy(false);
    });
    return () => { active = false; };
  }, [preset, customRange, overview, refreshVersion, appliedModels]);

  // The wall always covers the past year in daily buckets, independent of the range filter.
  useEffect(() => {
    let active = true;
    const endMs = Date.now();
    void api.overview({ startMs: endMs - CALENDAR_DAYS * DAY_MS, endMs, bucketMs: DAY_MS }).then((next) => {
      if (active) setYear({ overview: next, endMs });
    });
    return () => { active = false; };
  }, [overview, refreshVersion]);

  const filteredOverview = rangeOverview ?? overview;
  const metrics = {
    llmCalls: filteredOverview.metrics.llm_calls,
    successfulCalls: filteredOverview.metrics.successful_calls,
    failedCalls: filteredOverview.metrics.failed_calls,
    tokenUsage: filteredOverview.metrics.token_usage,
    promptTokens: filteredOverview.metrics.prompt_tokens,
    cacheReadTokens: filteredOverview.metrics.cache_read_tokens,
    cacheWriteTokens: filteredOverview.metrics.cache_write_tokens,
  };
  const applyCustom = () => {
    const startMs = parseTimeInput(customStart);
    const endMs = parseTimeInput(customEnd);
    if (startMs === null || endMs === null || startMs >= endMs) return;
    setCustomRange({ startMs, endMs });
    setAppliedModels(selectedModels);
    setPreset("custom");
  };
  const selectPreset = (value: Exclude<OverviewRangePreset, "custom">) => {
    setAppliedModels(selectedModels);
    setPreset(value);
  };
  const refresh = async () => {
    await appStore.refresh();
    setRefreshVersion((version) => version + 1);
  };
  const iconFor = (type: string) => type === "anthropic" ? claudeIcon : openAiIcon;
  const modelOptions = [
    ...models.map((model) => ({
      value: model.model_hash,
      label: model.display_name,
      group: modelProviderName(model),
      icon: iconFor(model.type),
    })),
    ...plugins.flatMap((plugin) => plugin.providers.flatMap((provider) =>
      provider.configured ? provider.models.filter((model) => model.enabled).map((model) => ({
        value: model.id,
        label: model.displayName,
        group: pluginText(provider.displayName, locale) || model.pluginName,
        iconSrc: model.icon || undefined,
        icon: model.icon ? undefined : flatColorOrganizationIcon,
      })) : [],
    )),
  ];
  const filter = <OverviewTimeRangeFilter
    value={preset}
    customLabel={formatRange(customRange)}
    customStart={customStart}
    customEnd={customEnd}
    modelOptions={modelOptions}
    selectedModels={selectedModels}
    busy={busy || rangeBusy}
    onSelect={selectPreset}
    onCustomStartChange={setCustomStart}
    onCustomEndChange={setCustomEnd}
    onSelectedModelsChange={setSelectedModels}
    onCustomApply={applyCustom}
    onRefresh={() => void refresh()}
  />;
  const sections: VirtualPageSection[] = [
    ...(year ? [{
      key: "activity",
      estimatedHeight: 220,
      content: <ActivityWall days={contributionDays(year.overview, year.endMs)} />,
    }] : []),
    {
      key: "metrics",
      estimatedHeight: 110,
      content: <HomeMetrics data={metrics} filter={filter} />,
    },
    { key: "nameplate", estimatedHeight: 80, content: <Nameplate /> },
  ];

  return <PageContent sections={sections} contentClassName={styles.content} />;
}
