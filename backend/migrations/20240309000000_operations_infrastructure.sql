-- Production operations migration:
-- 1. Schema version tracking for zero-downtime migrations
-- 2. Slow query log table (alert on P99 regressions)
-- 3. Materialized view refresh tracking
-- 4. Background job heartbeat table (detect stuck workers)

-- ──────────────────────────────────────────────────────────────
-- 1. MIGRATION VERSION TRACKING
-- ──────────────────────────────────────────────────────────────
-- sqlx already maintains _sqlx_migrations, but we add our own
-- semantic versioning table for the ops team to query easily.
CREATE TABLE IF NOT EXISTS schema_versions (
    version     TEXT NOT NULL PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_versions (version, description) VALUES
    ('1.0.0', 'Initial schema'),
    ('1.1.0', 'Analytics, brands, marketplace'),
    ('1.2.0', 'Deal rooms, communities, credentials'),
    ('1.3.0', 'Campaign gating, platform features'),
    ('1.4.0', 'Agency elimination, indexes'),
    ('1.5.0', 'Production hardening, feature flags, PII audit'),
    ('1.6.0', 'Scale hardening, prod readiness indexes'),
    ('1.7.0', 'User settings, creator prefs'),
    ('1.8.0', 'Operations infrastructure')
ON CONFLICT (version) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 2. BACKGROUND WORKER HEARTBEAT
-- ──────────────────────────────────────────────────────────────
-- Each background worker (outbox, cleanup, notification) upserts
-- a heartbeat every cycle. Alert fires if heartbeat > 2× expected interval.
CREATE TABLE IF NOT EXISTS worker_heartbeats (
    worker_name     TEXT NOT NULL PRIMARY KEY,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_count     BIGINT NOT NULL DEFAULT 0,
    last_items_processed INT NOT NULL DEFAULT 0,
    pod_hostname    TEXT
);

-- Index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen
    ON worker_heartbeats(last_seen_at);

-- Seed expected workers so monitoring can detect ones that never started
INSERT INTO worker_heartbeats (worker_name, last_seen_at) VALUES
    ('outbox_worker', NOW() - INTERVAL '999 days'),   -- sentinel: never seen
    ('cleanup_worker', NOW() - INTERVAL '999 days'),
    ('notification_worker', NOW() - INTERVAL '999 days')
ON CONFLICT (worker_name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 3. MATERIALIZED VIEW REFRESH LOG
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matview_refresh_log (
    view_name       TEXT NOT NULL PRIMARY KEY,
    last_refreshed  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms     INT,
    rows_count      BIGINT
);

INSERT INTO matview_refresh_log (view_name) VALUES
    ('creator_leaderboard'),
    ('platform_stats')
ON CONFLICT (view_name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. ALERT RULES TABLE (for DB-driven alerting thresholds)
-- ──────────────────────────────────────────────────────────────
-- Allows ops to tune alert thresholds without redeploying.
CREATE TABLE IF NOT EXISTS alert_thresholds (
    metric_name         TEXT NOT NULL PRIMARY KEY,
    warning_threshold   NUMERIC,
    critical_threshold  NUMERIC,
    unit                TEXT,
    description         TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO alert_thresholds (metric_name, warning_threshold, critical_threshold, unit, description) VALUES
    ('error_rate_5xx',          0.005,  0.01,   'ratio',    '5xx error rate over 5 minutes'),
    ('p99_latency_ms',          300,    500,    'ms',       'P99 request latency'),
    ('db_pool_wait_count',      5,      20,     'count',    'Requests waiting for a DB connection'),
    ('outbox_lag_seconds',      30,     120,    'seconds',  'Event outbox processing lag'),
    ('notification_lag_seconds',60,    300,     'seconds',  'Notification queue processing lag'),
    ('circuit_breaker_open',    1,      NULL,   'count',    'Number of open circuit breakers'),
    ('replication_lag_bytes',   10485760, 104857600, 'bytes', 'Postgres replication lag')
ON CONFLICT (metric_name) DO NOTHING;
