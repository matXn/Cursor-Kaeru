import { NavLink } from "react-router-dom";
import appIcon from "../shared/assets/logo.svg";
import type { DesktopPlatform } from "../shared/native/platform";
import { Icon } from "../shared/ui/Icon";
import { callsGlyph, modelsGlyph, overviewGlyph, pluginsGlyph, settingsGlyph } from "../shared/ui/glyphs";
import { MacTrafficLights } from "./MacTrafficLights";
import { TakeoverToggle } from "./TakeoverToggle";
import { WindowControls } from "./WindowControls";
import styles from "./TopBar.module.scss";

// Single window-wide bar: drag region, primary navigation, takeover status, window controls.
export function TopBar({ platform, nativeDesktop }: { platform: DesktopPlatform; nativeDesktop: boolean }) {
  const pages = [
    { path: "/", label: t("概览"), glyph: overviewGlyph },
    { path: "/calls", label: t("调用"), glyph: callsGlyph },
    { path: "/harness/cursor", label: t("模型"), glyph: modelsGlyph },
    { path: "/plugins", label: t("插件"), glyph: pluginsGlyph },
    { path: "/settings", label: t("设置"), glyph: settingsGlyph },
  ];

  return <header className={styles.root} data-platform={platform}>
    <div className={styles.dragLayer} data-tauri-drag-region aria-hidden="true" />
    {!nativeDesktop && platform === "macos" && <MacTrafficLights />}
    <img className={styles.icon} src={appIcon} alt="" aria-hidden="true" />
    <nav className={styles.navigation} aria-label={t("主菜单")}>
      {pages.map((page) => <NavLink key={page.path} to={page.path} end={page.path === "/"}><span className={styles.glyph}><Icon icon={page.glyph} size="18px" /></span>{page.label}</NavLink>)}
    </nav>
    <div className={styles.status}>
      <TakeoverToggle />
      {platform !== "macos" && <WindowControls native={nativeDesktop} />}
    </div>
  </header>;
}
