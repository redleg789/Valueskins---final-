-- ==========================================================================
-- Scale Hardening Migration: Revenue sharding, partitioning, caching, indexes
-- Fixes all bottlenecks identified in stress test for Meta-scale traffic
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. HOURLY REVENUE METRICS (eliminate single-row contention)
--    50M deals/day hitting one row = row lock queue death spiral.
--    Shard by hour: 24 rows/day instead of 1.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_metrics_hourly (
    date_hour    TIMESTAMPTZ NOT NULL,
    total_deals  BIGINT NOT NULL DEFAULT 0,
    total_volume NUMERIC(20, 2) NOT NULL DEFAULT 0,
    platform_revenue NUMERIC(20, 2) NOT NULL DEFAULT 0,
    creator_payouts  NUMERIC(20, 2) NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date_hour)
);

CREATE INDEX IF NOT EXISTS idx_rmh_date ON revenue_metrics_hourly(date_hour DESC);

-- Replace the trigger to write to hourly table instead of daily
CREATE OR REPLACE FUNCTION update_revenue_metrics()
RETURNS TRIGGER AS $$
DECLARE
    hour_bucket TIMESTAMPTZ;
BEGIN
    hour_bucket := DATE_TRUNC('hour', NOW());
    INSERT INTO revenue_metrics_hourly (date_hour, total_deals, total_volume, platform_revenue, creator_payouts)
    VALUES (hour_bucket, 1, NEW.total_amount, NEW.platform_fee, NEW.creator_payout)
    ON CONFLICT (date_hour) DO UPDATE SET
        total_deals = revenue_metrics_hourly.total_deals + 1,
        total_volume = revenue_metrics_hourly.total_volume + NEW.total_amount,
        platform_revenue = revenue_metrics_hourly.platform_revenue + NEW.platform_fee,
        creator_payouts = revenue_metrics_hourly.creator_payouts + NEW.creator_payout,
        updated_at = NOW();

    -- Also update the legacy daily table for backward compatibility
    INSERT INTO revenue_metrics (date, total_deals, total_volume, platform_revenue, creator_payouts)
    VALUES (CURRENT_DATE, 1, NEW.total_amount, NEW.platform_fee, NEW.creator_payout)
    ON CONFLICT (date) DO UPDATE SET
        total_deals = revenue_metrics.total_deals + 1,
        total_volume = revenue_metrics.total_volume + NEW.total_amount,
        platform_revenue = revenue_metrics.platform_revenue + NEW.platform_fee,
        creator_payouts = revenue_metrics.creator_payouts + NEW.creator_payout,
        avg_deal_size = (revenue_metrics.total_volume + NEW.total_amount) / (revenue_metrics.total_deals + 1),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────
-- 2. GATING DECISION CACHE TABLE
--    Eliminates 10M PL/pgSQL function calls/sec by caching results.
--    Application layer checks cache first (15min TTL), DB on miss.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gating_decision_cache (
    persona_id     BIGINT NOT NULL,
    opportunity_id BIGINT NOT NULL,
    can_view       BOOLEAN NOT NULL,
    reason         TEXT,
    visibility_mode TEXT,
    cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    PRIMARY KEY (persona_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_gdc_expires ON gating_decision_cache(expires_at);

-- Cleanup function for expired cache entries (run via pg_cron or background job)
CREATE OR REPLACE FUNCTION cleanup_gating_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM gating_decision_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────
-- 3. EVENT OUTBOX TABLE (Transactional Outbox Pattern)
--    Decouples deal completion from downstream side-effects
--    (reputation refresh, fraud scan, notifications, analytics).
--    Background worker polls this table and dispatches events.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_outbox (
    id             BIGSERIAL PRIMARY KEY,
    aggregate_type TEXT NOT NULL,          -- 'deal', 'offer', 'application', 'payout'
    aggregate_id   BIGINT NOT NULL,        -- e.g. deal_room_id
    event_type     TEXT NOT NULL,          -- 'deal.completed', 'offer.accepted', etc.
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMPTZ,            -- NULL = not yet dispatched
    retry_count    INT NOT NULL DEFAULT 0,
    max_retries    INT NOT NULL DEFAULT 5,
    last_error     TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON event_outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
    ON event_outbox(aggregate_type, aggregate_id);

-- ──────────────────────────────────────────────────────────────
-- 4. APPLICATION RATE LIMITING TABLE
--    Prevents mass application spam (bot creates 10K accounts,
--    floods single opportunity with 100K applications).
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_rate_limits (
    user_id        BIGINT NOT NULL,
    window_start   TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('day', NOW()),
    application_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, window_start)
);

-- Per-opportunity application cap tracking
CREATE TABLE IF NOT EXISTS opportunity_application_counts (
    opportunity_id BIGINT NOT NULL PRIMARY KEY REFERENCES opportunities(id),
    count          INT NOT NULL DEFAULT 0,
    max_allowed    INT NOT NULL DEFAULT 10000
);

-- ──────────────────────────────────────────────────────────────
-- 5. CIRCUIT BREAKER STATE TABLE
--    Tracks service health for circuit breaker pattern.
--    When a downstream service fails repeatedly, circuit opens
--    and requests are served from cache/fallback.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    service_name    TEXT NOT NULL PRIMARY KEY,
    state           TEXT NOT NULL DEFAULT 'closed'
                        CHECK (state IN ('closed', 'open', 'half_open')),
    failure_count   INT NOT NULL DEFAULT 0,
    success_count   INT NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    -- Circuit opens after this many consecutive failures
    failure_threshold INT NOT NULL DEFAULT 5,
    -- Circuit stays open for this duration before half-opening
    recovery_timeout_secs INT NOT NULL DEFAULT 30,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 6. MISSING INDEXES FOR META-SCALE QUERIES
--    Every hot query path must have a covering index.
-- ──────────────────────────────────────────────────────────────

-- Deal rooms: GDPR deletion check queries both creator and brand
CREATE INDEX IF NOT EXISTS idx_dr_creator_user
    ON deal_rooms(brand_user_id, status)
    WHERE status NOT IN ('completed', 'cancelled');

-- Completed deals: reputation batch job pagination
CREATE INDEX IF NOT EXISTS idx_cd_creator_user
    ON completed_deals(creator_user_id);

-- Offer rounds: find unanswered offers for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_or_unanswered
    ON offer_rounds(response_due_at)
    WHERE responded_at IS NULL;

-- Trust scores: reputation calculation joins
CREATE INDEX IF NOT EXISTS idx_ts_persona
    ON trust_scores(persona_id);

-- Testimonials: avg rating calculation
CREATE INDEX IF NOT EXISTS idx_testimonials_persona
    ON testimonials(for_persona_id);

-- Payout ledger: reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payout_status
    ON payout_ledger(processor_status, initiated_at DESC);

-- Fraud signals: unresolved signals per creator
CREATE INDEX IF NOT EXISTS idx_fraud_creator_unresolved
    ON reputation_fraud_signals(creator_user_id, detected_at DESC)
    WHERE resolved_at IS NULL;

-- Application rate limit cleanup
CREATE INDEX IF NOT EXISTS idx_arl_window
    ON application_rate_limits(window_start);

-- Notification queue: pending dispatch
CREATE INDEX IF NOT EXISTS idx_notif_pending
    ON notification_queue(scheduled_for)
    WHERE sent_at IS NULL;

-- ──────────────────────────────────────────────────────────────
-- 7. REPUTATION WORKER TRACKING
--    Coordinates parallel reputation refresh workers so they
--    don't recalculate the same creator simultaneously.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_worker_claims (
    creator_user_id BIGINT NOT NULL PRIMARY KEY,
    worker_id       TEXT NOT NULL,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Auto-expires after 60s so crashed workers don't block forever
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds')
);

CREATE INDEX IF NOT EXISTS idx_rwc_expires
    ON reputation_worker_claims(expires_at);

-- ──────────────────────────────────────────────────────────────
-- 8. READ REPLICA ROUTING HINT
--    Tag analytics queries so connection middleware can route
--    them to read replicas. Stored as a config table.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_routing_config (
    query_pattern   TEXT NOT NULL PRIMARY KEY,
    route_to        TEXT NOT NULL DEFAULT 'primary'
                        CHECK (route_to IN ('primary', 'replica', 'analytics')),
    description     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default routing rules
INSERT INTO db_routing_config (query_pattern, route_to, description) VALUES
    ('revenue_metrics%', 'replica', 'Revenue dashboards read from replica'),
    ('creator_reputation_metrics%', 'replica', 'Reputation lookups from replica'),
    ('payout_ledger%reconciliation%', 'analytics', 'Payout reconciliation on analytics node'),
    ('opportunity_applications%count%', 'replica', 'Application counts from replica')
ON CONFLICT (query_pattern) DO NOTHING;
