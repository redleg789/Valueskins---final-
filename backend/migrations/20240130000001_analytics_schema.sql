-- Analytics Events — tracks user behavior and platform metrics
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    user_id BIGINT REFERENCES users(id),
    persona_id BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at DESC);

-- Daily aggregated analytics for dashboards
CREATE TABLE IF NOT EXISTS analytics_daily (
    date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value BIGINT NOT NULL DEFAULT 0,
    dimensions JSONB DEFAULT '{}',
    PRIMARY KEY (date, metric_name)
);

-- User engagement tracking
CREATE TABLE IF NOT EXISTS user_engagement (
    user_id BIGINT NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    profile_views INT DEFAULT 0,
    store_visits INT DEFAULT 0,
    marketplace_visits INT DEFAULT 0,
    interactions INT DEFAULT 0,
    PRIMARY KEY (user_id, date)
);
