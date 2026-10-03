import { useRef } from "react";
import type { ModelInput, Provider } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { FormField, TextInput } from "../../shared/ui/FormControls";
import { Combobox, Select, type ComboboxHandle } from "../../shared/ui/Select";
import { providerMark } from "../../shared/ui/ProviderLogo";
import { ToggleJsonField } from "./ToggleJsonField";
import styles from "./CursorSettings.module.scss";

export type CursorModelDraft = {
  model: ModelInput;
  openAIExtraParamsText: string;
  anthropicExtraParamsText: string;
};

export const emptyCursorModelDraft = (providerId: string, sortOrder: number): CursorModelDraft => ({
  model: {
    sort_order: sortOrder,
    provider_id: providerId,
    display_name: "",
    tooltip_data: "",
    model_id: "",
    reasoning_effort: null,
    openai_extra_params_enabled: false,
    openai_extra_params: {},
    anthropic_extra_params_enabled: false,
    anthropic_extra_params: {},
    context_window_tokens: null,
    max_completion_tokens: null,
    anthropic_max_tokens: null,
    anthropic_thinking_effort: "xhigh",
    thinking_budget_tokens: null,
  },
  openAIExtraParamsText: "{}",
  anthropicExtraParamsText: "{}",
});

// One model under a provider: which upstream model to call, and how. The address and key
// come from the provider, so this only names and tunes the model.
export function CursorModelEditor({ draft, providers, modelOptions, discovering, onChange, onDiscover }: {
  draft: CursorModelDraft;
  providers: Provider[];
  modelOptions: string[];
  discovering: boolean;
  onChange: (draft: CursorModelDraft) => void;
  onDiscover: () => Promise<boolean>;
}) {
  const modelCombobox = useRef<ComboboxHandle>(null);
  const provider = providers.find((candidate) => candidate.provider_id === draft.model.provider_id);
  const setModel = (patch: Partial<ModelInput>) => onChange({ ...draft, model: { ...draft.model, ...patch } });
  const numberValue = (value: string) => value === "" ? null : Math.trunc(Number(value));
  const discoverModels = async () => {
    if (await onDiscover()) modelCombobox.current?.openAll();
  };
  const anthropic = provider?.type === "anthropic";

  return <div className={styles.editor}>
    <div className={styles.grid}>
      <FormField className={styles.fullWidth} label={t("服务商")} hint={t("地址、API Key 和请求协议都来自服务商。")}>
        <Select
          ariaLabel={t("服务商")}
          value={draft.model.provider_id}
          options={providers.map((candidate) => ({ value: candidate.provider_id, label: candidate.name, icon: providerMark(candidate.name, candidate.base_url) }))}
          onChange={(provider_id) => setModel({ provider_id })}
        />
      </FormField>
      <FormField label={t("模型名称")} hint={t("可以直接输入模型标识，也可以读取接口返回的模型列表。")}><Combobox ref={modelCombobox} value={draft.model.model_id} options={modelOptions} placeholder="gpt-5" append={<Button className={styles.discoverButton} disabled={discovering || !provider} onClick={() => void discoverModels()}>{discovering ? t("获取中…") : t("获取模型")}</Button>} onChange={(model_id) => setModel({ model_id, display_name: draft.model.display_name || model_id })} /></FormField>
      <FormField label={t("显示名称")} hint={t("仅用于界面展示，不会改变发送给模型服务的模型名称。")}> <TextInput placeholder={t("例如：主力模型")} value={draft.model.display_name} onChange={(event) => setModel({ display_name: event.target.value })} /></FormField>
      <FormField className={styles.fullWidth} label={t("备注")} hint={t("显示在 Cursor 模型说明中。")}> <TextInput placeholder={t("请输入模型备注")} value={draft.model.tooltip_data} onChange={(event) => setModel({ tooltip_data: event.target.value })} /></FormField>

      <FormField label={t("上下文窗口 Token")} hint={t("留空时使用默认值。")}> <TextInput type="number" min={1} step={1} placeholder={t("留空使用默认值")} value={draft.model.context_window_tokens ?? ""} onChange={(event) => setModel({ context_window_tokens: numberValue(event.target.value) })} /></FormField>
      {!anthropic ? <>
        <FormField label={t("最大输出 Token")} hint={t("留空时使用默认值。")}> <TextInput type="number" min={1} step={1} placeholder={t("留空使用默认值")} value={draft.model.max_completion_tokens ?? ""} onChange={(event) => setModel({ max_completion_tokens: numberValue(event.target.value) })} /></FormField>
        <FormField label={t("推理强度")}> <Select ariaLabel={t("推理强度")} value={draft.model.reasoning_effort ?? ""} options={effortOptions(true)} onChange={(value) => setModel({ reasoning_effort: value || null })} /></FormField>
      </> : <>
        <FormField label={t("最大输出 Token")} hint={t("留空时使用默认值。")}> <TextInput type="number" min={1} step={1} placeholder={t("留空使用默认值")} value={draft.model.anthropic_max_tokens ?? ""} onChange={(event) => setModel({ anthropic_max_tokens: numberValue(event.target.value) })} /></FormField>
        <FormField label={t("思考强度")}> <Select ariaLabel={t("思考强度")} value={draft.model.anthropic_thinking_effort ?? "xhigh"} options={effortOptions(false)} onChange={(anthropic_thinking_effort) => setModel({ anthropic_thinking_effort })} /></FormField>
        <FormField label={t("思考预算 Token")} hint={t("留空时使用 adaptive thinking。")}> <TextInput type="number" min={1} step={1} placeholder={t("留空使用 adaptive thinking")} value={draft.model.thinking_budget_tokens ?? ""} onChange={(event) => setModel({ thinking_budget_tokens: numberValue(event.target.value) })} /></FormField>
      </>}

      {!anthropic ? <ToggleJsonField
        label={t("OpenAI 额外参数")}
        enabled={draft.model.openai_extra_params_enabled}
        text={draft.openAIExtraParamsText}
        onEnabledChange={(openai_extra_params_enabled) => setModel({ openai_extra_params_enabled })}
        onTextChange={(openAIExtraParamsText) => onChange({ ...draft, openAIExtraParamsText })}
      /> : <ToggleJsonField
        label={t("Anthropic 额外参数")}
        enabled={draft.model.anthropic_extra_params_enabled}
        text={draft.anthropicExtraParamsText}
        onEnabledChange={(anthropic_extra_params_enabled) => setModel({ anthropic_extra_params_enabled })}
        onTextChange={(anthropicExtraParamsText) => onChange({ ...draft, anthropicExtraParamsText })}
      />}
    </div>
  </div>;
}

function effortOptions(optional: boolean) {
  return [
    ...(optional ? [{ value: "", label: t("不设置") }] : []),
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "Extra High" },
    { value: "max", label: "Max" },
  ];
}
