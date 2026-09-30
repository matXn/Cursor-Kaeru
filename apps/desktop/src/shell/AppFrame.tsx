import { Outlet } from "react-router-dom";
import { desktopPlatform } from "../shared/native/platform";
import styles from "./AppFrame.module.scss";
import { TopBar } from "./TopBar";

const currentPlatform = desktopPlatform();
document.documentElement.dataset.platform = currentPlatform;

export function AppFrame() {
  const nativeDesktop = "__TAURI_INTERNALS__" in window;

  return (
    <div className={styles.shell}>
      <TopBar platform={currentPlatform} nativeDesktop={nativeDesktop} />
      <Outlet />
    </div>
  );
}
