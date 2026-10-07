import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { currentAppVersion } from "../../shared/native/appLifecycle";
import { Icon } from "../../shared/ui/Icon";
import { githubIcon } from "../../shared/ui/icons";
import styles from "./ProjectFooter.module.scss";

const REPOSITORY_URL = "https://github.com/matXn/Cursor-Kaeru";
const UPSTREAM_URL = "https://github.com/leookun/cursor-byok";
const repositoryName = (url: string) => url.replace("https://github.com/", "");

// The foot of the settings page: where the project lives, its version, and what it is built on.
export function ProjectFooter() {
  const [version, setVersion] = useState("…");
  useEffect(() => { void currentAppVersion().then(setVersion); }, []);

  return <footer className={styles.footer}>
    <button type="button" className={styles.repository} onClick={() => void api.openExternalUrl(REPOSITORY_URL)}>
      <Icon icon={githubIcon} size="1.15em" />{repositoryName(REPOSITORY_URL)}
    </button>
    <small>
      {t("版本 {version}", { version })} · <button type="button" className={styles.credit} onClick={() => void api.openExternalUrl(UPSTREAM_URL)}>
        {t("基于 {project}", { project: repositoryName(UPSTREAM_URL) })}
      </button>
    </small>
  </footer>;
}
