// Writes src/pricing/model_prices.json from models.dev (MIT): every model the vendors
// themselves list, with their own per-1M-token prices. Resellers are left out, since their
// prices differ from the vendor's. Run before a release: `node server/scripts/model-prices.mjs`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const output = join(dirname(fileURLToPath(import.meta.url)), "../src/pricing/model_prices.json");

// Vendors, in the order a model ID listed by several of them is priced.
const vendors = ["openai", "anthropic", "google", "xai", "deepseek", "zhipuai", "moonshotai", "alibaba", "minimax", "mistral"];

const response = await fetch("https://models.dev/api.json");
if (!response.ok) throw new Error(`models.dev answered ${response.status}`);
const catalog = await response.json();

const models = [];
for (const vendor of vendors) {
  const listed = catalog[vendor]?.models;
  if (!listed) throw new Error(`models.dev no longer lists ${vendor}`);
  for (const [id, model] of Object.entries(listed)) {
    const cost = model.cost;
    if (typeof cost?.input !== "number" || typeof cost?.output !== "number") continue;
    models.push({
      vendor,
      id,
      input: cost.input,
      output: cost.output,
      cache_read: cost.cache_read ?? null,
      cache_write: cost.cache_write ?? null,
    });
  }
}

writeFileSync(output, `${JSON.stringify({ source: "https://models.dev", fetched: new Date().toISOString().slice(0, 10), models }, null, 1)}\n`);
console.log(`wrote ${models.length} vendor prices to ${output}`);
