import { useLayoutEffect, useRef, useState } from "react";
import { ProviderLogo } from "../../../shared/ui/ProviderLogo";
import styles from "./FittedName.module.scss";

// "DeepSeek-V4.1-Flash" → ["DeepSeek", "DeepSeek-V4.1", "DeepSeek-V4.1-Flash"]: whole words only.
function prefixes(name: string) {
  const parts = name.split(/(?<=[-_\s])/);
  return parts.map((_, index) => parts.slice(0, index + 1).join("").replace(/[-_\s]+$/, ""));
}

// A model name at display size, never cut mid-word: it drops words from the end until it fits,
// and when not even the first word fits, it shows the provider's logo. The full name is the tooltip.
export function FittedName({ name, className }: { name: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Off-screen copy in the same font; React leaves its text to the measuring below.
  const probe = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(name);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const fit = () => {
      const candidates = prefixes(name);
      let fitting: string | null = null;
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        probe.current!.textContent = candidates[index];
        if (probe.current!.offsetWidth <= element.clientWidth) {
          fitting = candidates[index];
          break;
        }
      }
      setShown(fitting);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);

  return <div ref={box} className={[styles.root, className].filter(Boolean).join(" ")} title={name}>
    <span ref={probe} className={styles.probe} aria-hidden="true" />
    {shown !== null ? <span>{shown}</span> : <ProviderLogo hints={[name]} size="1em" />}
  </div>;
}
