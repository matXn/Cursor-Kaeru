-- Providers own where requests go and how they authenticate; models under a provider share
-- them instead of each storing a copy. Existing models are folded into one provider per
-- distinct (protocol, address, key, headers), named after their group name or host.
-- Model hashes do not change: they are built from the same resolved values as before.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE providers (
    provider_id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK(model_type IN ('openai', 'anthropic')),
    base_url TEXT NOT NULL,
    use_full_url INTEGER NOT NULL DEFAULT 0 CHECK(use_full_url IN (0, 1)),
    api_key TEXT NOT NULL,
    openai_endpoint TEXT NOT NULL DEFAULT '',
    custom_headers_enabled INTEGER NOT NULL DEFAULT 0 CHECK(custom_headers_enabled IN (0, 1)),
    custom_headers_json TEXT NOT NULL DEFAULT '{}',
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

INSERT INTO providers (
    provider_id,
    sort_order,
    name,
    model_type,
    base_url,
    use_full_url,
    api_key,
    openai_endpoint,
    custom_headers_enabled,
    custom_headers_json,
    created_at_ms,
    updated_at_ms
)
SELECT
    lower(hex(randomblob(8))),
    MIN(sort_order),
    COALESCE(
        MAX(NULLIF(trim(group_name), '')),
        -- Host of the base URL: drop the scheme, then everything from the first slash.
        CASE
            WHEN instr(substr(base_url, instr(base_url, '://') + 3), '/') > 0
                THEN substr(
                    substr(base_url, instr(base_url, '://') + 3),
                    1,
                    instr(substr(base_url, instr(base_url, '://') + 3), '/') - 1
                )
            ELSE substr(base_url, instr(base_url, '://') + 3)
        END
    ),
    model_type,
    base_url,
    use_full_url,
    api_key,
    openai_endpoint,
    custom_headers_enabled,
    custom_headers_json,
    MIN(created_at_ms),
    MAX(updated_at_ms)
FROM model_configs
GROUP BY model_type, base_url, use_full_url, api_key, openai_endpoint,
    custom_headers_enabled, custom_headers_json;

CREATE TABLE model_configs_new (
    model_hash TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    display_name TEXT NOT NULL,
    tooltip_data TEXT NOT NULL,
    model_id TEXT NOT NULL,
    reasoning_effort TEXT,
    openai_extra_params_enabled INTEGER NOT NULL DEFAULT 0 CHECK(openai_extra_params_enabled IN (0, 1)),
    openai_extra_params_json TEXT NOT NULL DEFAULT '{}',
    anthropic_extra_params_enabled INTEGER NOT NULL DEFAULT 0 CHECK(anthropic_extra_params_enabled IN (0, 1)),
    anthropic_extra_params_json TEXT NOT NULL DEFAULT '{}',
    context_window_tokens INTEGER,
    max_completion_tokens INTEGER,
    anthropic_max_tokens INTEGER,
    anthropic_thinking_effort TEXT,
    thinking_budget_tokens INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

INSERT INTO model_configs_new (
    model_hash,
    provider_id,
    sort_order,
    display_name,
    tooltip_data,
    model_id,
    reasoning_effort,
    openai_extra_params_enabled,
    openai_extra_params_json,
    anthropic_extra_params_enabled,
    anthropic_extra_params_json,
    context_window_tokens,
    max_completion_tokens,
    anthropic_max_tokens,
    anthropic_thinking_effort,
    thinking_budget_tokens,
    created_at_ms,
    updated_at_ms
)
SELECT
    model.model_hash,
    provider.provider_id,
    model.sort_order,
    model.display_name,
    model.tooltip_data,
    model.model_id,
    model.reasoning_effort,
    model.openai_extra_params_enabled,
    model.openai_extra_params_json,
    model.anthropic_extra_params_enabled,
    model.anthropic_extra_params_json,
    model.context_window_tokens,
    model.max_completion_tokens,
    model.anthropic_max_tokens,
    model.anthropic_thinking_effort,
    model.thinking_budget_tokens,
    model.created_at_ms,
    model.updated_at_ms
FROM model_configs AS model
JOIN providers AS provider
    ON provider.model_type = model.model_type
    AND provider.base_url = model.base_url
    AND provider.use_full_url = model.use_full_url
    AND provider.api_key = model.api_key
    AND provider.openai_endpoint = model.openai_endpoint
    AND provider.custom_headers_enabled = model.custom_headers_enabled
    AND provider.custom_headers_json = model.custom_headers_json;

-- Providers left with the same name (one host, several keys or protocols) are told apart
-- by their first model.
UPDATE providers
SET name = name || ' · ' || (
    SELECT model.display_name FROM model_configs_new AS model
    WHERE model.provider_id = providers.provider_id
    ORDER BY model.sort_order, model.display_name
    LIMIT 1
)
WHERE name IN (SELECT name FROM providers GROUP BY name HAVING count(*) > 1);

DROP TABLE model_configs;
ALTER TABLE model_configs_new RENAME TO model_configs;

CREATE INDEX model_configs_provider ON model_configs(provider_id, sort_order);
