import type { IconifyIcon } from "@iconify/react";
import { Icon } from "../../shared/ui/Icon";
import styles from "./PageTitle.module.scss";

// Page marking: the page's glyph and its English name in Outfit.
// The nav already says the page's Chinese name, so the title does not repeat it.
export function PageTitle({ glyph, name }: { glyph: IconifyIcon; name: string }) {
  return <h1 className={styles.root}>
    <Icon className={styles.glyph} icon={glyph} size="0.9em" />
    <span>{name}</span>
  </h1>;
}
