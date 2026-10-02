//! Provides isolated stores and canonical message fixtures for tests.
#![allow(dead_code)]

use cursor_server::{
    model::{
        CanonicalMessage, ModelConfig, ModelConfigInput, ModelType, Origin, ProviderConfigInput,
        Role,
    },
    store::Store,
};

pub async fn temp_store() -> (tempfile::TempDir, Store) {
    let directory = tempfile::tempdir().unwrap();
    let url = format!("sqlite://{}", directory.path().join("test.db").display());
    let store = Store::connect(&url).await.unwrap();
    (directory, store)
}

pub fn user(id: &str, text: &str) -> CanonicalMessage {
    CanonicalMessage::text(id, Role::User, Origin::User, text)
}

/// A model with its connection written inline, the way tests describe one; saved as a
/// provider with the model under it.
pub struct TestModel {
    pub sort_order: i64,
    pub display_name: String,
    pub model_type: ModelType,
    pub base_url: String,
    pub use_full_url: bool,
    pub api_key: String,
    pub tooltip_data: String,
    pub model_id: String,
    pub reasoning_effort: Option<String>,
    pub openai_endpoint: String,
    pub openai_extra_params_enabled: bool,
    pub openai_extra_params: serde_json::Value,
    pub custom_headers_enabled: bool,
    pub custom_headers: serde_json::Value,
    pub anthropic_extra_params_enabled: bool,
    pub anthropic_extra_params: serde_json::Value,
    pub context_window_tokens: Option<u64>,
    pub max_completion_tokens: Option<u64>,
    pub anthropic_max_tokens: Option<u64>,
    pub anthropic_thinking_effort: Option<String>,
    pub thinking_budget_tokens: Option<u64>,
}

pub trait CreateTestModel {
    fn create_test_model(
        &self,
        model: &TestModel,
    ) -> impl std::future::Future<Output = cursor_server::Result<ModelConfig>>;
}

impl CreateTestModel for Store {
    async fn create_test_model(&self, model: &TestModel) -> cursor_server::Result<ModelConfig> {
        let provider = self
            .create_provider(&ProviderConfigInput {
                sort_order: 0,
                name: "Test Provider".into(),
                model_type: model.model_type,
                base_url: model.base_url.clone(),
                use_full_url: model.use_full_url,
                api_key: model.api_key.clone(),
                openai_endpoint: model.openai_endpoint.clone(),
                custom_headers_enabled: model.custom_headers_enabled,
                custom_headers: model.custom_headers.clone(),
            })
            .await?;
        self.create_model(&ModelConfigInput {
            sort_order: model.sort_order,
            provider_id: provider.provider_id,
            display_name: model.display_name.clone(),
            tooltip_data: model.tooltip_data.clone(),
            model_id: model.model_id.clone(),
            reasoning_effort: model.reasoning_effort.clone(),
            openai_extra_params_enabled: model.openai_extra_params_enabled,
            openai_extra_params: model.openai_extra_params.clone(),
            anthropic_extra_params_enabled: model.anthropic_extra_params_enabled,
            anthropic_extra_params: model.anthropic_extra_params.clone(),
            context_window_tokens: model.context_window_tokens,
            max_completion_tokens: model.max_completion_tokens,
            anthropic_max_tokens: model.anthropic_max_tokens,
            anthropic_thinking_effort: model.anthropic_thinking_effort.clone(),
            thinking_budget_tokens: model.thinking_budget_tokens,
        })
        .await
    }
}
