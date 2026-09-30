import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTimeInput } from "../../../shared/utils/parseTimeInput";
import controls from "../../../shared/ui/Controls.module.scss";
import { Icon } from "../../../shared/ui/Icon";
import { ModelSelect, type ModelSelectOption } from "../../../shared/ui/ModelSelect";
import { TooltipTrigger } from "../../../shared/ui/TooltipTrigger";
import { chevronDownIcon, refreshIcon } from "../../../shared/ui/icons";
import styles from "./OverviewTimeRangeFilter.module.scss";

export type OverviewRangePreset = "ten-minutes" | "hour" | "four-hours" | "twenty-four-hours" | "today" | "week" | "month" | "custom";

export function presetLabel(preset: Exclude<OverviewRangePreset, "custom">) {
  return {
    "ten-minutes": t("近 10 分钟"),
    hour: t("近 1 小时"),
    "four-hours": t("近 4 小时"),
    "twenty-four-hours": t("近 24 小时"),
    today: t("今天"),
    week: t("近 7 天"),
    month: t("近 30 天"),
  }[preset];
}

// Ordered by duration so the list reads top-to-bottom.
const presets: Array<Exclude<OverviewRangePreset, "custom">> = ["ten-minutes", "hour", "four-hours", "twenty-four-hours", "today", "week", "month"];

// One trigger showing the active range; presets, custom range and model filter live in its popover.
export function OverviewTimeRangeFilter({ value, customLabel, customStart, customEnd, modelOptions, selectedModels, busy, onSelect, onCustomStartChange, onCustomEndChange, onSelectedModelsChange, onCustomApply, onRefresh }: {
  value: OverviewRangePreset;
  customLabel: string;
  customStart: string;
  customEnd: string;
  modelOptions: ModelSelectOption[];
  selectedModels: string[];
  busy: boolean;
  onSelect: (value: Exclude<OverviewRangePreset, "custom">) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onSelectedModelsChange: (value: string[]) => void;
  onCustomApply: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !trigger.current || !popover.current) return;
    return autoUpdate(trigger.current, popover.current, () => void computePosition(trigger.current!, popover.current!, {
      placement: "bottom-start",
      middleware: [offset(4), flip({ padding: 10 }), shift({ padding: 10 })],
    }).then(({ x, y }) => setPosition({ left: x, top: y })));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popover.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const parsedStart = parseTimeInput(customStart);
  const parsedEnd = parseTimeInput(customEnd);
  const customValid = parsedStart !== null && parsedEnd !== null && parsedStart < parsedEnd;
  const filtered = selectedModels.length > 0;

  return <div className={styles.root} aria-label={t("概览时间范围")}>
    <button
      ref={trigger}
      type="button"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-controls={open ? popoverId : undefined}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {value === "custom" ? customLabel : presetLabel(value)}
      {filtered && <span className={styles.badge}>{t("{count} 个模型", { count: selectedModels.length })}</span>}
      <Icon icon={chevronDownIcon} size="1em" />
    </button>
    <TooltipTrigger label={t("刷新")}><button className={controls.iconButton} aria-label={t("刷新")} disabled={busy} onClick={onRefresh}>
      <Icon className={busy ? controls.spin : ""} icon={refreshIcon} size="1em" />
    </button></TooltipTrigger>
    {open && createPortal(<div
      id={popoverId}
      ref={popover}
      className={styles.popover}
      role="dialog"
      aria-label={t("自定义概览筛选")}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className={styles.presets} role="listbox" aria-label={t("时间范围")}>
        {presets.map((preset) => <button
          key={preset}
          type="button"
          role="option"
          aria-selected={value === preset}
          onClick={() => { onSelect(preset); setOpen(false); }}
        >{presetLabel(preset)}</button>)}
      </div>
      <div className={styles.custom}>
        <label><span>{t("开始时间")}</span><input type="text" placeholder={t("如：2026-08-23 09:00、1小时前")} value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} /></label>
        <label><span>{t("结束时间")}</span><input type="text" placeholder={t("如：现在、2026-08-23 18:00")} value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} /></label>
        <ModelSelect mode="multiple" label={t("模型")} value={selectedModels} options={modelOptions} onChange={onSelectedModelsChange} />
        <div className={styles.actions}>
          <button type="button" className={controls.primary} disabled={!customValid} onClick={() => { onCustomApply(); setOpen(false); }}>{t("应用")}</button>
        </div>
      </div>
    </div>, document.body)}
  </div>;
}
