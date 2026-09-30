import { NavLink } from "react-router-dom";
import appIcon from "../../src-tauri/icons/32x32.png";
import type { DesktopPlatform } from "../shared/native/platform";
import { useAppStore } from "../shared/store/appStore";
import { MacTrafficLights } from "./MacTrafficLights";
import { WindowControls } from "./WindowControls";
import styles from "./TopBar.module.scss";

// Single window-wide bar: drag region, primary navigation, takeover status, window controls.
export function TopBar({ platform, nativeDesktop }: { platform: DesktopPlatform; nativeDesktop: boolean }) {
  const { cursorHarness } = useAppStore();
  const taken = cursorHarness?.settings_applied ?? false;
  const pages = [
    { path: "/", label: t("概览") },
    { path: "/calls", label: t("调用") },
    { path: "/harness/cursor", label: t("模型") },
    { path: "/plugins", label: t("插件") },
    { path: "/settings", label: t("设置") },
  ];

  return <header className={styles.root} data-platform={platform}>
    <div className={styles.dragLayer} data-tauri-drag-region aria-hidden="true" />
    {!nativeDesktop && platform === "macos" && <MacTrafficLights />}
    <img className={styles.icon} src={appIcon} alt="" aria-hidden="true" />
    <nav className={styles.navigation} aria-label={t("主菜单")}>
      {pages.map((page) => <NavLink key={page.path} to={page.path} end={page.path === "/"}>{page.label}</NavLink>)}
    </nav>
    <div className={styles.status}>
      {cursorHarness && <NavLink to="/harness/cursor" className={styles.harness} data-taken={taken || undefined}>
        <span className={styles.harnessDot} aria-hidden="true" />
        {taken ? t("cursor kaeru 已接管") : t("cursor kaeru 未接管")}
      </NavLink>}
      {platform !== "macos" && <WindowControls native={nativeDesktop} />}
    </div>
  </header>;
}
