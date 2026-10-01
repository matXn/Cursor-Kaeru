import type { PluginContext } from "cursor-byok:plugin";
import { parseCredentialFiles, parseQuotaSummary, presentAccount } from "./resources.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function context(requests: string[]): PluginContext["network"] {
  return {
    fetch: async (url, init = {}) => {
      requests.push(`${url}:${init.body ?? ""}`);
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        }),
      };
    },
    stream: () => Promise.reject(new Error("stream is not expected")),
  };
}

Deno.test("imports an array of email and refresh_token credentials", async () => {
  const requests: string[] = [];
  const result = await parseCredentialFiles([
    {
      name: "antigravity.json",
      content: JSON.stringify([
        { email: "teocougar@gmail.com", refresh_token: "refresh-token" },
      ]),
    },
  ], context(requests));

  assert(result.warnings.length === 0, "the credential file should not produce warnings");
  assert(result.credentials.length === 1, "one credential should be imported");
  assert(result.credentials[0].displayName === "teocougar@gmail.com", "email should be used as display name");
  assert(result.credentials[0].accessToken === "access-token", "refresh token should be exchanged for an access token");
  assert(result.credentials[0].refreshToken === "refresh-token", "refresh token should be preserved");
  assert(requests.length === 1, "the refresh token should be exchanged once");
});

// Shape of retrieveUserQuotaSummary as captured from the Antigravity client.
const QUOTA_SUMMARY = {
  groups: [
    {
      displayName: "Gemini Models",
      buckets: [
        { bucketId: "gemini-5h", displayName: "Five Hour Limit Remaining", remainingFraction: 0.9545, resetTime: "2026-10-02T09:00:00Z" },
        { bucketId: "gemini-weekly", displayName: "Weekly Limit Remaining", remainingFraction: 0.62, resetTime: "2026-10-06T00:00:00Z" },
      ],
    },
    {
      displayName: "Claude and GPT models",
      buckets: [
        { bucketId: "3p-5h", remainingFraction: 0.7015, resetTime: "2026-10-02T08:30:00Z" },
        { bucketId: "3p-weekly", remainingFraction: 0.31, resetTime: "2026-10-06T00:00:00Z" },
        { bucketId: "something-else", remainingFraction: 0.5 },
      ],
    },
  ],
};

Deno.test("quota summary yields 5-hour and weekly windows for both model groups", () => {
  const windows = parseQuotaSummary(QUOTA_SUMMARY);
  assert(JSON.stringify(windows.map((w) => [w.group, w.period, w.remainingPercent])) ===
    JSON.stringify([["gemini", "5h", 95], ["gemini", "weekly", 62], ["3p", "5h", 70], ["3p", "weekly", 31]]), JSON.stringify(windows));
  assert(windows[1].resetAtMs === Date.parse("2026-10-06T00:00:00Z"), "weekly reset time");
});

Deno.test("accounts show the four windows, labelled by model group and period", () => {
  const view = presentAccount({
    id: "a",
    privateData: { accessToken: "t", refreshToken: null, displayName: "me@example.com", quota: {
      planLabel: "Google AI Pro", limitReached: false, coolingUntilMs: null, updatedAtMs: 0,
      windows: parseQuotaSummary(QUOTA_SUMMARY),
    } },
  } as never);
  const labels = (view.metrics ?? []).map((metric) => (metric.label as Record<string, string>)["zh-CN"]);
  assert(JSON.stringify(labels) === JSON.stringify(["Gemini 模型 · 5 小时", "Gemini 模型 · 每周", "Claude / GPT 模型 · 5 小时", "Claude / GPT 模型 · 每周"]), JSON.stringify(labels));
});

Deno.test("without a summary, per-model quota is shown under the group names", () => {
  const view = presentAccount({
    id: "a",
    privateData: { accessToken: "t", refreshToken: null, displayName: "me", quota: {
      planLabel: null, limitReached: false, coolingUntilMs: null, updatedAtMs: 0,
      claude: { remainingPercent: 74, resetAtMs: null }, gemini: { remainingPercent: 100, resetAtMs: null }, windows: null,
    } },
  } as never);
  const labels = (view.metrics ?? []).map((metric) => (metric.label as Record<string, string>)["zh-CN"]);
  assert(JSON.stringify(labels) === JSON.stringify(["Gemini 模型", "Claude / GPT 模型"]), JSON.stringify(labels));
});
