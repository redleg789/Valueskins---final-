-- ==========================================================================
-- Production Hardening: Feature flags, refresh tokens, idempotency,
-- PII audit, notification dispatch, data retention
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. FEATURE FLAGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage  INT CHECK (rollout_percentage BETWEEN 0 AND 100),
    allowed_roles       TEXT,          -- comma-separated: "admin,brand"
    shadow_mode         BOOLEAN NOT NULL DEFAULT FALSE,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ    -- soft delete for audit trail
);

CREATE INDEX IF NOT EXISTS idx_ff_name ON feature_flags(name) WHERE deleted_at IS NULL;

-- Seed core feature flags
INSERT INTO feature_flags (name, enabled, description) VALUES
    ('marketplace', TRUE, 'Main marketplace feature'),
    ('deal_rooms', TRUE, 'Deal room negotiation'),
    ('barter_mode', TRUE, 'Barter/exposure compensation'),
    ('reputation_v2', FALSE, 'New reputation scoring algorithm'),
    ('leaderboard', FALSE, 'Public creator leaderboard'),
    ('communities', TRUE, 'Community feature'),
    ('linkedin_integration', TRUE, 'LinkedIn profile linking'),
    ('media_kit', FALSE, 'Creator media kit generation'),
    ('insurance', FALSE, 'Creator insurance product'),
    ('equity', FALSE, 'Creator equity feature')
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 2. REFRESH TOKENS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,   -- SHA256 of the actual token
    family_id       UUID NOT NULL,          -- Token family for rotation detection
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent      TEXT,
    ip_address      TEXT
);

CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rt_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. IDEMPOTENCY KEYS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key             TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    user_id         BIGINT NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_idem_created ON idempotency_keys(created_at);

-- ──────────────────────────────────────────────────────────────
-- 4. PII ACCESS AUDIT LOG (append-only, no updates/deletes)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pii_audit_log (
    id                BIGSERIAL PRIMARY KEY,
    accessor_user_id  BIGINT NOT NULL,
    target_user_id    BIGINT NOT NULL,
    action            TEXT NOT NULL CHECK (action IN ('read', 'write', 'export', 'delete')),
    fields_accessed   TEXT NOT NULL,
    reason            TEXT NOT NULL,
    ip_address        TEXT,
    correlation_id    TEXT,
    accessed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_target ON pii_audit_log(target_user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_accessor ON pii_audit_log(accessor_user_id, accessed_at DESC);

-- Prevent updates/deletes on audit log (immutable)
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'pii_audit_log is append-only: updates and deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_audit_update ON pii_audit_log;
CREATE TRIGGER trg_no_audit_update
    BEFORE UPDATE OR DELETE ON pii_audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ──────────────────────────────────────────────────────────────
-- 5. NOTIFICATION DISPATCH TRACKING
-- ──────────────────────────────────────────────────────────────
-- notification_queue already exists; add retry tracking columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_queue' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE notification_queue ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
        ALTER TABLE notification_queue ADD COLUMN max_retries INT NOT NULL DEFAULT 3;
        ALTER TABLE notification_queue ADD COLUMN last_error TEXT;
        ALTER TABLE notification_queue ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 6. ADMIN API — leaderboard, network stats, feed
-- ──────────────────────────────────────────────────────────────

-- Leaderboard materialized view (refreshed hourly by cleanup worker)
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_leaderboard AS
SELECT
    u.id AS user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    p.id AS persona_id,
    crm.reputation_score,
    crm.total_deals,
    crm.avg_rating,
    RANK() OVER (ORDER BY crm.reputation_score DESC) AS rank
FROM users u
JOIN personas p ON p.owner_user_id = u.id
LEFT JOIN creator_reputation_metrics crm ON crm.creator_user_id = u.id
WHERE u.is_active = TRUE AND u.role = 'creator'
ORDER BY crm.reputation_score DESC NULLS LAST
LIMIT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_uid ON creator_leaderboard(user_id);

-- Platform-wide stats view
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS total_users,
    (SELECT COUNT(*) FROM personas) AS total_personas,
    (SELECT COUNT(DISTINCT profession_id) FROM persona_professions) AS total_skins,
    (SELECT COALESCE(SUM(total_volume), 0) FROM revenue_metrics) AS total_volume,
    (SELECT COALESCE(SUM(platform_revenue), 0) FROM revenue_metrics) AS total_revenue,
    (SELECT COUNT(*) FROM completed_deals) AS total_deals,
    NOW() AS last_refreshed_at;

-- ──────────────────────────────────────────────────────────────
-- 7. DATA RETENTION — auto-cleanup for ephemeral tables
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_retention_policies (
    table_name      TEXT NOT NULL PRIMARY KEY,
    retention_days  INT NOT NULL,
    cleanup_column  TEXT NOT NULL DEFAULT 'created_at',
    last_cleanup_at TIMESTAMPTZ,
    rows_deleted    BIGINT NOT NULL DEFAULT 0
);

INSERT INTO data_retention_policies (table_name, retention_days, cleanup_column) VALUES
    ('idempotency_keys', 2, 'created_at'),
    ('gating_decision_cache', 1, 'expires_at'),
    ('event_outbox', 30, 'created_at'),
    ('application_rate_limits', 3, 'window_start'),
    ('reputation_worker_claims', 1, 'expires_at'),
    ('pii_audit_log', 2555, 'accessed_at'),  -- 7 years (GDPR retention)
    ('refresh_tokens', 30, 'created_at')
ON CONFLICT (table_name) DO NOTHING;
