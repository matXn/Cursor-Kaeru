import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, configuredPluginModels, modelInput, type Model, type ModelInput, type Provider, type ProviderInput } from "../../shared/api";
import { CursorCaGate, CursorCaProvider, CursorModelGate, CursorModelProvider } from "./CursorGates";
import { CursorModelEditor, emptyCursorModelDraft, type CursorModelDraft } from "./CursorModelEditor";
import { CursorModelTestResult, type CursorModelTestState } from "./CursorModelTestResult";
import { ModelPicker } from "./ModelPicker";
import { currentPreset, emptyProviderDraft, hostOf, ProviderEditor, type ProviderDraft } from "./ProviderEditor";
import { ProviderTable } from "./ProviderTable";
import styles from "./CursorSettings.module.scss";
import page from "./CursorSettingsPage.module.scss";
import { Cell, Grid, GridGuides, Rule } from "../../shell/layout/Grid";
import { PageContent } from "../../shell/layout/PageContent";
import { LegacyModelImport } from "./LegacyModelImport";
import { ActionMenu } from "../../shared/ui/ActionMenu";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import controls from "../../shared/ui/Controls.module.scss";
import { Icon } from "../../shared/ui/Icon";
import { Modal } from "../../shared/ui/Modal";
import { TooltipTrigger } from "../../shared/ui/TooltipTrigger";
import { refreshIcon } from "../../shared/ui/icons";
import { useMessage } from "../../shared/ui/message";
import { appStore, useAppStore } from "../../shared/store/appStore";

type Picking = { provider: Provider; options: string[]; loading: boolean };

// Models, one section per provider. Providers hold the address and key; models only say
// which upstream model to call and how.
export function CursorSettingsPage() {
  const { providers, models, cursorHarness, cursorBusy, busy, plugins } = useAppStore();
  const navigate = useNavigate();
  const message = useMessage();
  const [providerDraft, setProviderDraft] = useState<ProviderDraft | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [draft, setDraft] = useState<CursorModelDraft | null>(null);
  const [editing, setEditing] = useState<Model | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [caCommand, setCaCommand] = useState<string | null>(null);
  const [waitingForCaRefresh, setWaitingForCaRefresh] = useState(false);
  const [deleting, setDeleting] = useState<Model | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);
  const [testingModelHashes, setTestingModelHashes] = useState<Set<string>>(() => new Set());
  const [modelTestResults, setModelTestResults] = useState<Map<string, CursorModelTestState>>(() => new Map());
  const [savingAndTesting, setSavingAndTesting] = useState(false);
  const [batchTesting, setBatchTesting] = useState(false);
  const activeModelTests = useRef(new Map<string, { testId: string; controller: AbortController; cancelling: boolean }>());
  const caReady = cursorHarness?.ca === "ready";
  const cursorTakenOver = cursorHarness?.settings_applied ?? false;
  const pluginModels = configuredPluginModels(plugins);
  const testTargets = [
    ...models.map((model) => ({ model_hash: model.model_hash, display_name: model.display_name })),
    ...pluginModels.map((model) => ({ model_hash: model.id, display_name: model.displayName })),
  ];
  const testedCount = testTargets.filter((model) => modelTestResults.get(model.model_hash)?.status === "success").length;

  useEffect(() => {
    if (caCommand) void api.copyCursorText(caCommand);
  }, [caCommand]);

  const initializeCa = async () => {
    const status = await appStore.initializeCursorCa();
    if (status?.ca === "untrusted" && status.ca_install_command) setCaCommand(status.ca_install_command);
  };

  // ---- Providers ----------------------------------------------------------------
  const openNewProvider = () => {
    setEditingProvider(null);
    setProviderDraft(emptyProviderDraft(providers.length + 1));
  };
  const openEditProvider = (provider: Provider) => {
    const { provider_id: _id, created_at_ms: _created, updated_at_ms: _updated, ...input } = provider;
    setEditingProvider(provider);
    setProviderDraft({ provider: input, customHeadersText: JSON.stringify(provider.custom_headers, null, 2) });
  };
  const saveProvider = async () => {
    if (!providerDraft) return;
    let input: ProviderInput;
    try {
      input = providerInput(providerDraft);
    } catch (cause) {
      message(errorText(cause));
      return;
    }
    const saved = editingProvider
      ? await appStore.updateProvider(editingProvider.provider_id, input)
      : await appStore.createProvider(input);
    if (!saved) {
      message(appStore.getSnapshot().error || t("保存失败"));
      return;
    }
    setProviderDraft(null);
    // A new provider goes straight to picking its models.
    if (!editingProvider) void openPicker(saved);
    setEditingProvider(null);
  };

  // ---- Picking models from a provider's list -------------------------------------
  const discoverFor = async (provider: Pick<Provider, "type" | "base_url" | "api_key" | "custom_headers_enabled" | "custom_headers">) => {
    const preset = currentPreset(provider.base_url, provider.type)?.models.map((entry) => entry.model_id) ?? [];
    const result = await api.discoverModels({
      type: provider.type,
      base_url: provider.base_url,
      api_key: provider.api_key,
      custom_headers_enabled: provider.custom_headers_enabled,
      custom_headers: provider.custom_headers,
    });
    return [...new Set([...result.models, ...preset])];
  };
  const openPicker = async (provider: Provider) => {
    setPicking({ provider, options: [], loading: true });
    try {
      const options = await discoverFor(provider);
      setPicking((current) => current?.provider.provider_id === provider.provider_id ? { ...current, options, loading: false } : current);
    } catch (cause) {
      message(t("读取模型列表失败：{error}", { error: errorText(cause) }), { duration: 5000 });
      setPicking((current) => current ? { ...current, loading: false } : current);
    }
  };
  const addPicked = async (modelIds: string[]) => {
    if (!picking) return;
    if (modelIds.length === 0) {
      setPicking(null);
      return;
    }
    const preset = currentPreset(picking.provider.base_url, picking.provider.type);
    const created = await appStore.createModels(modelIds.map((modelId, index) => {
      const known = preset?.models.find((entry) => entry.model_id === modelId);
      const input = emptyCursorModelDraft(picking.provider.provider_id, models.length + index + 1).model;
      return {
        ...input,
        model_id: modelId,
        display_name: known?.display_name ?? modelId,
        tooltip_data: known?.display_name ?? modelId,
        context_window_tokens: known?.context_window_tokens ?? null,
        ...(picking.provider.type === "anthropic"
          ? { anthropic_max_tokens: known?.max_output_tokens ?? null }
          : { max_completion_tokens: known?.max_output_tokens ?? null }),
      };
    }));
    if (created) {
      message(t("已添加 {count} 个模型", { count: created.length }));
      setPicking(null);
    } else {
      message(appStore.getSnapshot().error || t("添加失败"));
    }
  };

  // ---- Models -------------------------------------------------------------------
  const openNewModel = (provider: Provider) => {
    setEditing(null);
    setModelOptions(currentPreset(provider.base_url, provider.type)?.models.map((entry) => entry.model_id) ?? []);
    setDraft(emptyCursorModelDraft(provider.provider_id, models.length + 1));
  };
  const openEdit = (model: Model) => {
    setEditing(model);
    setModelOptions([model.model_id]);
    setDraft({
      model: modelInput(model),
      openAIExtraParamsText: JSON.stringify(model.openai_extra_params, null, 2),
      anthropicExtraParamsText: JSON.stringify(model.anthropic_extra_params, null, 2),
    });
  };
  const discover = async (): Promise<boolean> => {
    const provider = providers.find((candidate) => candidate.provider_id === draft?.model.provider_id);
    if (!provider) return false;
    setDiscovering(true);
    try {
      setModelOptions(await discoverFor(provider));
      return true;
    } catch (cause) {
      message(errorText(cause));
      return false;
    } finally {
      setDiscovering(false);
    }
  };
  const persist = async (): Promise<Model | null> => {
    if (!draft) return null;
    const input = draftInput(draft);
    if (editing) return appStore.updateCursorModel(editing.model_hash, input);
    return (await appStore.createModels([input]))?.[0] ?? null;
  };
  const save = async () => {
    try {
      if (await persist()) {
        setDraft(null);
        setEditing(null);
      } else {
        message(appStore.getSnapshot().error || t("保存失败"));
      }
    } catch (cause) {
      message(errorText(cause));
    }
  };
  const cancelModelTest = async (modelHash: string) => {
    const active = activeModelTests.current.get(modelHash);
    if (!active || active.cancelling) return;
    active.cancelling = true;
    active.controller.abort();
    try {
      await api.cancelModelTest(modelHash, active.testId);
    } catch (cause) {
      message(t("取消测试失败：{error}", { error: errorText(cause) }), { duration: 5000 });
    }
  };
  const cancelAllModelTests = async () => {
    await Promise.all([...activeModelTests.current.keys()].map((modelHash) => cancelModelTest(modelHash)));
  };
  const testModel = async (model: { model_hash: string; display_name: string }, notify = true): Promise<"success" | "failure" | "cancelled"> => {
    if (activeModelTests.current.has(model.model_hash)) {
      await cancelModelTest(model.model_hash);
      return "cancelled";
    }
    const active = { testId: crypto.randomUUID(), controller: new AbortController(), cancelling: false };
    activeModelTests.current.set(model.model_hash, active);
    setTestingModelHashes((current) => new Set(current).add(model.model_hash));
    try {
      const result = await api.testModel(model.model_hash, active.testId, active.controller.signal);
      setModelTestResults((current) => new Map(current).set(model.model_hash, { status: "success", result }));
      if (notify) message(t("模型 {model} 连通性测试成功（{duration} ms）", { model: model.display_name, duration: result.duration_ms }));
      return "success";
    } catch (cause) {
      if (active.cancelling || active.controller.signal.aborted) {
        setModelTestResults((current) => new Map(current).set(model.model_hash, { status: "cancelled" }));
        return "cancelled";
      }
      const error = errorText(cause);
      setModelTestResults((current) => new Map(current).set(model.model_hash, { status: "error", error }));
      if (notify) message(t("连通性测试失败：{error}", { error }), { duration: 5000 });
      return "failure";
    } finally {
      if (activeModelTests.current.get(model.model_hash) === active) activeModelTests.current.delete(model.model_hash);
      setTestingModelHashes((current) => {
        const next = new Set(current);
        next.delete(model.model_hash);
        return next;
      });
    }
  };
  const saveAndTest = async () => {
    setSavingAndTesting(true);
    let saved: Model | null = null;
    try {
      saved = await persist();
    } catch (cause) {
      message(errorText(cause));
    } finally {
      setSavingAndTesting(false);
    }
    if (!saved) return;
    setEditing(saved);
    await testModel(saved);
    await appStore.refresh();
  };
  const testAllModels = async () => {
    if (!testTargets.length || batchTesting) return;
    setBatchTesting(true);
    try {
      const results = await Promise.all(testTargets.map((model) => testModel(model, false)));
      const successful = results.filter((result) => result === "success").length;
      const failed = results.filter((result) => result === "failure").length;
      const cancelled = results.filter((result) => result === "cancelled").length;
      message(cancelled > 0
        ? t("连通性测试已取消：成功 {successful}，失败 {failed}", { successful, failed })
        : failed === 0
          ? t("全部 {count} 个模型连通性测试成功", { count: testTargets.length })
          : t("连通性测试完成：成功 {successful}，失败 {failed}", { successful, failed }),
      { duration: failed === 0 && cancelled === 0 ? 2400 : 5000 });
    } finally {
      setBatchTesting(false);
    }
  };
  const duplicateModel = async (model: Model) => {
    const names = new Set(models.map((item) => item.display_name));
    const baseName = t("{name} 副本", { name: model.display_name });
    let displayName = baseName;
    let suffix = 2;
    while (names.has(displayName)) {
      displayName = `${baseName} ${suffix}`;
      suffix += 1;
    }
    const created = await appStore.createModels([{ ...modelInput(model), sort_order: models.length + 1, display_name: displayName }]);
    if (created) message(t("模型已复制"));
  };
  const reorderModels = useCallback(async (modelHashes: string[]) => {
    if (!await appStore.reorderCursorModels(modelHashes)) {
      message(appStore.getSnapshot().error || t("排序失败"));
    }
  }, [message]);

  const refreshCa = async () => {
    await appStore.refresh();
    if (appStore.getSnapshot().cursorHarness?.ca !== "ready") setWaitingForCaRefresh(false);
  };
  const openCaTerminal = () => {
    if (caCommand) void api.openCursorCaInstallTerminal(caCommand).catch((cause) => message(errorText(cause)));
    setCaCommand(null);
    setWaitingForCaRefresh(true);
  };

  const status = [
    cursorTakenOver ? t("已接管") : t("未接管"),
    t("{count} 个服务商", { count: providers.length + new Set(pluginModels.map((model) => model.pluginId)).size }),
    t("{count} 个模型", { count: testTargets.length }),
    ...(testedCount > 0 ? [t("{count} 个已测试", { count: testedCount })] : []),
  ].join(" · ");

  const header = (importing: boolean, previewing: boolean, openImport: () => void) => <Grid className={page.header}>
    <Rule />
    <Cell from={1} to={9} className={page.label}>Models · {t("模型")}</Cell>
    <Cell from={9} to={13} className={page.label} style={{ justifyContent: "flex-end" }}>
      <span className={page.dot} data-on={cursorTakenOver || undefined} />{status}
    </Cell>
    <Cell from={1} to={8}><h1 className={page.title}>Models</h1></Cell>
    <Cell from={8} to={13} className={page.tools}>
      <button type="button" className={page.primary} disabled={!caReady || cursorBusy} onClick={openNewProvider}>{t("添加服务商")}</button>
      {testTargets.length > 0 && <button type="button" disabled={cursorBusy || (!batchTesting && testingModelHashes.size > 0)} onClick={() => void (batchTesting ? cancelAllModelTests() : testAllModels())}>{batchTesting ? t("取消全部测试") : t("一键测试")}</button>}
      <ActionMenu label={t("更多")} disabled={cursorBusy || importing} items={[
        { id: "import", label: previewing ? t("读取中…") : t("导入旧版配置"), onSelect: openImport },
      ]} />
      <TooltipTrigger label={t("刷新")}><button type="button" className={controls.iconButton} aria-label={t("刷新")} disabled={busy} onClick={() => void appStore.refresh()}>
        <Icon className={busy ? controls.spin : ""} icon={refreshIcon} size="1.1em" />
      </button></TooltipTrigger>
    </Cell>
  </Grid>;

  const content = <LegacyModelImport>{({ busy: importing, previewing, open }) => <>
    {header(importing, previewing, open)}
    <CursorCaProvider><CursorCaGate busy={cursorBusy} waitingForRefresh={waitingForCaRefresh} onInitialize={() => void initializeCa()} onRefresh={() => void refreshCa()}>
        <CursorModelProvider><CursorModelGate busy={cursorBusy || importing} previewingImport={previewing} onAdd={openNewProvider} onImport={open}>
          <ProviderTable
            providers={providers}
            models={models}
            pluginModels={pluginModels}
            disabled={cursorBusy}
            testing={testingModelHashes}
            results={modelTestResults}
            onTest={(model) => void testModel(model)}
            onAddModel={openNewModel}
            onPickModels={(provider) => void openPicker(provider)}
            onEditProvider={openEditProvider}
            onDeleteProvider={setDeletingProvider}
            onEditModel={openEdit}
            onDuplicateModel={(model) => void duplicateModel(model)}
            onDeleteModel={setDeleting}
            onPluginSettings={() => navigate("/plugins")}
            onReorder={(hashes) => void reorderModels(hashes)}
          />
        </CursorModelGate></CursorModelProvider>
    </CursorCaGate></CursorCaProvider>
  </>}</LegacyModelImport>;

  const editorTestState = editing ? modelTestResults.get(editing.model_hash) : undefined;
  const editorTesting = Boolean(editing && testingModelHashes.has(editing.model_hash));
  const estimatedHeight = 220 + providers.length * 80 + (models.length + pluginModels.length) * 52;

  return <div className={page.root}>
    <GridGuides />
    <PageContent contentClassName={page.content} sections={[{ key: "models", estimatedHeight, content }]} />
    <Modal open={providerDraft !== null} title={editingProvider ? t("编辑服务商") : t("添加服务商")} busy={cursorBusy} onClose={() => { setProviderDraft(null); setEditingProvider(null); }} onSubmit={() => void saveProvider()} submitLabel={editingProvider ? t("保存") : t("保存并选择模型")}>
      {providerDraft && <ProviderEditor draft={providerDraft} onChange={setProviderDraft} />}
    </Modal>
    <ModelPicker
      provider={picking?.provider ?? null}
      models={models}
      options={picking?.options ?? []}
      loading={picking?.loading ?? false}
      busy={cursorBusy}
      onClose={() => setPicking(null)}
      onAdd={(ids) => void addPicked(ids)}
    />
    <Modal fullHeight open={draft !== null} title={editing ? t("编辑模型") : t("添加模型")} banner={draft && (editorTesting || editorTestState) ? <CursorModelTestResult state={editorTestState} testing={editorTesting} /> : undefined} busy={cursorBusy || savingAndTesting} onClose={() => { if (editing && editorTesting) void cancelModelTest(editing.model_hash); setDraft(null); setEditing(null); }} onSubmit={() => void save()} submitLabel={t("保存")} secondaryAction={<button type="button" className={controls.secondary} disabled={cursorBusy || savingAndTesting} onClick={() => void (editorTesting && editing ? cancelModelTest(editing.model_hash) : saveAndTest())}>{savingAndTesting ? t("处理中…") : editorTesting ? t("取消测试") : t("保存并测试")}</button>}>
      {draft && <CursorModelEditor draft={draft} providers={providers} modelOptions={modelOptions} discovering={discovering} onChange={setDraft} onDiscover={discover} />}
    </Modal>
    <ConfirmDialog open={caCommand !== null} title={t("安装本地 CA")} cancelLabel={t("关闭")} confirmLabel={t("打开终端")} onCancel={() => setCaCommand(null)} onConfirm={openCaTerminal}>
      <div className={styles.editor}><strong>{t("需要授权安装证书")}</strong><span>{t("安装命令已自动复制。点击“打开终端”，将命令粘贴到终端中执行，并按提示输入密码。")}</span><pre className={styles.command}>{caCommand}</pre></div>
    </ConfirmDialog>
    <ConfirmDialog open={deleting !== null} title={t("删除模型")} cancelLabel={t("取消")} confirmLabel={t("删除")} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) void appStore.deleteModel(deleting.model_hash); setDeleting(null); }}><p>{t("确定删除这个模型吗？")}</p></ConfirmDialog>
    <ConfirmDialog open={deletingProvider !== null} title={t("删除服务商")} cancelLabel={t("取消")} confirmLabel={t("删除")} onCancel={() => setDeletingProvider(null)} onConfirm={() => { if (deletingProvider) void appStore.deleteProvider(deletingProvider.provider_id); setDeletingProvider(null); }}>
      <p>{t("确定删除服务商 {name} 吗？它下面的 {count} 个模型会一起删除，调用记录保留。", { name: deletingProvider?.name ?? "", count: models.filter((model) => model.provider_id === deletingProvider?.provider_id).length })}</p>
    </ConfirmDialog>
  </div>;
}

function providerInput(draft: ProviderDraft): ProviderInput {
  const provider = {
    ...draft.provider,
    base_url: draft.provider.base_url.trim(),
    api_key: draft.provider.api_key.trim(),
    custom_headers: parseHeaders(draft.customHeadersText),
  };
  provider.name = draft.provider.name.trim() || hostOf(provider.base_url);
  if (!provider.base_url || !provider.api_key) throw new Error(t("服务器地址或完整请求 URL 和 API Key 不能为空"));
  return provider;
}

function draftInput(draft: CursorModelDraft): ModelInput {
  const model = {
    ...draft.model,
    display_name: draft.model.display_name.trim(),
    tooltip_data: draft.model.tooltip_data.trim() || draft.model.display_name.trim(),
    model_id: draft.model.model_id.trim(),
    openai_extra_params: parseObject(draft.openAIExtraParamsText, t("OpenAI 额外参数")),
    anthropic_extra_params: parseObject(draft.anthropicExtraParamsText, t("Anthropic 额外参数")),
  };
  if (!model.provider_id || !model.display_name || !model.model_id) throw new Error(t("服务商、模型名称和显示名称不能为空"));
  for (const [label, value] of [[t("上下文窗口 Token"), model.context_window_tokens], [t("最大输出 Token"), model.max_completion_tokens], [t("最大输出 Token"), model.anthropic_max_tokens], [t("思考预算 Token"), model.thinking_budget_tokens]] as const) {
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) throw new Error(t("{label} 必须是大于 0 的整数", { label }));
  }
  return model;
}

function parseHeaders(text: string): Record<string, string> {
  const parsed = parseObject(text, t("自定义 Headers"));
  if (Object.values(parsed).some((value) => typeof value !== "string")) throw new Error(t("自定义 Headers 的值必须都是字符串"));
  return parsed as Record<string, string>;
}

function parseObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(text || "{}"); } catch { throw new Error(t("{label} 必须是有效 JSON", { label })); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(t("{label} 必须是 JSON 对象", { label }));
  return parsed as Record<string, unknown>;
}

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
