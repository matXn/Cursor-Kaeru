import type { EChartsCoreOption } from "echarts/core";
import { useMemo, useState } from "react";
import type { TokenUsageGranularity } from "../../../shared/api";
import { useChartTheme } from "../../../shared/theme/chartTheme";
import { formatCompactInteger } from "../../../shared/utils/numberFormat";
import { EChart } from "./EChart";
import styles from "./DailyTokenUsageChart.module.scss";

export type DailyTokenUsage = {
  bucketStartMs: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

type TooltipItem = {
  dataIndex: number;
};

const EMPTY_BAR_RATIO = 1;
const DATA_HEIGHT_RATIO = 1;

const seriesFocus = {
  emphasis: { focus: "series" },
  blur: { itemStyle: { opacity: 0.2 } },
} as const;

function colorMark(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background-color:${color};vertical-align:middle"></span>`;
}

function formatDay(value: Date) {
  return `${value.getUTCMonth() + 1}/${value.getUTCDate()}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatAxisLabel(bucketStartMs: number, granularity: TokenUsageGranularity) {
  const value = new Date(bucketStartMs);
  if (granularity === "minute") return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  if (granularity === "hour") return `${pad(value.getHours())}:00`;
  const day = value.getUTCDay();
  if (day === 6) return t("周六");
  if (day === 0) return t("周日");
  return formatDay(value);
}

function formatTooltipTime(bucketStartMs: number, granularity: TokenUsageGranularity) {
  const value = new Date(bucketStartMs);
  if (granularity === "day") return formatDay(value);
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return `${value.getMonth() + 1}/${value.getDate()} ${time}`;
}

function totalTokens(day: DailyTokenUsage) {
  return day.inputTokens + day.cacheReadTokens + day.cacheWriteTokens + day.outputTokens;
}

export function DailyTokenUsageChart({
  data,
  granularity,
}: {
  data: DailyTokenUsage[];
  granularity: TokenUsageGranularity;
}) {
  const [hovered, setHovered] = useState(false);
  const chartTheme = useChartTheme();
  const [input, cacheRead, cacheWrite, output] = chartTheme.series;
  const maximumTotal = data.reduce((maximum, day) => Math.max(maximum, totalTokens(day)), 0);
  const axisMaximum = Math.max(1, maximumTotal / DATA_HEIGHT_RATIO);
  const emptyBarHeight = axisMaximum * EMPTY_BAR_RATIO;
  const nonZeroTotals = data.map(totalTokens).filter((total) => total !== 0);
  const averageLevel = nonZeroTotals.length === 0
    ? 0
    : nonZeroTotals.reduce((sum, total) => sum + total, 0) / nonZeroTotals.length;

  const option = useMemo<EChartsCoreOption>(() => ({
    animationDuration: 450,
    animationEasing: "cubicOut",
    grid: { top: 8, right: 0, bottom: 0, left: 0 },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "var(--surface-raised)",
      borderColor: "var(--border)",
      textStyle: { color: "var(--text)", fontFamily: chartTheme.fontUi },
      extraCssText: "border-radius: var(--radius); box-shadow: var(--shadow-popover); font-size: var(--daily-token-tooltip-font-size); line-height: 1.5;",
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: chartTheme.hover },
      },
      formatter: (params: unknown) => {
        const first = (params as TooltipItem[])[0];
        const day = data[first.dataIndex];
        return [
          formatTooltipTime(day.bucketStartMs, granularity),
          `${t("总请求")}：${formatCompactInteger(totalTokens(day))}`,
          `${colorMark(input)}${t("输入（非缓存）")}：${formatCompactInteger(day.inputTokens)}`,
          `${colorMark(cacheRead)}${t("缓存输入")}：${formatCompactInteger(day.cacheReadTokens)}`,
          `${colorMark(cacheWrite)}${t("缓存写入")}：${formatCompactInteger(day.cacheWriteTokens)}`,
          `${colorMark(output)}${t("模型输出")}：${formatCompactInteger(day.outputTokens)}`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: data.map(({ bucketStartMs }) => bucketStartMs),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.border } },
      axisLabel: {
        interval: "auto",
        hideOverlap: true,
        formatter: (_value: string, index: number) => formatAxisLabel(data[index].bucketStartMs, granularity),
        color: chartTheme.textMuted,
        fontFamily: chartTheme.fontMono,
        margin: 14,
      },
    },
    yAxis: {
      type: "value",
      show: false,
      min: 0,
      max: axisMaximum,
    },
    series: [
      {
        name: t("无用量"),
        type: "bar",
        stack: "empty-placeholder",
        data: data.map((day) => totalTokens(day) === 0 ? emptyBarHeight : 0),
        barMaxWidth: 18,
        silent: true,
        z: 0,
        itemStyle: { color: chartTheme.grid, borderRadius: [2, 2, 0, 0] },
        emphasis: { disabled: true },
      },
      {
        name: t("输入（非缓存）"),
        type: "bar",
        stack: "tokens",
        data: data.map(({ inputTokens }) => inputTokens),
        barMaxWidth: 18,
        itemStyle: { color: input },
        ...seriesFocus,
      },
      {
        name: t("缓存输入"),
        type: "bar",
        stack: "tokens",
        data: data.map(({ cacheReadTokens }) => cacheReadTokens),
        barMaxWidth: 18,
        itemStyle: { color: cacheRead },
        ...seriesFocus,
      },
      {
        name: t("缓存写入"),
        type: "bar",
        stack: "tokens",
        data: data.map(({ cacheWriteTokens }) => cacheWriteTokens),
        barMaxWidth: 18,
        itemStyle: { color: cacheWrite },
        ...seriesFocus,
      },
      {
        name: t("模型输出"),
        type: "bar",
        stack: "tokens",
        data: data.map(({ outputTokens }) => outputTokens),
        barMaxWidth: 18,
        barGap: "-100%",
        itemStyle: { color: output, borderRadius: [2, 2, 0, 0] },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: chartTheme.textFaint, opacity: hovered ? 1 : 0, type: "dashed", width: 2 },
          label: {
            show: hovered,
            position: "insideStartTop",
            formatter: t("平均"),
            color: chartTheme.textFaint,
            distance: 8,
          },
          data: [{ yAxis: averageLevel }],
        },
        ...seriesFocus,
      },
    ],
  }), [averageLevel, axisMaximum, chartTheme, data, emptyBarHeight, granularity, hovered]);

  return <EChart
    option={option}
    className={styles.root}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
  />;
}
