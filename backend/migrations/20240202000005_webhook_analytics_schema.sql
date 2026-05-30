-- Webhook system schema for brand integrations
-- Migration: 20240202000005_webhook_schema.sql

-- Webhook endpoints registered by brands
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up endpoints by brand
CREATE INDEX idx_webhook_endpoints_brand ON webhook_endpoints(brand_id);
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(brand_id) WHERE is_active = true;

-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id BIGINT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status_code INT,
    response_body TEXT,
    attempts INT DEFAULT 1,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up deliveries by endpoint
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries(endpoint_id) WHERE delivered_at IS NULL;

-- Analytics events table (if not already exists)
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT,
    persona_id BIGINT,
    session_id TEXT,
    metadata JSONB,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_persona ON analytics_events(persona_id) WHERE persona_id IS NOT NULL;
CREATE INDEX idx_analytics_events_time ON analytics_events(created_at);

-- Daily aggregated metrics for fast dashboard queries
CREATE TABLE IF NOT EXISTS daily_metrics (
    date DATE PRIMARY KEY,
    total_users BIGINT DEFAULT 0,
    new_users BIGINT DEFAULT 0,
    daily_active BIGINT DEFAULT 0,
    total_signups BIGINT DEFAULT 0,
    waitlist_signups BIGINT DEFAULT 0,
    referral_signups BIGINT DEFAULT 0,
    opportunities_posted BIGINT DEFAULT 0,
    applications_made BIGINT DEFAULT 0,
    deals_completed BIGINT DEFAULT 0,
    gmv BIGINT DEFAULT 0,                    -- in cents
    platform_revenue BIGINT DEFAULT 0,       -- in cents
    referral_rewards BIGINT DEFAULT 0,       -- in cents
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update daily metrics
CREATE OR REPLACE FUNCTION update_daily_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_metrics (date)
    VALUES (DATE(NOW()))
    ON CONFLICT (date) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
    email_opportunities BOOLEAN DEFAULT true,
    email_deals BOOLEAN DEFAULT true,
    email_referrals BOOLEAN DEFAULT true,
    email_level_ups BOOLEAN DEFAULT true,
    email_marketing BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social connections for OAuth verification
CREATE TABLE IF NOT EXISTS social_connections (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,                  -- twitter, instagram, youtube, etc.
    platform_id TEXT NOT NULL,               -- user ID on the platform
    username TEXT NOT NULL,
    display_name TEXT,
    access_token TEXT,                       -- encrypted
    refresh_token TEXT,                      -- encrypted
    token_expires_at TIMESTAMPTZ,
    followers_count BIGINT DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,       -- platform verification (blue check)
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    UNIQUE(persona_id, platform)
);

-- Index for lookups
CREATE INDEX idx_social_connections_persona ON social_connections(persona_id);
CREATE INDEX idx_social_connections_platform ON social_connections(platform, platform_id);

-- Session tracking for analytics
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    persona_id BIGINT,
    ip_hash TEXT,
    user_agent TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    page_views INT DEFAULT 0,
    ended_at TIMESTAMPTZ
);

-- Index for active sessions
CREATE INDEX idx_user_sessions_active ON user_sessions(last_active_at) WHERE ended_at IS NULL;
