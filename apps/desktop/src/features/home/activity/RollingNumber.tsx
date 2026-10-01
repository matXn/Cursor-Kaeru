import { useLayoutEffect, useState, type CSSProperties } from "react";
import styles from "./RollingNumber.module.scss";

const DIGITS = "0123456789";
const DURATION_MS = 1400;
const STAGGER_MS = 140;

// Mechanical counter: every digit is a vertical strip that spins from its old value to its new
// one. Lower digits travel extra full turns, so the number settles left to right.
// `from` null renders `value` at rest; a change of `runId` replays the roll.
export function RollingNumber({ value, from, runId, className }: {
  value: string;
  from: string | null;
  runId: number;
  className?: string;
}) {
  const [rolling, setRolling] = useState(false);
  const chars = [...value];
  // Right-align the old string against the new one so units line up with units.
  const previous = from === null ? null : [...from.padStart(value.length, "0").slice(-value.length)];

  useLayoutEffect(() => {
    if (from === null) return;
    setRolling(false);
    // Paint the start position, then release the transition on the next frame.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setRolling(true)); });
    return () => cancelAnimationFrame(frame);
  }, [runId, from]);

  let digitIndex = 0;

  return <span className={[styles.root, className].filter(Boolean).join(" ")} aria-label={value}>
    {chars.map((char, index) => {
      if (!DIGITS.includes(char)) return <span key={index} className={styles.static} aria-hidden="true">{char}</span>;
      const position = digitIndex++;
      const target = Number(char);
      const start = previous && DIGITS.includes(previous[index]) ? Number(previous[index]) : 0;
      // Units digit spins the most; the leading digit takes the shortest way round.
      const turns = previous ? position : 0;
      const steps = turns * 10 + ((target - start + 10) % 10);
      const strip = Array.from({ length: steps + 1 }, (_, step) => (start + step) % 10);
      const at = previous && !rolling ? 0 : steps;
      const style = {
        "--offset": at,
        transitionDuration: previous && rolling ? `${DURATION_MS + position * STAGGER_MS}ms` : "0ms",
      } as CSSProperties;
      return <span key={`${index}-${runId}`} className={styles.column} aria-hidden="true">
        <span className={styles.strip} style={style}>
          {strip.map((digit, step) => <span key={step}>{digit}</span>)}
        </span>
      </span>;
    })}
  </span>;
}
