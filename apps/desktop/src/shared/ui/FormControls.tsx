import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";
import { TooltipTrigger } from "./TooltipTrigger";
import { eyeIcon, eyeOffIcon, informationOutlineIcon } from "./icons";
import styles from "./FormControls.module.scss";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.input, props.className].filter(Boolean).join(" ")} />;
}

/** A masked field with a show/hide toggle; `actions` are more icon buttons placed beside it. */
export function SecretTextInput({ className, actions, ...props }: InputHTMLAttributes<HTMLInputElement> & { actions?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <div className={styles.secret}>
    <input {...props} type={visible ? "text" : "password"} className={[styles.input, className].filter(Boolean).join(" ")} />
    <span className={styles.trailing}>
      {actions}
      <button type="button" className={styles.trailingButton} aria-label={visible ? t("隐藏敏感内容") : t("显示敏感内容")} onClick={() => setVisible((current) => !current)}>
        <Icon icon={visible ? eyeOffIcon : eyeIcon} size="1.1em" />
      </button>
    </span>
  </div>;
}

/** An icon button for the trailing side of a field. */
export function FieldAction({ label, icon, onClick, disabled }: { label: string; icon: Parameters<typeof Icon>[0]["icon"]; onClick: () => void; disabled?: boolean }) {
  return <TooltipTrigger label={label}>
    <button type="button" className={styles.trailingButton} aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon icon={icon} size="1.05em" />
    </button>
  </TooltipTrigger>;
}

export function FormField({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={[styles.field, className].filter(Boolean).join(" ")}>
    <div className={styles.label}>
      <div>{label}</div>
      {hint && <TooltipTrigger label={hint}><div className={styles.hint}><Icon icon={informationOutlineIcon} size="1.1em" /></div></TooltipTrigger>}
    </div>
    {children}
  </label>;
}
