import styles from "./PageTitle.module.scss";

// Page marking: a page number and the English name set in Mona Sans Expanded.
// The nav already says the page's Chinese name, so the title does not repeat it.
export function PageTitle({ index, name }: { index: number; name: string }) {
  return <h1 className={styles.root}>
    <span className={styles.index}>{String(index).padStart(2, "0")}</span>
    <span className={styles.name}>{name}</span>
  </h1>;
}
