import type { IconifyIcon } from "@iconify/react";
import { providerLogos, type ProviderLogoKey } from "../ui/providerLogos";

// First rule with a hint found in the haystack wins, so specific brands (Kimi, Doubao) come
// before the clouds that host them (Moonshot, Volcengine), and clouds before generic words.
const rules: Array<[ProviderLogoKey, string[]]> = [
  ["claude", ["claude"]],
  ["anthropic", ["anthropic"]],
  ["openai", ["openai", "chatgpt", "codex", "gpt-", "o3-", "o4-"]],
  ["gemini", ["gemini", "antigravity", "aistudio", "generativelanguage"]],
  ["google", ["googleapis", "vertex", "google"]],
  ["deepseek", ["deepseek"]],
  ["xai", ["x.ai", "xai", "grok"]],
  ["kimi", ["kimi"]],
  ["moonshot", ["moonshot"]],
  ["qwen", ["qwen", "dashscope", "bailian", "tongyi"]],
  ["alibabacloud", ["aliyun", "alibaba"]],
  ["zhipu", ["bigmodel", "zhipu", "glm", "z.ai", "chatglm"]],
  ["doubao", ["doubao"]],
  ["volcengine", ["volces", "volcengine", "huoshan"]],
  ["minimax", ["minimax", "abab"]],
  ["mistral", ["mistral", "codestral"]],
  ["openrouter", ["openrouter"]],
  ["ollama", ["ollama", ":11434"]],
  ["lmstudio", ["lmstudio", "lm-studio"]],
  ["huggingface", ["huggingface", "hf.co"]],
  ["perplexity", ["perplexity", "sonar"]],
  ["stepfun", ["stepfun", "step-"]],
  ["baichuan", ["baichuan"]],
  ["hunyuan", ["hunyuan", "tencent"]],
  ["baidu", ["baidu", "qianfan", "ernie", "wenxin"]],
  ["nvidia", ["nvidia", "nim."]],
  ["azure", ["azure"]],
  ["aws", ["bedrock", "amazonaws"]],
  ["cloudflare", ["cloudflare", "workers.ai"]],
  ["githubcopilot", ["githubcopilot", "copilot"]],
];

/**
 * The monochrome logo for a provider, matched by name, address or model IDs (in that
 * order of trust). Null when nothing matches; callers draw their own neutral mark.
 */
export function providerLogo(...hints: Array<string | null | undefined>): IconifyIcon | null {
  for (const hint of hints) {
    const haystack = hint?.trim().toLowerCase();
    if (!haystack) continue;
    const rule = rules.find(([, needles]) => needles.some((needle) => haystack.includes(needle)));
    if (rule) return providerLogos[rule[0]];
  }
  return null;
}
