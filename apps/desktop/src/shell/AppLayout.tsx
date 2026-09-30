import { useState } from "react";
import KeepAliveRouteOutlet from "keepalive-for-react-router";
import { useLocation } from "react-router-dom";
import { PageLayout } from "./layout/PageLayout";
import controls from "../shared/ui/Controls.module.scss";
import { Icon } from "../shared/ui/Icon";
import { TooltipTrigger } from "../shared/ui/TooltipTrigger";
import { refreshIcon } from "../shared/ui/icons";
import { appStore, useAppStore } from "../shared/store/appStore";
import styles from "./AppLayout.module.scss";
import { PageActionsTarget } from "./PageActions";

const keptAlivePages = ["/", "/calls", "/settings", "/harness/cursor", "/plugins"];

// Page area below the top bar: the page title row's action slots plus the kept-alive page.
export function AppLayout() {
  const { busy } = useAppStore();
  const location = useLocation();
  const [leftActionTarget, setLeftActionTarget] = useState<HTMLDivElement | null>(null);
  const [rightActionTarget, setRightActionTarget] = useState<HTMLDivElement | null>(null);

  return <PageLayout className={styles.root}>
    <main className={styles.content}>
      <div className={styles.actionRegion}>
        <div ref={setLeftActionTarget} className={styles.pageActions} />
        {location.pathname !== "/" && <TooltipTrigger label={t("刷新")}><button className={controls.iconButton} aria-label={t("刷新")} disabled={busy} onClick={() => void appStore.refresh()}>
          <Icon className={busy ? controls.spin : ""} icon={refreshIcon} size="1.1em" />
        </button></TooltipTrigger>}
        <div ref={setRightActionTarget} className={styles.pageActions} />
      </div>
      <PageActionsTarget.Provider value={{ left: leftActionTarget, right: rightActionTarget }}>
        <KeepAliveRouteOutlet
          activeCacheKey={location.pathname}
          include={keptAlivePages}
          max={keptAlivePages.length}
          enableActivity
          containerClassName={styles.keepAliveContainer}
          cacheNodeClassName={styles.keepAlivePage}
        />
      </PageActionsTarget.Provider>
    </main>
  </PageLayout>;
}
