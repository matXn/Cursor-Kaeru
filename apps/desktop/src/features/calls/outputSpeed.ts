import type { LlmCall } from "../../shared/api";

/**
 * Output tokens per second while the model was producing them: from its first valid response
 * (which already counts reasoning) to the end. Null while running or when the call lacks timing.
 */
export function outputSpeed(call: Pick<LlmCall, "output_tokens" | "duration_ms" | "ttfr_ms" | "ttft_ms">) {
  if (!call.output_tokens || call.duration_ms == null) return null;
  const generatingMs = call.duration_ms - (call.ttfr_ms ?? call.ttft_ms ?? 0);
  return generatingMs > 0 ? call.output_tokens / (generatingMs / 1000) : null;
}

export function formatOutputSpeed(speed: number | null) {
  if (speed == null) return "—";
  return speed >= 100 ? Math.round(speed).toString() : speed.toFixed(1);
}
