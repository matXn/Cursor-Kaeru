import type { ProviderInput } from "../../shared/api";
import { defaultCustomHeadersText } from "../../shared/utils/modelDefaults";
import { modelPresets, presetEndpoint, trimTrailingSlash, type ModelPreset } from "../../shared/utils/modelPresets";
import { Checkbox } from "../../shared/ui/Checkbox";
import { FormField, SecretTextInput, TextInput } from "../../shared/ui/FormControls";
import { Select } from "../../shared/ui/Select";
import { CursorPresetChips } from "./CursorPresetChips";
import { ToggleJsonField } from "./ToggleJsonField";
import styles from "./CursorSettings.module.scss";

export type ProviderDraft = {
  provider: ProviderInput;
  customHeadersText: string;
};

export const emptyProviderDraft = (sortOrder: number): ProviderDraft => ({
  provider: {
    sort_order: sortOrder,
    name: "",
    type: "openai",
    base_url: "",
    use_full_url: false,
    api_key: "",
    openai_endpoint: "/v1/responses",
    custom_headers_enabled: false,
    custom_headers: {},
  },
  customHeadersText: defaultCustomHeadersText,
});

// Protocol as one choice: Anthropic Messages, or OpenAI with its endpoint.
type Protocol = "anthropic" | "/v1/responses" | "/v1/chat/completions";

const protocolOf = (provider: ProviderInput): Protocol =>
  provider.type === "anthropic" ? "anthropic" : provider.openai_endpoint === "/v1/chat/completions" ? "/v1/chat/completions" : "/v1/responses";

/** Host of an address, used as the name when none is given. */
export function hostOf(url: string) {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return url.trim();
  }
}

// Where requests go and how they are authenticated; every model under it shares this.
export function ProviderEditor({ draft, onChange }: { draft: ProviderDraft; onChange: (draft: ProviderDraft) => void }) {
  const provider = draft.provider;
  const set = (patch: Partial<ProviderInput>) => onChange({ ...draft, provider: { ...provider, ...patch } });
  const setProtocol = (protocol: Protocol) => {
    const type = protocol === "anthropic" ? "anthropic" : "openai";
    // Switching protocol on a preset's address moves to that preset's endpoint for the
    // other protocol, so an Anthropic provider never keeps an OpenAI URL.
    const other = type === "anthropic" ? "openai" : "anthropic";
    const preset = currentPreset(provider.base_url, other);
    const endpoint = preset ? presetEndpoint(preset, type) : null;
    onChange({
      ...draft,
      provider: {
        ...provider,
        type,
        openai_endpoint: type === "openai" ? (endpoint?.useFullUrl ? endpoint.openaiEndpoint : protocol) : "",
        ...(endpoint ? {
          base_url: endpoint.baseUrl,
          use_full_url: endpoint.useFullUrl,
          custom_headers_enabled: endpoint.customHeaders !== null,
          custom_headers: endpoint.customHeaders ? { ...endpoint.customHeaders } : {},
        } : {}),
      },
      customHeadersText: endpoint?.customHeaders ? JSON.stringify(endpoint.customHeaders, null, 2) : draft.customHeadersText,
    });
  };
  const applyPreset = (preset: ModelPreset) => {
    const endpoint = presetEndpoint(preset, provider.type);
    // A different company's key never carries over; the same one's does.
    const sameProvider = [preset.endpoints.anthropic, preset.endpoints.openai]
      .some((candidate) => trimTrailingSlash(candidate.baseUrl) === trimTrailingSlash(provider.base_url.trim()));
    onChange({
      ...draft,
      provider: {
        ...provider,
        name: !provider.name.trim() || currentPreset(provider.base_url, provider.type) ? preset.name : provider.name,
        base_url: endpoint.baseUrl,
        use_full_url: endpoint.useFullUrl,
        openai_endpoint: provider.type === "openai" ? endpoint.openaiEndpoint : "",
        custom_headers_enabled: endpoint.customHeaders !== null,
        custom_headers: endpoint.customHeaders ? { ...endpoint.customHeaders } : {},
        api_key: sameProvider ? provider.api_key : "",
      },
      customHeadersText: endpoint.customHeaders ? JSON.stringify(endpoint.customHeaders, null, 2) : draft.customHeadersText,
    });
  };
  const placeholder = provider.use_full_url
    ? provider.type === "anthropic"
      ? "https://api.anthropic.com/v1/messages"
      : provider.openai_endpoint === "/v1/chat/completions"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.openai.com/v1/responses"
    : provider.type === "anthropic"
      ? "https://api.anthropic.com"
      : "https://api.openai.com";

  return <div className={styles.editor}>
    <CursorPresetChips type={provider.type} baseUrl={provider.base_url} onPick={applyPreset} />
    <div className={styles.grid}>
      <FormField label={t("名称")} hint={t("显示在模型页和 Cursor 模型选择器的徽章上；留空时使用服务器域名。")}>
        <TextInput placeholder={hostOf(provider.base_url) || t("例如：我的中转")} value={provider.name} onChange={(event) => set({ name: event.target.value })} />
      </FormField>
      <FormField label={t("请求协议")} hint={t("只决定请求与响应的格式，不会改变请求地址。")}>
        <Select ariaLabel={t("请求协议")} value={protocolOf(provider)} options={[
          { value: "anthropic", label: "Anthropic Messages" },
          { value: "/v1/responses", label: "OpenAI Responses" },
          { value: "/v1/chat/completions", label: "OpenAI Chat Completions" },
        ]} onChange={(value) => setProtocol(value as Protocol)} />
      </FormField>
      <div className={styles.urlField}>
        <FormField label={provider.use_full_url ? t("完整请求 URL") : t("服务器地址")} hint={provider.use_full_url ? t("系统会原样使用此地址，不追加或修改请求路径。") : t("系统会根据请求协议自动追加标准端点路径。")}>
          <TextInput placeholder={placeholder} value={provider.base_url} onChange={(event) => set({ base_url: event.target.value })} />
        </FormField>
        <Checkbox checked={provider.use_full_url} label={t("使用完整请求地址")} onChange={(use_full_url) => set({ use_full_url })} />
      </div>
      <FormField label="API Key" hint={t("访问模型服务所需的密钥，这个服务商下的所有模型共用。")}>
        <SecretTextInput placeholder="sk-xxxxxx" autoComplete="off" value={provider.api_key} onChange={(event) => set({ api_key: event.target.value })} />
      </FormField>
      <ToggleJsonField
        label={t("自定义 Headers")}
        enabled={provider.custom_headers_enabled}
        text={draft.customHeadersText}
        onEnabledChange={(custom_headers_enabled) => set({ custom_headers_enabled })}
        onTextChange={(customHeadersText) => onChange({ ...draft, customHeadersText })}
      />
    </div>
  </div>;
}

/** The preset whose endpoint for `type` is this address, if any. */
export function currentPreset(baseUrl: string, type: ProviderInput["type"]) {
  const base = trimTrailingSlash(baseUrl.trim());
  return modelPresets.find((preset) => trimTrailingSlash(presetEndpoint(preset, type).baseUrl) === base) ?? null;
}
