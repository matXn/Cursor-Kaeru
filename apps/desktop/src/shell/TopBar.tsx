import { useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import appIcon from "../../src-tauri/icons/32x32.png";
import { api } from "../shared/api";
import type { DesktopPlatform } from "../shared/native/platform";
import { useAppStore } from "../shared/store/appStore";
import { useUpdateStore } from "../shared/store/updateStore";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { Icon } from "../shared/ui/Icon";
import { informationOutlineIcon } from "../shared/ui/icons";
import { useMessage } from "../shared/ui/message";
import { TooltipTrigger } from "../shared/ui/TooltipTrigger";
import { MacTrafficLights } from "./MacTrafficLights";
import { WindowControls } from "./WindowControls";
import styles from "./TopBar.module.scss";

const tutorialReadStorageKey = "cursor-byok:tutorial-read";
const tutorialUrl = "https://docs.leokun.cn";

function readTutorialState() {
  try {
    return localStorage.getItem(tutorialReadStorageKey) === "true";
  } catch {
    return false;
  }
}

// Single window-wide bar: drag region, primary navigation, global status, window controls.
export function TopBar({ platform, nativeDesktop }: { platform: DesktopPlatform; nativeDesktop: boolean }) {
  const { cursorHarness } = useAppStore();
  const { availableVersion } = useUpdateStore();
  const message = useMessage();
  const [confirmTutorial, setConfirmTutorial] = useState(false);
  const [tutorialRead, setTutorialRead] = useState(readTutorialState);
  const taken = cursorHarness?.settings_applied ?? false;
  const pages = [
    { path: "/", label: t("概览") },
    { path: "/calls", label: t("调用") },
    { path: "/harness/cursor", label: t("模型") },
    { path: "/plugins", label: t("插件") },
    { path: "/settings", label: t("设置"), dot: Boolean(availableVersion) },
  ];

  const openTutorial = useCallback(() => {
    setConfirmTutorial(false);
    void api.openExternalUrl(tutorialUrl)
      .then(() => {
        setTutorialRead(true);
        try {
          localStorage.setItem(tutorialReadStorageKey, "true");
        } catch {
          // Read state remains valid for the current session when storage is unavailable.
        }
      })
      .catch((cause) => message(cause instanceof Error ? cause.message : String(cause)));
  }, [message]);

  return <header className={styles.root} data-platform={platform}>
    <div className={styles.dragLayer} data-tauri-drag-region aria-hidden="true" />
    {!nativeDesktop && platform === "macos" && <MacTrafficLights />}
    <div className={styles.brand} aria-hidden="true">
      <img src={appIcon} alt="" />
      <span>cursor-byok</span>
    </div>
    <nav className={styles.navigation} aria-label={t("主菜单")}>
      {pages.map((page) => <NavLink key={page.path} to={page.path} end={page.path === "/"}>
        {page.label}
        {page.dot && <span className={styles.dot} aria-hidden="true" />}
      </NavLink>)}
    </nav>
    <div className={styles.status}>
      {cursorHarness && <NavLink to="/harness/cursor" className={styles.harness} data-taken={taken || undefined}>
        <span className={styles.harnessDot} aria-hidden="true" />
        {taken ? t("Cursor 已接管") : t("Cursor 未接管")}
      </NavLink>}
      <TooltipTrigger label={t("使用教程")}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`${t("使用教程")}${tutorialRead ? "" : `，${t("未读")}`}`}
          onClick={() => setConfirmTutorial(true)}
        >
          <Icon icon={informationOutlineIcon} size="1.15em" />
          {!tutorialRead && <span className={styles.dot} aria-hidden="true" />}
        </button>
      </TooltipTrigger>
      {nativeDesktop && platform !== "macos" && <WindowControls />}
    </div>
    <ConfirmDialog
      id="open-tutorial-dialog"
      open={confirmTutorial}
      title={t("打开使用教程？")}
      cancelLabel={t("取消")}
      confirmLabel={t("打开教程")}
      onCancel={() => setConfirmTutorial(false)}
      onConfirm={openTutorial}
    >
      <p>{t("将在系统浏览器中打开使用教程，是否继续？")}</p>
    </ConfirmDialog>
  </header>;
}
