import { Icon, type IconProps } from "../../shared/ui/Icon";
import { modelsGlyph } from "../../shared/ui/glyphs";
import { providerLogo } from "../../shared/utils/providerLogo";

/** The provider's monochrome logo, or the neutral model cube when nothing matches. */
export function providerMark(...hints: Array<string | null | undefined>) {
  return providerLogo(...hints) ?? modelsGlyph;
}

export function ProviderLogo({ hints, size = "1em", className }: {
  hints: Array<string | null | undefined>;
  size?: IconProps["size"];
  className?: string;
}) {
  return <Icon icon={providerMark(...hints)} size={size} className={className} />;
}
