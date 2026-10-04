import type { ProxySettings, ProxySettingsInput } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { Checkbox } from "../../shared/ui/Checkbox";
import { TextInput } from "../../shared/ui/FormControls";
import { Select } from "../../shared/ui/Select";
import { TitledCard } from "../../shared/ui/TitledCard";
import styles from "./ProxySettingsCard.module.scss";

export function ProxySettingsCard({
  settings,
  draft,
  proxyPort,
  proxyPortDraft,
  editing,
  saving,
  onDraftChange,
  onProxyPortChange,
  onEdit,
  onCancel,
  onSave,
}: {
  settings: ProxySettings | null;
  draft: ProxySettingsInput;
  proxyPort: number;
  proxyPortDraft: string;
  editing: boolean;
  saving: boolean;
  onDraftChange: (draft: ProxySettingsInput) => void;
  onProxyPortChange: (port: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const custom = draft.mode === "custom";
  const modeLabel = (mode: ProxySettingsInput["mode"]) => mode === "default" ? t("默认") : t("自定义");
  const action = editing ? (
    <div className={styles.actionGroup}>
      <Button size="small" disabled={saving} onClick={onCancel}>{t("取消")}</Button>
      <Button variant="primary" size="small" disabled={saving} onClick={onSave}>{saving ? t("保存中…") : t("保存")}</Button>
    </div>
  ) : (
    <button type="button" className={styles.headerAction} disabled={!settings} onClick={onEdit}>
      {t("编辑")}
    </button>
  );

  return <TitledCard title={t("代理设置")} action={action}>
    <div className={styles.content}>
      <small className={styles.note}>{t("Cursor 代理端口：接管时 Cursor 的请求先发到这里，修改后重启软件生效。代理方式：Kaeru 访问模型服务和 Cursor 官方时走的网络代理。")}</small>
      {editing ? <>
        <div className={styles.row}>
          <strong>{t("Cursor 代理端口")}</strong>
          <div className={styles.control}><TextInput type="number" min={0} max={65535} step={1} value={proxyPortDraft} onChange={(event) => onProxyPortChange(event.target.value)} /></div>
        </div>
        <div className={styles.row}>
          <strong>{t("代理方式")}</strong>
          <div className={styles.control}><Select ariaLabel={t("代理方式")} value={draft.mode} options={[{ value: "default", label: t("默认") }, { value: "custom", label: t("自定义") }]} onChange={(mode) => onDraftChange({ ...draft, mode: mode as ProxySettingsInput["mode"] })} /></div>
        </div>
        {custom && <div className={styles.customFields}>
          <div className={styles.row}>
            <strong>{t("代理地址")}</strong>
            <div className={styles.control}><TextInput value={draft.address} placeholder="http://127.0.0.1:7890" onChange={(event) => onDraftChange({ ...draft, address: event.target.value })} /></div>
          </div>
          <div className={styles.row}>
            <strong>{t("认证")}</strong>
            <Checkbox checked={draft.auth_enabled} label={t("代理需要认证")} onChange={(auth_enabled) => onDraftChange({ ...draft, auth_enabled })} />
          </div>
          {draft.auth_enabled && <div className={styles.customFields}>
            <div className={styles.row}>
              <strong>{t("用户名")}</strong>
              <div className={styles.control}><TextInput value={draft.username} autoComplete="off" onChange={(event) => onDraftChange({ ...draft, username: event.target.value })} /></div>
            </div>
            <div className={styles.row}>
              <strong>{t("密码")}</strong>
              <div className={styles.control}><TextInput type="password" value={draft.password ?? ""} autoComplete="new-password" placeholder={settings?.has_password ? t("留空表示保留当前密码") : ""} onChange={(event) => onDraftChange({ ...draft, password: event.target.value })} /></div>
            </div>
          </div>}
        </div>}
      </> : <>
        <div className={styles.row}><strong>{t("Cursor 代理端口")}</strong><span className={styles.value}>{proxyPort}</span></div>
        <div className={styles.row}><strong>{t("代理方式")}</strong><span className={styles.value}>{settings ? modeLabel(settings.mode) : t("加载中…")}</span></div>
        {settings?.mode === "custom" && <div className={styles.customFields}>
          <div className={styles.row}><strong>{t("代理地址")}</strong><span className={styles.value}>{settings.address}</span></div>
          <div className={styles.row}><strong>{t("认证")}</strong><span className={styles.value}>{settings.auth_enabled ? t("已启用") : t("未启用")}</span></div>
          {settings.auth_enabled && <>
            <div className={styles.row}><strong>{t("用户名")}</strong><span className={styles.value}>{settings.username || "—"}</span></div>
            <div className={styles.row}><strong>{t("密码")}</strong><span className={styles.value}>{settings.has_password ? t("已设置") : t("未设置")}</span></div>
          </>}
        </div>}
      </>}
    </div>
  </TitledCard>;
}
