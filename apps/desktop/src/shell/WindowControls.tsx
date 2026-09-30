import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Icon } from "../shared/ui/Icon";
import {
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "../shared/ui/icons";
import styles from "./WindowControls.module.scss";

// Windows/Linux caption buttons. Outside the desktop shell (browser demo) they render inert.
export function WindowControls({ native }: { native: boolean }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!native) return;
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const updateMaximized = async () => {
      const next = await appWindow.isMaximized();
      if (!disposed) setMaximized(next);
    };

    void updateMaximized();
    void appWindow.onResized(() => void updateMaximized()).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [native]);

  const appWindow = native ? getCurrentWindow() : null;
  const maximizeLabel = maximized ? t("还原窗口") : t("最大化窗口");

  return <div className={styles.root}>
    <button
      type="button"
      className={styles.button}
      aria-label={t("最小化窗口")}
      title={t("最小化窗口")}
      onClick={() => void appWindow?.minimize()}
    >
      <Icon icon={windowMinimizeIcon} size="1.1em" />
    </button>
    <button
      type="button"
      className={styles.button}
      aria-label={maximizeLabel}
      title={maximizeLabel}
      onClick={() => void appWindow?.toggleMaximize()}
    >
      <Icon icon={maximized ? windowRestoreIcon : windowMaximizeIcon} size="1.1em" />
    </button>
    <button
      type="button"
      className={[styles.button, styles.close].join(" ")}
      aria-label={t("关闭窗口")}
      title={t("关闭窗口")}
      onClick={() => void appWindow?.close()}
    >
      <Icon icon={windowCloseIcon} size="1.1em" />
    </button>
  </div>;
}
