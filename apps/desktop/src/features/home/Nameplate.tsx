import { useEffect, useState } from "react";
import { currentAppVersion } from "../../shared/native/appLifecycle";
import styles from "./Nameplate.module.scss";

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
  </footer>;
}
