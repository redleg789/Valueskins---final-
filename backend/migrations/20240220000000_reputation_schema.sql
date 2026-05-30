-- Reputation & Fraud Detection Schema
-- Core infrastructure for creator scoring and fraud prevention

-- Creator Reputation Metrics (per creator)
CREATE TABLE IF NOT EXISTS creator_reputation_metrics (
    creator_user_id   BIGINT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reputation_score  NUMERIC(5, 2) NOT NULL DEFAULT 0,
    on_time_rate      NUMERIC(5, 2) NOT NULL DEFAULT 0,
    avg_rating        NUMERIC(5, 2) NOT NULL DEFAULT 0,
    response_score    NUMERIC(5, 2) NOT NULL DEFAULT 0,
    revision_efficiency NUMERIC(5, 2) NOT NULL DEFAULT 0,
    repeat_brand_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_deals       INT NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    needs_refresh     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_score ON creator_reputation_metrics(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_needs_refresh ON creator_reputation_metrics(needs_refresh) WHERE needs_refresh = TRUE;

-- Fraud Signal Detection
CREATE TABLE IF NOT EXISTS reputation_fraud_signals (
    id                BIGSERIAL PRIMARY KEY,
    creator_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type       TEXT NOT NULL CHECK (signal_type IN ('self_dealing', 'rating_collusion', 'velocity_spike')),
    severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    details           JSONB NOT NULL,
    detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ,
    resolved_by_user_id BIGINT REFERENCES users(id),
    resolver_notes    TEXT
);

CREATE INDEX IF NOT EXISTS idx_fraud_unresolved ON reputation_fraud_signals(creator_user_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_signal_type ON reputation_fraud_signals(signal_type, severity);
CREATE INDEX IF NOT EXISTS idx_fraud_detected_at ON reputation_fraud_signals(detected_at DESC);

-- Creator Underwriting (risk tier & max deal size)
CREATE TABLE IF NOT EXISTS creator_underwriting (
    creator_user_id   BIGINT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    risk_tier         TEXT NOT NULL CHECK (risk_tier IN ('A', 'B', 'C', 'D')),
    risk_score        NUMERIC(5, 2) NOT NULL,
    max_deal_size_usd NUMERIC(10, 2) NOT NULL,
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_underwriting_risk_tier ON creator_underwriting(risk_tier);
CREATE INDEX IF NOT EXISTS idx_underwriting_last_evaluated ON creator_underwriting(last_evaluated_at DESC);
