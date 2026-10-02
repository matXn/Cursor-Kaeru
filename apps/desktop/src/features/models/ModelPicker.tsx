import { useEffect, useState } from "react";
import type { Model, Provider } from "../../shared/api";
import { Checkbox } from "../../shared/ui/Checkbox";
import { TextInput } from "../../shared/ui/FormControls";
import { Modal } from "../../shared/ui/Modal";
import styles from "./CursorSettings.module.scss";

// The models a provider offers, read from its model list endpoint (plus any the preset
// knows), to add several at once. Models already under the provider are shown, not offered.
export function ModelPicker({ provider, models, options, loading, busy, onClose, onAdd }: {
  provider: Provider | null;
  models: Model[];
  options: string[];
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onAdd: (modelIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setQuery("");
    setPicked(new Set());
  }, [provider?.provider_id]);

  const existing = new Set(models.filter((model) => model.provider_id === provider?.provider_id).map((model) => model.model_id));
  const needle = query.trim().toLowerCase();
  const visible = options.filter((id) => !needle || id.toLowerCase().includes(needle));
  const toggle = (id: string, on: boolean) => setPicked((current) => {
    const next = new Set(current);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  return <Modal
    open={provider !== null}
    title={t("从 {provider} 添加模型", { provider: provider?.name ?? "" })}
    busy={busy}
    onClose={onClose}
    onSubmit={() => onAdd([...picked])}
    submitLabel={picked.size > 0 ? t("添加 {count} 个模型", { count: picked.size }) : t("添加")}
  >
    <div className={styles.picker}>
      <TextInput placeholder={t("筛选模型")} value={query} onChange={(event) => setQuery(event.target.value)} />
      {loading
        ? <p className={styles.pickerNote}>{t("正在读取模型列表…")}</p>
        : visible.length === 0
          ? <p className={styles.pickerNote}>{options.length === 0 ? t("没有读到模型列表，可以在添加模型时手动填写模型名称。") : t("没有匹配的模型")}</p>
          : <div className={styles.pickerList} role="group" aria-label={t("可添加的模型")}>
            {visible.map((id) => existing.has(id)
              ? <div key={id} className={styles.pickerExisting}><span>{id}</span><span>{t("已添加")}</span></div>
              : <Checkbox key={id} checked={picked.has(id)} label={id} onChange={(on) => toggle(id, on)} />)}
          </div>}
    </div>
  </Modal>;
}
