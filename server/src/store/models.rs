//! Persists providers and the models under them.
use std::{collections::HashSet, str::FromStr};

use sqlx::{Row, Sqlite, Transaction};

use crate::{
    model::{
        model_hash, normalize_model_input, normalize_provider_input, ModelConfig, ModelConfigInput,
        ModelType, ProviderConfig, ProviderConfigInput,
    },
    Error, Result,
};

use super::{now_ms, Store};

const PROVIDER_COLUMNS: &str = r#"
    provider_id, sort_order, name, model_type, base_url, use_full_url, api_key,
    openai_endpoint, custom_headers_enabled, custom_headers_json, created_at_ms, updated_at_ms
"#;

/// A model row joined with its provider: the resolved view the runtime reads.
const MODEL_SELECT: &str = r#"
    SELECT
        model.model_hash, model.provider_id, provider.name AS provider_name, model.enabled,
        model.sort_order,
        model.display_name, provider.model_type, provider.base_url, provider.use_full_url,
        provider.api_key, model.tooltip_data, model.model_id, model.reasoning_effort,
        provider.openai_endpoint, model.openai_extra_params_enabled,
        model.openai_extra_params_json, provider.custom_headers_enabled,
        provider.custom_headers_json, model.anthropic_extra_params_enabled,
        model.anthropic_extra_params_json, model.context_window_tokens,
        model.max_completion_tokens, model.anthropic_max_tokens,
        model.anthropic_thinking_effort, model.thinking_budget_tokens, model.created_at_ms,
        model.updated_at_ms
    FROM model_configs AS model
    JOIN providers AS provider ON provider.provider_id = model.provider_id
"#;

const MODEL_ORDER: &str =
    "ORDER BY provider.sort_order, provider.name, model.sort_order, model.display_name";

impl Store {
    // ---- Providers ------------------------------------------------------------------

    pub async fn providers(&self) -> Result<Vec<ProviderConfig>> {
        let query = format!("SELECT {PROVIDER_COLUMNS} FROM providers ORDER BY sort_order, name");
        sqlx::query(&query)
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(provider_from_row)
            .collect()
    }

    pub async fn provider(&self, provider_id: &str) -> Result<Option<ProviderConfig>> {
        let query = format!("SELECT {PROVIDER_COLUMNS} FROM providers WHERE provider_id = ?");
        sqlx::query(&query)
            .bind(provider_id)
            .fetch_optional(&self.pool)
            .await?
            .map(provider_from_row)
            .transpose()
    }

    pub async fn create_provider(&self, input: &ProviderConfigInput) -> Result<ProviderConfig> {
        let input = normalize_provider_input(input)?;
        let provider_id = new_provider_id();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        insert_provider(&mut transaction, &provider_id, &input, now_ms()).await?;
        transaction.commit().await?;
        Ok(self
            .provider(&provider_id)
            .await?
            .expect("inserted provider must exist"))
    }

    /// Saves a provider and re-derives the identity of every model under it, since the
    /// address and key are part of that identity. Call history follows each model to its
    /// new identity.
    pub async fn update_provider(
        &self,
        provider_id: &str,
        input: &ProviderConfigInput,
    ) -> Result<ProviderConfig> {
        let input = normalize_provider_input(input)?;
        let models = self.provider_model_inputs(provider_id).await?;
        let now = now_ms();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query(
            r#"UPDATE providers SET
                sort_order = ?, name = ?, model_type = ?, base_url = ?, use_full_url = ?,
                api_key = ?, openai_endpoint = ?, custom_headers_enabled = ?,
                custom_headers_json = ?, updated_at_ms = ?
            WHERE provider_id = ?"#,
        )
        .bind(input.sort_order)
        .bind(&input.name)
        .bind(input.model_type.as_str())
        .bind(&input.base_url)
        .bind(input.use_full_url)
        .bind(&input.api_key)
        .bind(&input.openai_endpoint)
        .bind(input.custom_headers_enabled)
        .bind(serde_json::to_string(&input.custom_headers)?)
        .bind(now)
        .bind(provider_id)
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() != 1 {
            return Err(Error::RunNotFound(format!("provider {provider_id}")));
        }
        let mut hashes = HashSet::with_capacity(models.len());
        for (current_hash, model) in &models {
            // The protocol may have changed: options for the other one are dropped.
            let model = normalize_model_input(model, input.model_type)?;
            let next_hash = model_hash(&input, &model)?;
            if !hashes.insert(next_hash.clone()) {
                return Err(Error::Config("model configurations must be unique".into()));
            }
            write_model(&mut transaction, current_hash, &next_hash, &model, now).await?;
        }
        transaction.commit().await?;
        Ok(self
            .provider(provider_id)
            .await?
            .expect("updated provider must exist"))
    }

    /// Removes a provider with all its models; their calls stay in the log, unlinked.
    pub async fn delete_provider(&self, provider_id: &str) -> Result<()> {
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            "UPDATE llm_calls SET model_hash = NULL
             WHERE model_hash IN (SELECT model_hash FROM model_configs WHERE provider_id = ?)",
        )
        .bind(provider_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("DELETE FROM model_configs WHERE provider_id = ?")
            .bind(provider_id)
            .execute(&mut *transaction)
            .await?;
        let result = sqlx::query("DELETE FROM providers WHERE provider_id = ?")
            .bind(provider_id)
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() != 1 {
            return Err(Error::RunNotFound(format!("provider {provider_id}")));
        }
        transaction.commit().await?;
        Ok(())
    }

    pub async fn reorder_providers(&self, provider_ids: &[String]) -> Result<Vec<ProviderConfig>> {
        let current = self.providers().await?;
        let current_ids = current
            .iter()
            .map(|provider| provider.provider_id.as_str())
            .collect::<HashSet<_>>();
        let requested_ids = provider_ids
            .iter()
            .map(String::as_str)
            .collect::<HashSet<_>>();
        if provider_ids.len() != current.len() || requested_ids != current_ids {
            return Err(Error::Config(
                "providers changed; refresh and try sorting again".into(),
            ));
        }
        let now = now_ms();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        for (index, provider_id) in provider_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE providers SET sort_order = ?, updated_at_ms = ? WHERE provider_id = ?",
            )
            .bind(i64::try_from(index + 1).expect("provider order fits in i64"))
            .bind(now)
            .bind(provider_id)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        self.providers().await
    }

    // ---- Models ---------------------------------------------------------------------

    pub async fn models(&self) -> Result<Vec<ModelConfig>> {
        sqlx::query(&format!("{MODEL_SELECT} {MODEL_ORDER}"))
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(model_from_row)
            .collect()
    }

    pub async fn model(&self, hash: &str) -> Result<Option<ModelConfig>> {
        sqlx::query(&format!("{MODEL_SELECT} WHERE model.model_hash = ?"))
            .bind(hash)
            .fetch_optional(&self.pool)
            .await?
            .map(model_from_row)
            .transpose()
    }

    pub async fn create_model(&self, input: &ModelConfigInput) -> Result<ModelConfig> {
        let mut models = self.create_models(std::slice::from_ref(input)).await?;
        Ok(models.remove(0))
    }

    pub async fn create_models(&self, inputs: &[ModelConfigInput]) -> Result<Vec<ModelConfig>> {
        if inputs.is_empty() {
            return Err(Error::Config("at least one model is required".into()));
        }
        let normalized = self.resolve_models(inputs, false).await?;
        let now = now_ms();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        for (hash, input) in &normalized {
            insert_model(&mut transaction, hash, input, now, false).await?;
        }
        transaction.commit().await?;

        let mut saved = Vec::with_capacity(normalized.len());
        for (hash, _) in normalized {
            saved.push(self.model(&hash).await?.expect("inserted model must exist"));
        }
        Ok(saved)
    }

    /// Imports models, each with the provider it was configured against: a provider with the
    /// same address, key and headers is reused, otherwise one is created. Models already
    /// present are skipped. Returns how many models were added.
    pub(super) async fn import_models(
        &self,
        entries: &[(ProviderConfigInput, ModelConfigInput)],
    ) -> Result<usize> {
        let mut inputs = Vec::with_capacity(entries.len());
        for (provider, model) in entries {
            let provider = normalize_provider_input(provider)?;
            let provider_id = match self.matching_provider(&provider).await? {
                Some(existing) => existing.provider_id,
                None => self.create_provider(&provider).await?.provider_id,
            };
            inputs.push(ModelConfigInput {
                provider_id,
                ..model.clone()
            });
        }
        let normalized = self.resolve_models(&inputs, true).await?;
        let now = now_ms();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        let mut inserted = 0;
        for (hash, input) in &normalized {
            inserted += usize::from(insert_model(&mut transaction, hash, input, now, true).await?);
        }
        transaction.commit().await?;
        Ok(inserted)
    }

    pub async fn update_model(
        &self,
        current_hash: &str,
        input: &ModelConfigInput,
    ) -> Result<ModelConfig> {
        self.model(current_hash)
            .await?
            .ok_or_else(|| Error::RunNotFound(format!("model {current_hash}")))?;
        let (next_hash, input) = self
            .resolve_models(std::slice::from_ref(input), false)
            .await?
            .remove(0);
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        write_model(&mut transaction, current_hash, &next_hash, &input, now_ms()).await?;
        transaction.commit().await?;
        Ok(self
            .model(&next_hash)
            .await?
            .expect("updated model must exist"))
    }

    pub async fn delete_model(&self, hash: &str) -> Result<()> {
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        sqlx::query("UPDATE llm_calls SET model_hash = NULL WHERE model_hash = ?")
            .bind(hash)
            .execute(&mut *transaction)
            .await?;
        let result = sqlx::query("DELETE FROM model_configs WHERE model_hash = ?")
            .bind(hash)
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() != 1 {
            return Err(Error::RunNotFound(format!("model {hash}")));
        }
        transaction.commit().await?;
        Ok(())
    }

    /// Switches a model on or off for Cursor; its configuration and identity stay as they are.
    pub async fn set_model_enabled(&self, hash: &str, enabled: bool) -> Result<ModelConfig> {
        let _write = self.writes.lock().await;
        let result = sqlx::query(
            "UPDATE model_configs SET enabled = ?, updated_at_ms = ? WHERE model_hash = ?",
        )
        .bind(enabled)
        .bind(now_ms())
        .bind(hash)
        .execute(&self.pool)
        .await?;
        if result.rows_affected() != 1 {
            return Err(Error::RunNotFound(format!("model {hash}")));
        }
        drop(_write);
        Ok(self.model(hash).await?.expect("updated model must exist"))
    }

    /// Orders models among their siblings; providers keep their own order.
    pub async fn reorder_models(&self, model_hashes: &[String]) -> Result<Vec<ModelConfig>> {
        let current = self.models().await?;
        let current_hashes = current
            .iter()
            .map(|model| model.model_hash.as_str())
            .collect::<HashSet<_>>();
        let requested_hashes = model_hashes
            .iter()
            .map(String::as_str)
            .collect::<HashSet<_>>();
        if model_hashes.len() != current.len()
            || requested_hashes.len() != current.len()
            || requested_hashes != current_hashes
        {
            return Err(Error::Config(
                "model configuration changed; refresh and try sorting again".into(),
            ));
        }

        let now = now_ms();
        let _write = self.writes.lock().await;
        let mut transaction = self.pool.begin().await?;
        for (index, hash) in model_hashes.iter().enumerate() {
            sqlx::query(
                "UPDATE model_configs SET sort_order = ?, updated_at_ms = ? WHERE model_hash = ?",
            )
            .bind(i64::try_from(index + 1).expect("model order fits in i64"))
            .bind(now)
            .bind(hash)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        self.models().await
    }

    /// Normalizes models against their providers and derives their hashes. Duplicates are
    /// an error, or dropped when `skip_duplicates` is set.
    async fn resolve_models(
        &self,
        inputs: &[ModelConfigInput],
        skip_duplicates: bool,
    ) -> Result<Vec<(String, ModelConfigInput)>> {
        let mut resolved = Vec::with_capacity(inputs.len());
        let mut hashes = HashSet::with_capacity(inputs.len());
        for input in inputs {
            let provider = self
                .provider(input.provider_id.trim())
                .await?
                .ok_or_else(|| Error::Config(format!("unknown provider {}", input.provider_id)))?
                .input();
            let input = normalize_model_input(input, provider.model_type)?;
            let hash = model_hash(&provider, &input)?;
            if !hashes.insert(hash.clone()) {
                if skip_duplicates {
                    continue;
                }
                return Err(Error::Config("model configurations must be unique".into()));
            }
            resolved.push((hash, input));
        }
        Ok(resolved)
    }

    async fn matching_provider(
        &self,
        input: &ProviderConfigInput,
    ) -> Result<Option<ProviderConfig>> {
        let headers = serde_json::to_string(&input.custom_headers)?;
        Ok(self.providers().await?.into_iter().find(|provider| {
            provider.model_type == input.model_type
                && provider.base_url == input.base_url
                && provider.use_full_url == input.use_full_url
                && provider.api_key == input.api_key
                && provider.openai_endpoint == input.openai_endpoint
                && provider.custom_headers_enabled == input.custom_headers_enabled
                && serde_json::to_string(&provider.custom_headers)
                    .ok()
                    .as_deref()
                    == Some(headers.as_str())
        }))
    }

    /// Each model under a provider, by its current hash, as an input to save again.
    async fn provider_model_inputs(
        &self,
        provider_id: &str,
    ) -> Result<Vec<(String, ModelConfigInput)>> {
        Ok(self
            .models()
            .await?
            .into_iter()
            .filter(|model| model.provider_id == provider_id)
            .map(|model| (model.model_hash.clone(), model.input()))
            .collect())
    }
}

impl ModelConfig {
    pub fn input(&self) -> ModelConfigInput {
        ModelConfigInput {
            sort_order: self.sort_order,
            provider_id: self.provider_id.clone(),
            display_name: self.display_name.clone(),
            tooltip_data: self.tooltip_data.clone(),
            model_id: self.model_id.clone(),
            reasoning_effort: self.reasoning_effort.clone(),
            openai_extra_params_enabled: self.openai_extra_params_enabled,
            openai_extra_params: self.openai_extra_params.clone(),
            anthropic_extra_params_enabled: self.anthropic_extra_params_enabled,
            anthropic_extra_params: self.anthropic_extra_params.clone(),
            context_window_tokens: self.context_window_tokens,
            max_completion_tokens: self.max_completion_tokens,
            anthropic_max_tokens: self.anthropic_max_tokens,
            anthropic_thinking_effort: self.anthropic_thinking_effort.clone(),
            thinking_budget_tokens: self.thinking_budget_tokens,
        }
    }
}

fn new_provider_id() -> String {
    hex::encode(&uuid::Uuid::new_v4().as_bytes()[..8])
}

async fn insert_provider(
    transaction: &mut Transaction<'_, Sqlite>,
    provider_id: &str,
    input: &ProviderConfigInput,
    now: i64,
) -> Result<()> {
    sqlx::query(
        r#"INSERT INTO providers(
            provider_id, sort_order, name, model_type, base_url, use_full_url, api_key,
            openai_endpoint, custom_headers_enabled, custom_headers_json, created_at_ms,
            updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(provider_id)
    .bind(input.sort_order)
    .bind(&input.name)
    .bind(input.model_type.as_str())
    .bind(&input.base_url)
    .bind(input.use_full_url)
    .bind(&input.api_key)
    .bind(&input.openai_endpoint)
    .bind(input.custom_headers_enabled)
    .bind(serde_json::to_string(&input.custom_headers)?)
    .bind(now)
    .bind(now)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn insert_model(
    transaction: &mut Transaction<'_, Sqlite>,
    hash: &str,
    input: &ModelConfigInput,
    now: i64,
    ignore_existing: bool,
) -> Result<bool> {
    let mut statement = String::from(
        r#"INSERT INTO model_configs(
            model_hash, provider_id, sort_order, display_name, tooltip_data, model_id,
            reasoning_effort, openai_extra_params_enabled, openai_extra_params_json,
            anthropic_extra_params_enabled, anthropic_extra_params_json, context_window_tokens,
            max_completion_tokens, anthropic_max_tokens, anthropic_thinking_effort,
            thinking_budget_tokens, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    );
    if ignore_existing {
        statement.push_str(" ON CONFLICT(model_hash) DO NOTHING");
    }
    let result = sqlx::query(&statement)
        .bind(hash)
        .bind(&input.provider_id)
        .bind(input.sort_order)
        .bind(&input.display_name)
        .bind(&input.tooltip_data)
        .bind(&input.model_id)
        .bind(&input.reasoning_effort)
        .bind(input.openai_extra_params_enabled)
        .bind(serde_json::to_string(&input.openai_extra_params)?)
        .bind(input.anthropic_extra_params_enabled)
        .bind(serde_json::to_string(&input.anthropic_extra_params)?)
        .bind(input.context_window_tokens.map(to_i64).transpose()?)
        .bind(input.max_completion_tokens.map(to_i64).transpose()?)
        .bind(input.anthropic_max_tokens.map(to_i64).transpose()?)
        .bind(&input.anthropic_thinking_effort)
        .bind(input.thinking_budget_tokens.map(to_i64).transpose()?)
        .bind(now)
        .bind(now)
        .execute(&mut **transaction)
        .await?;
    Ok(result.rows_affected() == 1)
}

/// Rewrites a model row, moving it to `next_hash` when its identity changed. Its calls in
/// the log follow it, so editing a model or its provider keeps the history attached.
async fn write_model(
    transaction: &mut Transaction<'_, Sqlite>,
    current_hash: &str,
    next_hash: &str,
    input: &ModelConfigInput,
    now: i64,
) -> Result<()> {
    if next_hash != current_hash {
        sqlx::query("UPDATE llm_calls SET model_hash = ? WHERE model_hash = ?")
            .bind(next_hash)
            .bind(current_hash)
            .execute(&mut **transaction)
            .await?;
    }
    let result = sqlx::query(
        r#"UPDATE model_configs SET
            model_hash = ?, provider_id = ?, sort_order = ?, display_name = ?, tooltip_data = ?,
            model_id = ?, reasoning_effort = ?, openai_extra_params_enabled = ?,
            openai_extra_params_json = ?, anthropic_extra_params_enabled = ?,
            anthropic_extra_params_json = ?, context_window_tokens = ?, max_completion_tokens = ?,
            anthropic_max_tokens = ?, anthropic_thinking_effort = ?, thinking_budget_tokens = ?,
            updated_at_ms = ?
        WHERE model_hash = ?"#,
    )
    .bind(next_hash)
    .bind(&input.provider_id)
    .bind(input.sort_order)
    .bind(&input.display_name)
    .bind(&input.tooltip_data)
    .bind(&input.model_id)
    .bind(&input.reasoning_effort)
    .bind(input.openai_extra_params_enabled)
    .bind(serde_json::to_string(&input.openai_extra_params)?)
    .bind(input.anthropic_extra_params_enabled)
    .bind(serde_json::to_string(&input.anthropic_extra_params)?)
    .bind(input.context_window_tokens.map(to_i64).transpose()?)
    .bind(input.max_completion_tokens.map(to_i64).transpose()?)
    .bind(input.anthropic_max_tokens.map(to_i64).transpose()?)
    .bind(&input.anthropic_thinking_effort)
    .bind(input.thinking_budget_tokens.map(to_i64).transpose()?)
    .bind(now)
    .bind(current_hash)
    .execute(&mut **transaction)
    .await?;
    if result.rows_affected() != 1 {
        return Err(Error::RunNotFound(format!("model {current_hash}")));
    }
    Ok(())
}

fn provider_from_row(row: sqlx::sqlite::SqliteRow) -> Result<ProviderConfig> {
    Ok(ProviderConfig {
        provider_id: row.try_get("provider_id")?,
        sort_order: row.try_get("sort_order")?,
        name: row.try_get("name")?,
        model_type: ModelType::from_str(row.try_get("model_type")?)?,
        base_url: row.try_get("base_url")?,
        use_full_url: row.try_get("use_full_url")?,
        api_key: row.try_get("api_key")?,
        openai_endpoint: row.try_get("openai_endpoint")?,
        custom_headers_enabled: row.try_get("custom_headers_enabled")?,
        custom_headers: serde_json::from_str(
            row.try_get::<String, _>("custom_headers_json")?.as_str(),
        )?,
        created_at_ms: row.try_get("created_at_ms")?,
        updated_at_ms: row.try_get("updated_at_ms")?,
    })
}

fn model_from_row(row: sqlx::sqlite::SqliteRow) -> Result<ModelConfig> {
    Ok(ModelConfig {
        model_hash: row.try_get("model_hash")?,
        provider_id: row.try_get("provider_id")?,
        provider_name: row.try_get("provider_name")?,
        enabled: row.try_get("enabled")?,
        sort_order: row.try_get("sort_order")?,
        display_name: row.try_get("display_name")?,
        model_type: ModelType::from_str(row.try_get("model_type")?)?,
        base_url: row.try_get("base_url")?,
        use_full_url: row.try_get("use_full_url")?,
        api_key: row.try_get("api_key")?,
        tooltip_data: row.try_get("tooltip_data")?,
        model_id: row.try_get("model_id")?,
        reasoning_effort: row.try_get("reasoning_effort")?,
        openai_endpoint: row.try_get("openai_endpoint")?,
        openai_extra_params_enabled: row.try_get("openai_extra_params_enabled")?,
        openai_extra_params: serde_json::from_str(
            row.try_get::<String, _>("openai_extra_params_json")?
                .as_str(),
        )?,
        custom_headers_enabled: row.try_get("custom_headers_enabled")?,
        custom_headers: serde_json::from_str(
            row.try_get::<String, _>("custom_headers_json")?.as_str(),
        )?,
        anthropic_extra_params_enabled: row.try_get("anthropic_extra_params_enabled")?,
        anthropic_extra_params: serde_json::from_str(
            row.try_get::<String, _>("anthropic_extra_params_json")?
                .as_str(),
        )?,
        context_window_tokens: optional_u64(&row, "context_window_tokens")?,
        max_completion_tokens: optional_u64(&row, "max_completion_tokens")?,
        anthropic_max_tokens: optional_u64(&row, "anthropic_max_tokens")?,
        anthropic_thinking_effort: row.try_get("anthropic_thinking_effort")?,
        thinking_budget_tokens: optional_u64(&row, "thinking_budget_tokens")?,
        created_at_ms: row.try_get("created_at_ms")?,
        updated_at_ms: row.try_get("updated_at_ms")?,
    })
}

fn optional_u64(row: &sqlx::sqlite::SqliteRow, column: &str) -> Result<Option<u64>> {
    row.try_get::<Option<i64>, _>(column)?
        .map(|value| {
            u64::try_from(value).map_err(|_| Error::Config(format!("{column} cannot be negative")))
        })
        .transpose()
}

fn to_i64(value: u64) -> Result<i64> {
    i64::try_from(value).map_err(|_| Error::Config("token value is too large".into()))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn provider_input(name: &str, api_key: &str) -> ProviderConfigInput {
        ProviderConfigInput {
            sort_order: 0,
            name: name.into(),
            model_type: ModelType::OpenAi,
            base_url: "https://example.com/v1/chat/completions".into(),
            use_full_url: true,
            api_key: api_key.into(),
            openai_endpoint: crate::model::OPENAI_CHAT_ENDPOINT.into(),
            custom_headers_enabled: false,
            custom_headers: serde_json::json!({}),
        }
    }

    pub(crate) fn model_input(provider_id: &str, model_id: &str) -> ModelConfigInput {
        ModelConfigInput {
            sort_order: 0,
            provider_id: provider_id.into(),
            display_name: model_id.into(),
            tooltip_data: model_id.into(),
            model_id: model_id.into(),
            reasoning_effort: None,
            openai_extra_params_enabled: false,
            openai_extra_params: serde_json::json!({}),
            anthropic_extra_params_enabled: false,
            anthropic_extra_params: serde_json::json!({}),
            context_window_tokens: None,
            max_completion_tokens: None,
            anthropic_max_tokens: None,
            anthropic_thinking_effort: None,
            thinking_budget_tokens: None,
        }
    }

    async fn store() -> (tempfile::TempDir, Store) {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::connect(&format!(
            "sqlite://{}",
            directory.path().join("test.db").display()
        ))
        .await
        .unwrap();
        (directory, store)
    }

    /// 一个服务商下的多个模型共用地址和 Key;读取时每个模型都带着服务商的连接信息。
    #[tokio::test]
    async fn models_share_their_provider_connection() {
        let (_directory, store) = store().await;
        let provider = store
            .create_provider(&provider_input("  Example  ", "key-1"))
            .await
            .unwrap();
        assert_eq!(provider.name, "Example");
        let models = store
            .create_models(&[
                model_input(&provider.provider_id, "model-a"),
                model_input(&provider.provider_id, "model-b"),
            ])
            .await
            .unwrap();
        assert_eq!(models.len(), 2);
        for model in &models {
            assert_eq!(model.provider_name, "Example");
            assert_eq!(model.api_key, "key-1");
            assert_eq!(model.base_url, "https://example.com/v1/chat/completions");
        }
        assert_ne!(models[0].model_hash, models[1].model_hash);
    }

    /// 改服务商的 Key 会改变其下所有模型的身份;调用记录跟着模型走,不会断开。
    #[tokio::test]
    async fn provider_changes_rehash_models_and_keep_their_calls() {
        let (_directory, store) = store().await;
        let provider = store
            .create_provider(&provider_input("Example", "key-1"))
            .await
            .unwrap();
        let model = store
            .create_model(&model_input(&provider.provider_id, "model-a"))
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO llm_calls (call_id, run_id, conversation_id, provider_call_index,
                model_hash, provider_type, provider_url, request_type, request_url, model_id,
                display_name, status, created_at_ms, message_count, tool_count, detailed)
             VALUES ('call', 'run', 'conversation', 0, ?, 'openai-chat', 'u', 'openai-chat',
                'u', 'model-a', 'model-a', 'completed', 0, 1, 0, 0)",
        )
        .bind(&model.model_hash)
        .execute(&store.pool)
        .await
        .unwrap();

        store
            .update_provider(&provider.provider_id, &provider_input("Example", "key-2"))
            .await
            .unwrap();
        let moved = store.models().await.unwrap().remove(0);
        assert_ne!(moved.model_hash, model.model_hash);
        assert_eq!(moved.api_key, "key-2");
        let call_hash: Option<String> =
            sqlx::query_scalar("SELECT model_hash FROM llm_calls WHERE call_id = 'call'")
                .fetch_one(&store.pool)
                .await
                .unwrap();
        assert_eq!(call_hash.as_deref(), Some(moved.model_hash.as_str()));
    }

    /// 删除服务商时其下模型一并删除。
    #[tokio::test]
    async fn deleting_a_provider_removes_its_models() {
        let (_directory, store) = store().await;
        let kept = store
            .create_provider(&provider_input("Kept", "key-1"))
            .await
            .unwrap();
        let removed = store
            .create_provider(&provider_input("Removed", "key-2"))
            .await
            .unwrap();
        store
            .create_model(&model_input(&kept.provider_id, "model-a"))
            .await
            .unwrap();
        store
            .create_model(&model_input(&removed.provider_id, "model-b"))
            .await
            .unwrap();

        store.delete_provider(&removed.provider_id).await.unwrap();
        let models = store.models().await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].provider_id, kept.provider_id);
        assert_eq!(store.providers().await.unwrap().len(), 1);
    }

    /// 导入时连接信息相同的模型归入同一个服务商。
    #[tokio::test]
    async fn import_reuses_a_provider_with_the_same_connection() {
        let (_directory, store) = store().await;
        let inserted = store
            .import_models(&[
                (
                    provider_input("Example", "key-1"),
                    model_input("", "model-a"),
                ),
                (
                    provider_input("Example", "key-1"),
                    model_input("", "model-b"),
                ),
                (provider_input("Other", "key-2"), model_input("", "model-c")),
            ])
            .await
            .unwrap();
        assert_eq!(inserted, 3);
        assert_eq!(store.providers().await.unwrap().len(), 2);
    }
}
