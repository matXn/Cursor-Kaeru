import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { appStore, useAppStore } from "../shared/store/appStore";
import styles from "./TakeoverToggle.module.scss";

// The scan must be long enough to read as a motion even when the switch itself is instant.
const MIN_SCAN_MS = 900;
const DOTS = Array.from({ length: 8 }, (_, index) => index);

type State = "off" | "scanning" | "on";

// Takeover switch in the top bar. Everything animates inside one 18px mark, Face ID style:
// a ring breaks into scanning dots, which collapse into a lit disc with a drawn check.
// Turning off is a single click; the disc simply shrinks back into the ring.
export function TakeoverToggle() {
  const { cursorHarness, cursorBusy } = useAppStore();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const taken = cursorHarness?.settings_applied ?? false;
  const caReady = cursorHarness?.ca === "ready";

  if (!cursorHarness) return null;
  const state: State = scanning ? "scanning" : taken ? "on" : "off";

  const toggle = async () => {
    if (scanning || cursorBusy) return;
    if (taken) {
      await appStore.setCursorEnabled(false);
      return;
    }
    // Taking over needs the local CA; its setup lives on the models page.
    if (!caReady) {
      navigate("/harness/cursor");
      return;
    }
    setScanning(true);
    await Promise.all([
      appStore.setCursorEnabled(true),
      new Promise((resolve) => window.setTimeout(resolve, MIN_SCAN_MS)),
    ]);
    setScanning(false);
  };

  const label = {
    off: caReady ? t("Cursor Kaeru 未接管") : t("Cursor Kaeru 未接管 · 需初始化 CA"),
    scanning: t("正在接管 Cursor…"),
    on: t("Cursor Kaeru 已接管"),
  }[state];

  return <button
    type="button"
    className={styles.root}
    data-state={state}
    aria-pressed={taken}
    aria-label={label}
    onClick={() => void toggle()}
  >
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <circle className={styles.ring} cx="12" cy="12" r="8" />
      <g className={styles.dots}>
        {DOTS.map((dot) => <circle
          key={dot}
          cx={12 + 8 * Math.cos((dot / DOTS.length) * Math.PI * 2)}
          cy={12 + 8 * Math.sin((dot / DOTS.length) * Math.PI * 2)}
          r="1.5"
          style={{ animationDelay: `${dot * -110}ms` }}
        />)}
      </g>
      <circle className={styles.disc} cx="12" cy="12" r="9" />
      <path className={styles.check} d="M8 12.4l2.7 2.7L16.2 9.6" pathLength={1} />
    </svg>
    <span key={state} className={styles.label}>{label}</span>
  </button>;
}
