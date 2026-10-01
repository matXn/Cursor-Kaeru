import { useNavigate } from "react-router-dom";
import { appStore, useAppStore } from "../shared/store/appStore";
import styles from "./TakeoverToggle.module.scss";

// Takeover switch in the top bar: an empty ring when off, a lit disc with a check when on.
export function TakeoverToggle() {
  const { cursorHarness, cursorBusy } = useAppStore();
  const navigate = useNavigate();
  const taken = cursorHarness?.settings_applied ?? false;
  const caReady = cursorHarness?.ca === "ready";

  if (!cursorHarness) return null;

  const toggle = () => {
    if (cursorBusy) return;
    // Taking over needs the local CA; its setup lives on the models page.
    if (!taken && !caReady) {
      navigate("/harness/cursor");
      return;
    }
    void appStore.setCursorEnabled(!taken);
  };

  const label = taken
    ? t("Cursor Kaeru 已接管")
    : caReady ? t("Cursor Kaeru 未接管") : t("Cursor Kaeru 未接管 · 需初始化 CA");

  return <button
    type="button"
    className={styles.root}
    data-state={taken ? "on" : "off"}
    aria-pressed={taken}
    aria-label={label}
    onClick={toggle}
  >
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <circle className={styles.ring} cx="12" cy="12" r="8" />
      <circle className={styles.disc} cx="12" cy="12" r="9" />
      <path className={styles.check} d="M8 12.4l2.7 2.7L16.2 9.6" />
    </svg>
    <span>{label}</span>
  </button>;
}
