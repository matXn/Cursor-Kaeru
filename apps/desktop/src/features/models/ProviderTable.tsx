import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import type { CursorModel, Model, PluginModelDescriptor, Provider } from "../../shared/api";
import { ActionMenu } from "../../shared/ui/ActionMenu";
import { Icon } from "../../shared/ui/Icon";
import { Switch } from "../../shared/ui/Switch";
import { dragIcon } from "../../shared/ui/icons";
import { formatCompactInteger } from "../../shared/utils/numberFormat";
import { Cell, Grid, Rule } from "../../shell/layout/Grid";
import { CursorModelTestResult, type CursorModelTestState } from "./CursorModelTestResult";
import { ProviderLogo } from "../../shared/ui/ProviderLogo";
import styles from "./ProviderTable.module.scss";

type Tests = {
  testing: Set<string>;
  results: Map<string, CursorModelTestState>;
};

type ProviderTableProps = Tests & {
  providers: Provider[];
  models: Model[];
  pluginModels: PluginModelDescriptor[];
  cursorModels: CursorModel[];
  disabled: boolean;
  onTest: (model: { model_hash: string; display_name: string }) => void;
  onToggle: (target: { modelHash: string } | { pluginId: string; providerId: string; modelId: string }, enabled: boolean) => void;
  onAddModel: (provider: Provider) => void;
  onPickModels: (provider: Provider) => void;
  onEditProvider: (provider: Provider) => void;
  onDeleteProvider: (provider: Provider) => void;
  onEditModel: (model: Model) => void;
  onDuplicateModel: (model: Model) => void;
  onDeleteModel: (model: Model) => void;
  onPluginSettings: () => void;
  onReorder: (modelHashes: string[]) => void;
  onToggleCursorModel: (name: string | null, enabled: boolean) => void;
};

// Column plan, shared by every section so all rows line up on the page grid:
// provider row   1–5 name · 5–10 address · 10–13 actions
// model row      1–2 Nº · 2–5 name + options · 5–8 model ID · 8–10 test · 10–13 switch + actions
export function ProviderTable(props: ProviderTableProps) {
  let number = 0;
  const next = () => String(++number).padStart(2, "0");
  const plugins = pluginGroups(props.pluginModels);

  return <div className={styles.root}>
    {props.providers.map((provider) => {
      const models = props.models.filter((model) => model.provider_id === provider.provider_id);
      return <section key={provider.provider_id} className={styles.section} aria-label={provider.name}>
        <Grid>
          <Rule />
          <Cell from={1} to={5} className={styles.provider}>
            <ProviderLogo className={styles.logo} hints={[provider.name, provider.base_url, ...models.map((model) => model.model_id)]} size="18px" />
            <span className={styles.providerName}>{provider.name}</span>
            <span className={styles.tag}>{protocolLabel(provider)}</span>
          </Cell>
          <Cell from={5} to={10} className={styles.mono} style={{ alignSelf: "center" }}><span title={provider.base_url}>{provider.base_url.replace(/^https?:\/\//, "")}</span></Cell>
          <Cell from={10} to={13} className={styles.actions}>
            <button type="button" disabled={props.disabled} onClick={() => props.onPickModels(provider)}>{t("获取模型列表")}</button>
            <button type="button" disabled={props.disabled} onClick={() => props.onAddModel(provider)}>{t("添加")}</button>
            <ActionMenu label={t("更多")} disabled={props.disabled} items={[
              { id: "edit", label: t("编辑服务商"), onSelect: () => props.onEditProvider(provider) },
              { id: "delete", label: t("删除服务商"), onSelect: () => props.onDeleteProvider(provider) },
            ]} />
          </Cell>
        </Grid>
        {models.length === 0
          ? <p className={styles.empty}>{t("还没有模型。可以获取模型列表一次添加多个，也可以手动添加。")}</p>
          : <ModelRows {...props} rows={models} number={next} />}
      </section>;
    })}

    {plugins.map((group) => <section key={group.pluginId} className={styles.section} aria-label={group.pluginName}>
      <Grid>
        <Rule />
        <Cell from={1} to={5} className={styles.provider}>
          <ProviderLogo className={styles.logo} hints={[group.pluginName, group.pluginId, ...group.models.map((model) => model.modelId)]} size="18px" />
          <span className={styles.providerName}>{group.pluginName}</span>
          <span className={styles.tag}>{t("插件")}</span>
        </Cell>
        <Cell from={5} to={10} className={styles.muted} style={{ alignSelf: "center" }}>{t("账号和额度在插件页管理")}</Cell>
        <Cell from={10} to={13} className={styles.actions}>
          <button type="button" onClick={props.onPluginSettings}>{t("设置")}</button>
        </Cell>
      </Grid>
      {group.models.map((model) => <Grid key={model.id} className={styles.row} data-off={model.enabled ? undefined : ""}>
        <Cell from={1} to={2} className={styles.number}>{next()}</Cell>
        <Cell from={2} to={5} className={styles.name}>{model.displayName}</Cell>
        <Cell from={5} to={8} className={styles.mono}>{model.modelId}</Cell>
        <Cell from={8} to={10}><TestState id={model.id} {...props} /></Cell>
        <Cell from={10} to={13} className={styles.actions}>
          <Switch checked={model.enabled} label={t("在 Cursor 中启用")} disabled={props.disabled} onChange={(enabled) => props.onToggle({ pluginId: model.pluginId, providerId: model.providerId, modelId: model.modelId }, enabled)} />
          <button type="button" disabled={props.disabled && !props.testing.has(model.id)} onClick={() => props.onTest({ model_hash: model.id, display_name: model.displayName })}>{props.testing.has(model.id) ? t("取消测试") : t("测试")}</button>
          <button type="button" onClick={props.onPluginSettings}>{t("设置")}</button>
        </Cell>
      </Grid>)}
    </section>)}

    <CursorModels {...props} number={next} />
  </div>;
}

// Cursor's own models: they come from the Cursor account, so they can only be switched.
function CursorModels({ cursorModels, disabled, onToggleCursorModel, number }: ProviderTableProps & { number: () => string }) {
  const allOn = cursorModels.every((model) => model.enabled);
  return <section className={styles.section} aria-label="Cursor">
    <Grid>
      <Rule />
      <Cell from={1} to={5} className={styles.provider}>
        <ProviderLogo className={styles.logo} hints={["cursor"]} size="18px" />
        <span className={styles.providerName}>Cursor</span>
        <span className={styles.tag}>{t("官方")}</span>
      </Cell>
      <Cell from={5} to={10} className={styles.muted} style={{ alignSelf: "center" }}>{t("关闭后不在 Cursor 的模型列表中显示，Cursor 重新读取模型列表后生效")}</Cell>
      <Cell from={10} to={13} className={styles.actions}>
        {cursorModels.length > 0 && <button type="button" disabled={disabled} onClick={() => onToggleCursorModel(null, !allOn)}>{allOn ? t("全部关闭") : t("全部开启")}</button>}
      </Cell>
    </Grid>
    {cursorModels.length === 0
      ? <p className={styles.empty}>{t("接管后在 Cursor 中打开模型列表，官方模型会出现在这里。")}</p>
      : cursorModels.map((model) => <Grid key={model.name} className={styles.row} data-off={model.enabled ? undefined : ""}>
        <Cell from={1} to={2} className={styles.number}>{number()}</Cell>
        <Cell from={2} to={5} className={styles.name}>{model.display_name}</Cell>
        <Cell from={5} to={10} className={styles.mono}><span title={model.name}>{model.name}</span></Cell>
        <Cell from={10} to={13} className={styles.actions}>
          <Switch checked={model.enabled} label={t("在 Cursor 中启用")} disabled={disabled} onChange={(enabled) => onToggleCursorModel(model.name, enabled)} />
        </Cell>
      </Grid>)}
  </section>;
}

// A provider's models, draggable among themselves by the handle in the Nº column.
function ModelRows(props: ProviderTableProps & { rows: Model[]; number: () => string }) {
  const list = useRef<HTMLDivElement>(null);
  const sortable = useRef<Sortable | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!list.current) return;
    sortable.current = Sortable.create(list.current, {
      animation: 160,
      dataIdAttr: "data-model-hash",
      draggable: `.${styles.row}`,
      handle: `.${styles.handle}`,
      ghostClass: styles.ghost,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 3,
      onEnd: (event) => {
        const { rows: models, models: all, onReorder } = latest.current;
        const from = event.oldDraggableIndex ?? event.oldIndex;
        const to = event.newDraggableIndex ?? event.newIndex;
        const restore = () => sortable.current?.sort(models.map((model) => model.model_hash), false);
        if (typeof from !== "number" || typeof to !== "number" || from === to) return restore();
        const reordered = models.slice();
        const [moved] = reordered.splice(from, 1);
        if (!moved) return restore();
        reordered.splice(to, 0, moved);
        // The server orders the whole list; this provider's block moves, the rest stays.
        const ids = new Set(reordered.map((model) => model.model_hash));
        let cursor = 0;
        onReorder(all.map((model) => ids.has(model.model_hash) ? reordered[cursor++].model_hash : model.model_hash));
      },
    });
    return () => {
      sortable.current?.destroy();
      sortable.current = null;
    };
  }, []);

  useEffect(() => {
    sortable.current?.option("disabled", props.disabled);
    // Sorting re-inserts every row, which cuts running transitions (the switches): only when
    // the order on screen is actually stale.
    const order = props.rows.map((model) => model.model_hash);
    if (sortable.current && sortable.current.toArray().join() !== order.join()) sortable.current.sort(order, false);
  }, [props.disabled, props.rows]);

  return <div ref={list}>
    {props.rows.map((model) => {
      const testing = props.testing.has(model.model_hash);
      return <Grid key={model.model_hash} className={styles.row} data-model-hash={model.model_hash} data-off={model.enabled ? undefined : ""}>
        <Cell from={1} to={2} className={styles.number}>
          <button type="button" className={styles.handle} disabled={props.disabled} aria-label={t("拖动排序")} title={t("拖动排序")}><Icon icon={dragIcon} size="14px" /></button>
          <span>{props.number()}</span>
        </Cell>
        <Cell from={2} to={5} className={styles.name}>
          <span>{model.display_name}</span>
          <span className={styles.options}>{modelOptions(model)}</span>
        </Cell>
        <Cell from={5} to={8} className={styles.mono}><span title={model.model_id}>{model.model_id}</span></Cell>
        <Cell from={8} to={10}><TestState id={model.model_hash} {...props} /></Cell>
        <Cell from={10} to={13} className={styles.actions}>
          <Switch checked={model.enabled} label={t("在 Cursor 中启用")} disabled={props.disabled} onChange={(enabled) => props.onToggle({ modelHash: model.model_hash }, enabled)} />
          <button type="button" disabled={props.disabled && !testing} onClick={() => props.onTest(model)}>{testing ? t("取消测试") : t("测试")}</button>
          <button type="button" disabled={props.disabled} onClick={() => props.onEditModel(model)}>{t("编辑")}</button>
          <ActionMenu label={t("更多")} disabled={props.disabled} items={[
            { id: "duplicate", label: t("复制"), onSelect: () => props.onDuplicateModel(model) },
            { id: "delete", label: t("删除"), onSelect: () => props.onDeleteModel(model) },
          ]} />
        </Cell>
      </Grid>;
    })}
  </div>;
}

function TestState({ id, testing, results }: Tests & { id: string }) {
  const state = results.get(id);
  if (!testing.has(id) && !state) return <span className={styles.muted}>{t("未测试")}</span>;
  return <CursorModelTestResult compact state={state} testing={testing.has(id)} />;
}

function protocolLabel(provider: Provider) {
  if (provider.type === "anthropic") return "ANTHROPIC";
  return provider.openai_endpoint === "/v1/chat/completions" ? "OPENAI · CHAT" : "OPENAI · RESPONSES";
}

function modelOptions(model: Model) {
  const effort = model.type === "anthropic" ? model.anthropic_thinking_effort : model.reasoning_effort;
  return [
    effort && `${model.type === "anthropic" ? t("思考") : t("推理")} ${effort}`,
    model.context_window_tokens && formatCompactInteger(model.context_window_tokens),
  ].filter(Boolean).join(" · ");
}

function pluginGroups(models: PluginModelDescriptor[]) {
  const groups: { pluginId: string; pluginName: string; models: PluginModelDescriptor[] }[] = [];
  for (const model of models) {
    let group = groups.find((candidate) => candidate.pluginId === model.pluginId);
    if (!group) {
      group = { pluginId: model.pluginId, pluginName: model.pluginName, models: [] };
      groups.push(group);
    }
    group.models.push(model);
  }
  return groups;
}
