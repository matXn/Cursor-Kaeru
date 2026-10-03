//! Vendor prices for models, bundled with each release from models.dev (see
//! `server/scripts/model-prices.mjs`), to estimate what calls would have cost at list price.
use std::{collections::HashMap, sync::OnceLock};

use serde::Deserialize;

/// USD per million tokens.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ModelPrice {
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_write: f64,
}

impl ModelPrice {
    pub fn cost(&self, tokens: &TokenCounts) -> PricedTokens {
        let usd = |count: i64, per_million: f64| count.max(0) as f64 / 1_000_000.0 * per_million;
        PricedTokens {
            input: usd(tokens.input, self.input),
            output: usd(tokens.output, self.output),
            cache_read: usd(tokens.cache_read, self.cache_read),
            cache_write: usd(tokens.cache_write, self.cache_write),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct TokenCounts {
    pub input: i64,
    pub output: i64,
    pub cache_read: i64,
    pub cache_write: i64,
}

/// USD by kind of token.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct PricedTokens {
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_write: f64,
}

/// The vendor price for a model ID as a provider or plugin names it, if the vendor lists it.
pub fn price(model_id: &str) -> Option<ModelPrice> {
    prices().get(&normalize(model_id)).copied()
}

#[derive(Deserialize)]
struct Bundle {
    models: Vec<BundledModel>,
}

#[derive(Deserialize)]
struct BundledModel {
    id: String,
    input: f64,
    output: f64,
    cache_read: Option<f64>,
    cache_write: Option<f64>,
}

fn prices() -> &'static HashMap<String, ModelPrice> {
    static PRICES: OnceLock<HashMap<String, ModelPrice>> = OnceLock::new();
    PRICES.get_or_init(|| {
        let bundle: Bundle = serde_json::from_str(include_str!("model_prices.json"))
            .expect("bundled model prices are valid JSON");
        let mut prices = HashMap::new();
        // The file lists vendors in priority order, so the first entry for an ID wins.
        for model in bundle.models {
            prices.entry(normalize(&model.id)).or_insert(ModelPrice {
                input: model.input,
                output: model.output,
                // A vendor without a cache price bills those tokens as plain input.
                cache_read: model.cache_read.unwrap_or(model.input),
                cache_write: model.cache_write.unwrap_or(model.input),
            });
        }
        prices
    })
}

/// One spelling for a model however it is named: no provider prefix, `.` and `_` as `-`, and
/// no trailing reasoning-effort, mode, release-stage or date suffixes (`gemini-3.8-flash-low`,
/// `claude-opus-4-6-thinking` and `models/gemini-3-flash-preview` find their base model).
fn normalize(model_id: &str) -> String {
    const SUFFIXES: [&str; 10] = [
        "minimal", "low", "medium", "high", "xhigh", "tiered", "thinking", "preview", "latest",
        "exp",
    ];
    let name = model_id.rsplit('/').next().unwrap_or(model_id);
    let mut name = name.to_ascii_lowercase().replace(['.', '_'], "-");
    while let Some((base, last)) = name.rsplit_once('-') {
        let is_date = last.len() == 8 && last.bytes().all(|byte| byte.is_ascii_digit());
        if base.is_empty() || !(SUFFIXES.contains(&last) || is_date) {
            break;
        }
        name.truncate(base.len());
    }
    name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_and_plugin_spellings_find_the_vendor_model() {
        assert_eq!(normalize("gemini-3.8-flash-medium"), "gemini-3-8-flash");
        assert_eq!(normalize("models/gemini-3-flash-preview"), "gemini-3-flash");
        assert_eq!(normalize("claude-opus-4-6-thinking"), "claude-opus-4-6");
        assert_eq!(normalize("claude-sonnet-4-20250514"), "claude-sonnet-4");
        assert_eq!(normalize("DeepSeek-V4.1-Flash"), "deepseek-v4-1-flash");
        // Names that only look like suffixes stay whole.
        assert_eq!(normalize("qwen3-max"), "qwen3-max");
        assert_eq!(normalize("low"), "low");
    }

    #[test]
    fn bundled_prices_cover_the_vendors_and_cost_by_kind() {
        let price = price("claude-opus-4-6-thinking").expect("Anthropic lists Opus 4.6");
        let cost = price.cost(&TokenCounts {
            input: 1_000_000,
            output: 2_000_000,
            cache_read: 0,
            cache_write: 0,
        });
        assert!(cost.input > 0.0 && cost.output > cost.input);
        assert!(super::price("no-such-model-anywhere").is_none());
    }
}
