import { Icon as IconifyIcon, type IconifyIcon as IconData } from "@iconify/react/offline";
import styles from "./Icon.module.scss";

export interface IconProps {
  icon?: IconData;
  src?: string;
  size?: `${number}em` | `${number}px`;
  className?: string;
}

export function Icon({ icon, src, size = "1em", className }: IconProps) {
  return <div
    aria-hidden="true"
    className={[styles.icon, className].filter(Boolean).join(" ")}
    // A wide icon keeps its proportions: `size` is its height.
    style={{ height: size, width: icon && icon.width && icon.height && icon.width !== icon.height ? `calc(${size} * ${icon.width / icon.height})` : size }}
  >
    {src ? <img alt="" src={src} /> : icon ? <IconifyIcon height="100%" icon={icon} width="100%" /> : null}
  </div>;
}
