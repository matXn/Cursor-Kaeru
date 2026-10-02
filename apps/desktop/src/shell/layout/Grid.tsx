import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import styles from "./Grid.module.scss";

// Swiss page grid: 12 columns; every block starts and ends on a column line.
export function Grid({ className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string }) {
  return <div {...rest} className={[styles.grid, className].filter(Boolean).join(" ")}>{children}</div>;
}

// A block spanning columns [from, to), in CSS grid-line numbers (1 to 13).
export function Cell({ from, to, className, style, children }: {
  from: number;
  to: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return <div className={className} style={{ gridColumn: `${from} / ${to}`, minWidth: 0, ...style }}>{children}</div>;
}

// Full-width line: a strong rule opens a block, a hairline separates rows inside it.
export function Rule({ hair = false }: { hair?: boolean }) {
  return <div className={hair ? styles.hair : styles.rule} />;
}

// The column lines themselves, drawn behind the page as faint light shafts. They stay put
// while the page scrolls, like lines on the glass.
export function GridGuides() {
  return <div className={styles.guides} aria-hidden="true">
    {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
  </div>;
}
