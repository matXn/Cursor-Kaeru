import { useEffect, useState } from "react";
import { api, type ProxySettings, type ProxySettingsInput, type StatisticsStorage, type StatisticsStorageScope, type TabSettings } from "../../shared/api";
import { PageContent } from "../../shell/layout/PageContent";
import { PageTitle } from "../../shell/layout/PageTitle";
import { settingsGlyph } from "../../shared/ui/glyphs";
import { LegacyModelImport } from "../models/LegacyModelImport";
import { AppLifecycleSettingsCard } from "./AppLifecycleSettingsCard";
import { CommitSettingsCard } from "./CommitSettingsCard";
import { ExternalApiSettingsCard, parsePort } from "./ExternalApiSettingsCard";
import { ProjectFooter } from "./ProjectFooter";
import { ProxySettingsCard } from "./ProxySettingsCard";
import { TabSettingsCard } from "./TabSettingsCard";
import { Button } from "../../shared/ui/Button";
import { Checkbox } from "../../shared/ui/Checkbox";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Select } from "../../shared/ui/Select";
import { TitledCard } from "../../shared/ui/TitledCard";
import { setLocalePreference, useI18n, type LocalePreference } from "../../i18n/store";
import { useMessage } from "../../shared/ui/message";
import { appStore, useAppStore } from "../../shared/store/appStore";
import { themeOptions } from "../../shared/theme/theme";
import styles from "./SettingsPage.module.scss";

export function SettingsPage() {
  const { detailed, ports, theme } = useAppStore();
  const { preference, locale } = useI18n();
  const message = useMessage();
  const [storage, setStorage] = useState<StatisticsStorage | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearScope, setClearScope] = useState<StatisticsStorageScope>("details");
  const [clearing, setClearing] = useState(false);
  const [outboundProxy, setOutboundProxy] = useState<ProxySettings | null>(null);
  const [proxyDraft, setProxyDraft] = useState<ProxySettingsInput>({ mode: "default", address: "", auth_enabled: false, username: "", password: "" });
  const [editingProxy, setEditingProxy] = useState(false);
  const [proxyPortDraft, setProxyPortDraft] = useState(String(ports.proxy_port));
  const [savingProxy, setSavingProxy] = useState(false);
  const [tabSettings, setTabSettings] = useState<TabSettings | null>(null);
  const [tabDraft, setTabDraft] = useState<TabSettings>({ mode: "public", address: "" });
  const [editingTab, setEditingTab] = useState(false);
  const [savingTab, setSavingTab] = useState(false);
  useEffect(() => {
    const report = (cause: unknown) => message(cause instanceof Error ? cause.message : String(cause));
    void api.statisticsStorage().then(setStorage).catch(report);
    void api.proxySettings().then((next) => {
      setOutboundProxy(next);
      setProxyDraft({ mode: next.mode, address: next.address, auth_enabled: next.auth_enabled, username: next.username, password: "" });
    }).catch(report);
    void api.tabSettings().then((next) => {
      setTabSettings(next);
      setTabDraft(next);
    }).catch(report);
  }, [message]);
  const clearStorage = async () => {
    try {
      setClearing(true);
      setStorage(await api.clearStatisticsStorage(clearScope));
      setConfirmClear(false);
      await appStore.refresh();
      message(clearScope === "all" ? t("全部统计数据已清理") : t("详细记录已清理"));
    } catch (cause) {
      message(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setClearing(false);
    }
  };
  const editProxy = () => {
    if (!outboundProxy) return;
    setProxyDraft({ mode: outboundProxy.mode, address: outboundProxy.address, auth_enabled: outboundProxy.auth_enabled, username: outboundProxy.username, password: "" });
    setProxyPortDraft(String(ports.proxy_port));
    setEditingProxy(true);
  };
  const cancelProxyEdit = () => {
    if (outboundProxy) {
      setProxyDraft({ mode: outboundProxy.mode, address: outboundProxy.address, auth_enabled: outboundProxy.auth_enabled, username: outboundProxy.username, password: "" });
    }
    setEditingProxy(false);
  };
  const saveProxy = async () => {
    try {
      const proxyPort = parsePort(proxyPortDraft, t("Cursor 代理端口"));
      setSavingProxy(true);
      const saved = await api.setProxySettings({ ...proxyDraft, password: proxyDraft.password || undefined });
      const portChanged = proxyPort !== ports.proxy_port;
      if (portChanged && !(await appStore.updatePorts({ ...ports, proxy_port: proxyPort }))) return;
      setOutboundProxy(saved);
      setProxyDraft({ mode: saved.mode, address: saved.address, auth_enabled: saved.auth_enabled, username: saved.username, password: "" });
      setEditingProxy(false);
      message(portChanged ? t("已保存，端口在重启软件后生效") : t("代理设置已保存"), { duration: portChanged ? 4_000 : undefined });
    } catch (cause) {
      message(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingProxy(false);
    }
  };
  const editTab = () => {
    if (!tabSettings) return;
    setTabDraft(tabSettings);
    setEditingTab(true);
  };
  const cancelTabEdit = () => {
    if (tabSettings) setTabDraft(tabSettings);
    setEditingTab(false);
  };
  const saveTab = async () => {
    try {
      if (tabDraft.mode === "custom" && !tabDraft.address.trim()) throw new Error(t("补全服务地址不能为空"));
      setSavingTab(true);
      const saved = await api.setTabSettings({ ...tabDraft, address: tabDraft.address.trim() });
      setTabSettings(saved);
      setTabDraft(saved);
      setEditingTab(false);
      message(t("Tab 补全设置已保存"));
    } catch (cause) {
      message(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSavingTab(false);
    }
  };
  const clearTitle = clearScope === "all" ? t("确定要清理全部统计数据吗？") : t("确定要清理详细记录吗？");
  const clearDescription = clearScope === "all"
    ? t("所有调用汇总、详细内容和追踪记录都会被删除。模型配置、CA 和应用设置不会受到影响，此操作无法撤销。")
    : t("仅删除请求、响应和追踪附件等详细内容，保留调用汇总、统计指标和配置。");
  const content = (
    <div className={styles.page}>
      <TitledCard title={t("调用观测")}>
        <div className={styles.settingRow}>
          <div>
            <strong>{t("详细模式")}</strong>
            <small>
              {t("额外保存完整请求和流响应；默认只保存时间、状态与用量。")}
            </small>
          </div>
          <Checkbox
            label={t("详细模式")}
            checked={detailed}
            onChange={(checked) => void appStore.updateDetailed(checked)}
          />
        </div>
      </TitledCard>
      <ExternalApiSettingsCard ports={ports} />
      <ProxySettingsCard settings={outboundProxy} draft={proxyDraft} proxyPort={ports.proxy_port} proxyPortDraft={proxyPortDraft} onProxyPortChange={setProxyPortDraft} editing={editingProxy} saving={savingProxy} onDraftChange={setProxyDraft} onEdit={editProxy} onCancel={cancelProxyEdit} onSave={() => void saveProxy()} />
      <TabSettingsCard settings={tabSettings} draft={tabDraft} editing={editingTab} saving={savingTab} onDraftChange={setTabDraft} onEdit={editTab} onCancel={cancelTabEdit} onSave={() => void saveTab()} />
      <CommitSettingsCard />
      <AppLifecycleSettingsCard />
      <LegacyModelImport>{({ busy, previewing, open }) => <TitledCard title={t("导入")}>
        <div className={styles.importRow}>
          <div>
            <strong>{t("旧版配置")}</strong>
            <small>{t("从本机旧版配置读取模型；确认前会显示新增和已存在的模型。")}</small>
          </div>
          <Button size="small" disabled={busy} onClick={open}>
            {previewing ? t("读取中…") : t("查看并导入")}
          </Button>
        </div>
      </TitledCard>}</LegacyModelImport>
      <TitledCard title={t("语言")}>
        <div className={styles.settingRow}>
          <div>
            <strong>{t("界面语言")}</strong>
            <small>{t("默认跟随操作系统；不支持的系统语言使用英文。当前：{language}", { language: locale === "zh-CN" ? "简体中文" : "English" })}</small>
          </div>
          <div className={styles.languageControl}>
            <Select
              value={preference}
              ariaLabel={t("界面语言")}
              options={[
                { value: "system", label: t("跟随系统") },
                { value: "zh-CN", label: "简体中文" },
                { value: "en-US", label: "English" },
              ]}
              onChange={(value) => setLocalePreference(value as LocalePreference)}
            />
          </div>
        </div>
      </TitledCard>
      <TitledCard title={t("主题")}>
        <div className={styles.themeActions}>
          {themeOptions.map(({ id }) => (
            <button
              className={theme === id ? styles.selected : ""}
              key={id}
              onClick={() => appStore.selectTheme(id)}
            >
              {id === "default-dark" ? t("默认暗色") : t("默认亮色")}
            </button>
          ))}
        </div>
      </TitledCard>
      <TitledCard title={t("存储管理")}>
        <div className={styles.storageRow}>
          <div>
            <strong>{t("统计数据")}</strong>
            <small>{storage ? t("调用记录 {calls} 条 · 追踪记录 {traces} 条", { calls: storage.call_count, traces: storage.trace_count }) : t("计算中…")}</small>
          </div>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => { setClearScope("details"); setConfirmClear(true); }}
          >
            {t("清理存储空间")}
          </button>
        </div>
      </TitledCard>
      <ProjectFooter />
      <ConfirmDialog
        open={confirmClear}
        title={clearTitle}
        busy={clearing}
        cancelLabel={t("取消")}
        confirmLabel={t("确认清理")}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void clearStorage()}
      >
        <div className={styles.confirmContent}>
          <Select
            value={clearScope}
            ariaLabel={t("清理范围")}
            options={[
              { value: "details", label: t("仅清理详细记录") },
              { value: "all", label: t("清理全部统计数据") },
            ]}
            onChange={(value) => setClearScope(value as StatisticsStorageScope)}
          />
          <small>{clearDescription}</small>
        </div>
      </ConfirmDialog>
    </div>
  );
  return <PageContent title={<PageTitle glyph={settingsGlyph} name="Settings" />} sections={[{ key: "settings", estimatedHeight: 1200, content }]} />;
}
