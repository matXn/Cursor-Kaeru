import { useEffect, useState } from "react";
import { currentAppVersion } from "../../shared/native/appLifecycle";
import styles from "./Nameplate.module.scss";

// "UTC+08:00": the offset every day bucket on this page is aligned to.
function utcOffsetLabel(date = new Date()) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

// Stamped plate at the foot of the overview, like the rating plate on the back of a machine.
export function Nameplate() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    let disposed = false;
    void currentAppVersion().then((next) => { if (!disposed) setVersion(next); });
    return () => { disposed = true; };
  }, []);

  return <footer className={styles.root} aria-label="cursor kaeru">
    <span>CURSOR KAERU</span>
    <span>{!version ? "—" : /^\d/.test(version) ? `v${version}` : version.toUpperCase()}</span>
    <span>{utcOffsetLabel()}</span>
  </footer>;
}
