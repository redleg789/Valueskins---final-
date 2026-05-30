-- Brand API Schema — extends brands table with API access features

-- Add API-specific columns to brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS website VARCHAR(500);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_email ON brands(email) WHERE email IS NOT NULL;

-- API keys for brand authentication (B2B API access)
CREATE TABLE IF NOT EXISTS brand_api_keys (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id),
    key_hash VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    permissions TEXT[] DEFAULT '{"read"}',
    rate_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- API request logs for analytics and rate limiting
CREATE TABLE IF NOT EXISTS api_request_logs (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id),
    api_key_id BIGINT REFERENCES brand_api_keys(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks for brands
CREATE TABLE IF NOT EXISTS brand_webhooks (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id),
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(128) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_api_keys_hash ON brand_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_brand_api_keys_brand ON brand_api_keys(brand_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_brand ON api_request_logs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON api_request_logs(created_at DESC);
