import { useEffect, useState } from "react";
import { api, type ExternalApiSettings } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { FieldAction, FormField, SecretTextInput } from "../../shared/ui/FormControls";
import { copyIcon, shuffleIcon } from "../../shared/ui/icons";
import { Switch } from "../../shared/ui/Switch";
import { TitledCard } from "../../shared/ui/TitledCard";
import { useMessage } from "../../shared/ui/message";
import styles from "./ExternalApiSettingsCard.module.scss";

export function ExternalApiSettingsCard({ servicePort }: { servicePort: number }) {
  const message = useMessage();
  const [saved, setSaved] = useState<ExternalApiSettings | null>(null);
  const [draft, setDraft] = useState<ExternalApiSettings>({ enabled: false, api_key: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.externalApiSettings().then((settings) => {
      setSaved(settings);
      setDraft(settings);
    }).catch((cause: unknown) => message(cause instanceof Error ? cause.message : String(cause)));
  }, [message]);

  const save = async () => {
    try {
      setSaving(true);
      const settings = await api.setExternalApiSettings(draft);
      setSaved(settings);
      setDraft(settings);
      message(t("外部 API 设置已保存"));
    } catch (cause) {
      message(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const address = `http://127.0.0.1:${servicePort}/kaeru/v1`;
  const generateKey = () => setDraft((current) => ({ ...current, api_key: randomKey() }));
  const copyKey = async () => {
    await navigator.clipboard.writeText(draft.api_key);
    message(t("已复制密钥"));
  };
  const changed = saved && (saved.enabled !== draft.enabled || saved.api_key !== draft.api_key);

  return <TitledCard title={t("外部 API")} action={changed ? <Button size="small" variant="primary" disabled={saving} onClick={() => void save()}>
    {saving ? t("保存中…") : t("保存")}
  </Button> : undefined}>
    <div className={styles.content}>
      <div className={styles.row}>
        <div className={styles.description}>
          <strong>{t("开启外部 API")}</strong>
          <small>{t("允许本机应用使用密钥调用已配置的模型，包括插件模型。")}</small>
        </div>
        <Switch label={t("开启外部 API")} checked={draft.enabled} disabled={!saved || saving}
          onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} />
      </div>
      <FormField label={t("API 密钥")} hint={t("开启后，所有外部请求都必须提供此密钥。")}> 
        <SecretTextInput value={draft.api_key} autoComplete="off" disabled={!saved || saving}
          onChange={(event) => setDraft((current) => ({ ...current, api_key: event.target.value }))}
          actions={<>
            <FieldAction label={t("生成随机密钥")} icon={shuffleIcon} disabled={!saved || saving} onClick={generateKey} />
            <FieldAction label={t("复制密钥")} icon={copyIcon} disabled={!draft.api_key} onClick={() => void copyKey()} />
          </>} />
      </FormField>
      <div className={styles.address}>
        <strong>{t("基础地址")}</strong>
        <code>{address}</code>
        <small>{t("端口即服务端口，在上方「端口设置」中修改")}</small>
      </div>
    </div>
  </TitledCard>;
}

/** 32 random bytes as hex, prefixed so the key says what it is for. */
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `kaeru-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
