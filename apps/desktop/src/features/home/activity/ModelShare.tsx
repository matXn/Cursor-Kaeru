import { formatCompactInteger } from "../../../shared/utils/numberFormat";
import type { ModelShare as Share } from "../../../shared/api";
import styles from "./ModelShare.module.scss";

const SHOWN = 4;
// Largest share in the strongest ink, then down the heat ramp; the rest stays neutral.
const COLORS = ["var(--heat-4)", "var(--heat-3)", "var(--heat-2)", "var(--heat-1)"];

// Share of tokens by model as one stacked bar, with a legend under it. The top four models
// are named; everything after them folds into "其他".
export function ModelShare({ models }: { models: Share[] }) {
  const total = models.reduce((sum, model) => sum + model.tokens, 0);
  const rest = models.slice(SHOWN).reduce((sum, model) => sum + model.tokens, 0);
  const segments = [
    ...models.slice(0, SHOWN).map((model, index) => ({ name: model.display_name, tokens: model.tokens, color: COLORS[index] })),
    ...(rest > 0 ? [{ name: t("其他"), tokens: rest, color: "var(--border-strong)" }] : []),
  ];
  const percent = (tokens: number) => `${((tokens / total) * 100).toFixed(1)}%`;

  return <figure className={styles.root} aria-label={t("各模型的 Token 占比")}>
    <div className={styles.bar}>
      {segments.map((segment) => <i
        key={segment.name}
        style={{ flexGrow: segment.tokens, background: segment.color }}
        title={`${segment.name} · ${formatCompactInteger(segment.tokens)} Token`}
      />)}
    </div>
    <figcaption className={styles.legend}>
      {segments.map((segment) => <span key={segment.name}>
        <i style={{ background: segment.color }} />{segment.name}<b>{percent(segment.tokens)}</b>
      </span>)}
    </figcaption>
  </figure>;
}
