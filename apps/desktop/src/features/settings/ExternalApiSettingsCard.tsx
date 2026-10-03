import { useEffect, useState } from "react";
import { api, type ExternalApiSettings, type PortSettings } from "../../shared/api";
import { appStore } from "../../shared/store/appStore";
import { Button } from "../../shared/ui/Button";
import { FieldAction, FormField, SecretTextInput, TextInput } from "../../shared/ui/FormControls";
import { copyIcon, shuffleIcon } from "../../shared/ui/icons";
import { Switch } from "../../shared/ui/Switch";
import { TitledCard } from "../../shared/ui/TitledCard";
import { useMessage } from "../../shared/ui/message";
import styles from "./ExternalApiSettingsCard.module.scss";

type PortDraft = { proxy_port: string; service_port: string };

const portDraft = (ports: PortSettings): PortDraft => ({ proxy_port: String(ports.proxy_port), service_port: String(ports.service_port) });

// The local service as other apps reach it: the external API, and the ports it and the Cursor
// proxy listen on. One save covers both; ports take effect after a restart.
export function ExternalApiSettingsCard({ ports }: { ports: PortSettings }) {
  const message = useMessage();
  const [saved, setSaved] = useState<ExternalApiSettings | null>(null);
  const [draft, setDraft] = useState<ExternalApiSettings>({ enabled: false, api_key: "" });
  const [portsDraft, setPortsDraft] = useState<PortDraft>(portDraft(ports));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.externalApiSettings().then((settings) => {
      setSaved(settings);
      setDraft(settings);
    }).catch((cause: unknown) => message(cause instanceof Error ? cause.message : String(cause)));
  }, [message]);
  useEffect(() => setPortsDraft(portDraft(ports)), [ports]);

  const apiChanged = saved !== null && (saved.enabled !== draft.enabled || saved.api_key !== draft.api_key);
  const portsChanged = portsDraft.proxy_port !== String(ports.proxy_port) || portsDraft.service_port !== String(ports.service_port);

  const save = async () => {
    try {
      const nextPorts = portsChanged ? {
        proxy_port: parsePort(portsDraft.proxy_port, t("代理端口")),
        service_port: parsePort(portsDraft.service_port, t("服务端口")),
      } : null;
      setSaving(true);
      if (apiChanged) {
        const settings = await api.setExternalApiSettings(draft);
        setSaved(settings);
        setDraft(settings);
      }
      if (nextPorts && !(await appStore.updatePorts(nextPorts))) return;
      message(nextPorts ? t("已保存，端口在重启软件后生效") : t("外部 API 设置已保存"), { duration: nextPorts ? 4_000 : undefined });
    } catch (cause) {
      message(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const generateKey = () => setDraft((current) => ({ ...current, api_key: randomKey() }));
  const copyKey = async () => {
    await navigator.clipboard.writeText(draft.api_key);
    message(t("已复制密钥"));
  };

  return <TitledCard title={t("外部 API 与端口")} action={apiChanged || portsChanged ? <Button size="small" variant="primary" disabled={saving} onClick={() => void save()}>
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
      <div className={styles.ports}>
        <FormField label={t("服务端口")} hint={t("外部 API 和桌面界面连接的本地服务端口。")}>
          <TextInput type="number" min={0} max={65535} step={1} disabled={saving} value={portsDraft.service_port}
            onChange={(event) => setPortsDraft((current) => ({ ...current, service_port: event.target.value }))} />
        </FormField>
        <FormField label={t("代理端口")} hint={t("接管时 Cursor 使用的本地代理端口。")}>
          <TextInput type="number" min={0} max={65535} step={1} disabled={saving} value={portsDraft.proxy_port}
            onChange={(event) => setPortsDraft((current) => ({ ...current, proxy_port: event.target.value }))} />
        </FormField>
      </div>
      <div className={styles.address}>
        <strong>{t("基础地址")}</strong>
        <code>{`http://127.0.0.1:${ports.service_port}/kaeru/v1`}</code>
        <small>{t("修改端口后需要重启软件；端口被占用时会自动换成随机端口并保存。")}</small>
      </div>
    </div>
  </TitledCard>;
}

function parsePort(value: string, label: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error(`${label}${t("必须是 0–65535 之间的整数")}`);
  return port;
}

/** 32 random bytes as hex, prefixed so the key says what it is for. */
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `kaeru-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
