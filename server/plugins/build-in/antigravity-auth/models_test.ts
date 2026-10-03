import type { PluginContext } from "cursor-byok:plugin";
import type { ResourceSnapshot } from "cursor-byok:resource";
import { antigravityModels, parseAntigravityModels } from "./models.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const account = {
  id: "account-1",
  displayName: "account",
  status: "active",
  privateData: { accessToken: "access-token", projectId: "project" },
} as unknown as ResourceSnapshot;

function context(status: number, body: unknown): PluginContext {
  return {
    network: {
      fetch: () => Promise.resolve({ status, headers: {}, body: JSON.stringify(body) }),
      stream: () => Promise.reject(new Error("stream is not expected")),
    },
    signal: new AbortController().signal,
  };
}

Deno.test("the catalog is exactly what the account is offered, without internal routes", () => {
  const models = parseAntigravityModels({
    models: {
      "gemini-3.7-flash": { displayName: "Gemini 3.7 Flash", supportsThinking: true },
      "claude-sonnet-4-6": { displayName: "Claude Sonnet 4.6", maxOutputTokens: 32_000 },
      // No display name: an internal route, not a picker model.
      "gemini-3.7-flash-tiered": {},
      tab_flash_lite_preview: {},
      chat_20706: { displayName: "Denied" },
    },
  });
  assert(
    models.map((model) => model.id).join() === "gemini-3.7-flash,claude-sonnet-4-6",
    "only named, non-denied models are listed",
  );
  assert(models[0].privateData !== undefined, "thinking support is carried as private data");
  assert(models[1].maxOutputTokens === 32_000, "the upstream output limit is kept");
});

Deno.test("a failed lookup raises, so a refresh keeps the previous catalog", async () => {
  let failed = false;
  try {
    await antigravityModels.list({ resource: account }, context(500, { error: "down" }));
  } catch (error) {
    failed = String(error).includes("HTTP 500");
  }
  assert(failed, "a server error is raised, not answered with a guess");

  failed = false;
  try {
    await antigravityModels.list({ resource: account }, context(200, { models: {} }));
  } catch (error) {
    failed = String(error).includes("no models");
  }
  assert(failed, "an empty answer is raised, not answered with a guess");
});

Deno.test("a successful lookup returns the account's models", async () => {
  const models = await antigravityModels.list(
    { resource: account },
    context(200, { models: { "gemini-3.7-flash": { displayName: "Gemini 3.7 Flash" } } }),
  );
  assert(models.length === 1 && models[0].id === "gemini-3.7-flash", "the listed model is returned");
});
