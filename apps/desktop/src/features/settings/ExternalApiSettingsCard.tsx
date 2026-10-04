import { useEffect, useState } from "react";
import { api, type ExternalApiSettings, type PortSettings } from "../../shared/api";
import { appStore } from "../../shared/store/appStore";
import { FieldAction, FormField, SecretTextInput, TextInput } from "../../shared/ui/FormControls";
import { copyIcon, shuffleIcon } from "../../shared/ui/icons";
import { Switch } from "../../shared/ui/Switch";
import { TitledCard } from "../../shared/ui/TitledCard";
import { useMessage } from "../../shared/ui/message";
import styles from "./ExternalApiSettingsCard.module.scss";

// The local service as other apps reach it: the external API and the port it listens on.
// Everything saves as it changes: the switch at once, typed values when the field is left;
// the port takes effect after a restart.
export function ExternalApiSettingsCard({ ports }: { ports: PortSettings }) {
  const message = useMessage();
  const [saved, setSaved] = useState<ExternalApiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [servicePort, setServicePort] = useState(String(ports.service_port));
  const [saving, setSaving] = useState(false);
  const report = (cause: unknown) => message(cause instanceof Error ? cause.message : String(cause));

  useEffect(() => {
    void api.externalApiSettings().then((settings) => {
      setSaved(settings);
      setApiKey(settings.api_key);
    }).catch(report);
  }, [message]);
  useEffect(() => setServicePort(String(ports.service_port)), [ports.service_port]);

  const save = async (next: ExternalApiSettings) => {
    if (!saved || (next.enabled === saved.enabled && next.api_key === saved.api_key)) return;
    setSaving(true);
    try {
      const settings = await api.setExternalApiSettings(next);
      setSaved(settings);
      setApiKey(settings.api_key);
    } catch (cause) {
      setApiKey(saved.api_key);
      report(cause);
    } finally {
      setSaving(false);
    }
  };
  // Switching on without a key makes one, since the API never runs open.
  const toggle = (enabled: boolean) => {
    const key = enabled && !apiKey.trim() ? randomKey() : apiKey;
    setApiKey(key);
    void save({ enabled, api_key: key });
  };
  const generateKey = () => {
    const key = randomKey();
    setApiKey(key);
    void save({ enabled: saved?.enabled ?? false, api_key: key });
  };
  const copyKey = async () => {
    await navigator.clipboard.writeText(apiKey);
    message(t("已复制密钥"));
  };
  const savePort = async () => {
    if (servicePort === String(ports.service_port)) return;
    try {
      const port = parsePort(servicePort, t("服务端口"));
      if (await appStore.updatePorts({ ...ports, service_port: port })) {
        message(t("已保存，端口在重启软件后生效"), { duration: 4_000 });
      }
    } catch (cause) {
      setServicePort(String(ports.service_port));
      report(cause);
    }
  };

  return <TitledCard title={t("外部 API")}>
    <div className={styles.content}>
      <div className={styles.row}>
        <div className={styles.description}>
          <strong>{t("开启外部 API")}</strong>
          <small>{t("允许本机应用使用密钥调用已配置的模型，包括插件模型。")}</small>
        </div>
        <Switch label={t("开启外部 API")} checked={saved?.enabled ?? false} disabled={!saved || saving} onChange={toggle} />
      </div>
      <FormField label={t("API 密钥")} hint={t("开启后，所有外部请求都必须提供此密钥。")}>
        <SecretTextInput value={apiKey} autoComplete="off" disabled={!saved || saving}
          onChange={(event) => setApiKey(event.target.value)}
          onBlur={() => void save({ enabled: saved?.enabled ?? false, api_key: apiKey })}
          actions={<>
            <FieldAction label={t("生成随机密钥")} icon={shuffleIcon} disabled={!saved || saving} onClick={generateKey} />
            <FieldAction label={t("复制密钥")} icon={copyIcon} disabled={!apiKey} onClick={() => void copyKey()} />
          </>} />
      </FormField>
      <FormField label={t("服务端口")} hint={t("外部 API 和桌面界面连接的本地服务端口。")}>
        <TextInput type="number" min={0} max={65535} step={1} value={servicePort}
          onChange={(event) => setServicePort(event.target.value)}
          onBlur={() => void savePort()}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      </FormField>
      <div className={styles.address}>
        <strong>{t("基础地址")}</strong>
        <code>{`http://127.0.0.1:${ports.service_port}/kaeru/v1`}</code>
        <small>{t("修改端口后需要重启软件；端口被占用时会自动换成随机端口并保存。")}</small>
      </div>
    </div>
  </TitledCard>;
}

export function parsePort(value: string, label: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error(`${label}${t("必须是 0–65535 之间的整数")}`);
  return port;
}

/** 32 random bytes as hex, prefixed so the key says what it is for. */
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `kaeru-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
