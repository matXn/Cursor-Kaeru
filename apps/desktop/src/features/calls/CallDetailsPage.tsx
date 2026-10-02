import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type CallDetail } from "../../shared/api";
import { Icon } from "../../shared/ui/Icon";
import { chevronLeftIcon } from "../../shared/ui/icons";
import { TitledCard } from "../../shared/ui/TitledCard";
import { PageContent } from "../../shell/layout/PageContent";
import { CallDetails } from "./CallDetails";
import styles from "./CallDetailsPage.module.scss";

// One call, opened from the calls page inside the app; back returns to the list as it was.
export function CallDetailsPage() {
  const { callId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    void api.call(callId).then((value) => {
      if (!cancelled) setDetail(value);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const content = error
    ? <TitledCard title={t("无法加载调用详情")}><div style={{ padding: 16 }}>{error}</div></TitledCard>
    : detail
      ? <CallDetails detail={detail} />
      : <TitledCard title={t("调用详情")}><div style={{ padding: 16 }}>{t("正在加载调用详情…")}</div></TitledCard>;
  const title = <div className={styles.title}>
    <button type="button" className={styles.back} onClick={() => navigate("/calls")}>
      <Icon icon={chevronLeftIcon} size="1.1em" />Calls
    </button>
    <h1>{detail?.call.display_name ?? t("调用详情")}</h1>
  </div>;

  return <PageContent title={title} sections={[{ key: callId, estimatedHeight: 900, content }]} />;
}
