-- ============================================================
-- Migration: Platform Features
-- Adds: brand verification, creator completeness, payout ledger,
--        tiered API keys, GDPR deletion tracking, rate limit tiers
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BRAND VERIFICATION
-- Brands must verify their business identity before posting
-- opportunities. Off by default (is_verified = false).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_verifications (
    id                  BIGSERIAL PRIMARY KEY,
    brand_user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')),
    -- Legal entity details (submitted by brand)
    legal_name          TEXT,
    registration_number TEXT,
    country_code        CHAR(2),
    website_url         TEXT,
    -- Documents (stored as URLs to object storage — never raw files in DB)
    document_urls       TEXT[],
    -- Review outcome
    reviewer_user_id    BIGINT REFERENCES users(id),
    reviewer_notes      TEXT,
    verified_at         TIMESTAMPTZ,
    rejected_at         TIMESTAMPTZ,
    -- Audit
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand_user_id)
);

-- Brands can re-submit after rejection — track history
CREATE TABLE IF NOT EXISTS brand_verification_history (
    id              BIGSERIAL PRIMARY KEY,
    brand_user_id   BIGINT NOT NULL REFERENCES users(id),
    old_status      TEXT NOT NULL,
    new_status      TEXT NOT NULL,
    changed_by      BIGINT REFERENCES users(id),   -- NULL = system/auto
    reason          TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_verif_user  ON brand_verifications(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brand_verif_status ON brand_verifications(status);

-- ────────────────────────────────────────────────────────────
-- 2. CREATOR ONBOARDING COMPLETENESS SCORE
-- Computed server-side, stored for fast reads.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_completeness (
    user_id             BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Individual component scores (each 0 or 1)
    has_avatar          BOOLEAN NOT NULL DEFAULT FALSE,
    has_bio             BOOLEAN NOT NULL DEFAULT FALSE,
    has_valueskin       BOOLEAN NOT NULL DEFAULT FALSE,
    has_price_band      BOOLEAN NOT NULL DEFAULT FALSE,
    has_credential      BOOLEAN NOT NULL DEFAULT FALSE,    -- linked GitHub/LinkedIn/etc.
    has_testimonial     BOOLEAN NOT NULL DEFAULT FALSE,    -- received at least 1
    has_barter_pref     BOOLEAN NOT NULL DEFAULT FALSE,
    has_energy_state    BOOLEAN NOT NULL DEFAULT FALSE,
    -- Computed totals (0–100 integer score)
    completeness_score  INT NOT NULL DEFAULT 0
                            CHECK (completeness_score BETWEEN 0 AND 100),
    -- Tier derived from score
    -- 0-39: incomplete | 40-69: developing | 70-89: established | 90-100: elite
    completeness_tier   TEXT NOT NULL DEFAULT 'incomplete'
                            CHECK (completeness_tier IN ('incomplete', 'developing', 'established', 'elite')),
    last_computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completeness_score ON creator_completeness(completeness_score DESC);
CREATE INDEX IF NOT EXISTS idx_completeness_tier  ON creator_completeness(completeness_tier);

-- ────────────────────────────────────────────────────────────
-- 3. PAYOUT RECONCILIATION LEDGER
-- Immutable, append-only accounting record for every money movement.
-- Never update rows — only INSERT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_ledger (
    id                  BIGSERIAL PRIMARY KEY,
    -- Idempotency key prevents duplicate payouts on retry
    idempotency_key     TEXT NOT NULL UNIQUE,
    -- Parties
    creator_user_id     BIGINT NOT NULL REFERENCES users(id),
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    -- Link back to the deal
    deal_id             BIGINT REFERENCES completed_deals(id),
    escrow_stage_id     BIGINT,   -- nullable: direct payout vs. staged
    -- Amounts (stored as integer cents to avoid float precision loss)
    gross_amount_cents  BIGINT NOT NULL CHECK (gross_amount_cents > 0),
    platform_fee_cents  BIGINT NOT NULL DEFAULT 0,
    net_amount_cents    BIGINT NOT NULL CHECK (net_amount_cents >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    -- Payment processor details
    processor           TEXT NOT NULL CHECK (processor IN ('stripe', 'razorpay', 'manual', 'crypto')),
    processor_txn_id    TEXT,    -- set when payment processor confirms
    processor_status    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (processor_status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
    failure_reason      TEXT,
    -- Audit trail
    initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    -- Metadata for reconciliation reports
    metadata            JSONB
);

-- Partial indexes for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payout_creator    ON payout_ledger(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_brand      ON payout_ledger(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_deal       ON payout_ledger(deal_id);
CREATE INDEX IF NOT EXISTS idx_payout_pending    ON payout_ledger(processor_status) WHERE processor_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payout_proc_txn   ON payout_ledger(processor_txn_id) WHERE processor_txn_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. TIERED API KEYS (rate limit enforcement)
-- Brands/platforms use API keys. The key tier controls rate limits.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id                  BIGSERIAL PRIMARY KEY,
    -- Key value stored as SHA-256 hash — never the raw key
    key_hash            TEXT NOT NULL UNIQUE,
    key_prefix          CHAR(8) NOT NULL,   -- first 8 chars for display/lookup
    owner_user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Tier controls rate limiting in middleware
    tier                TEXT NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free', 'basic', 'pro', 'enterprise')),
    -- Limits per tier (enforced in middleware, stored here for auditability)
    requests_per_minute INT NOT NULL DEFAULT 100,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,   -- NULL = never expires
    -- Metadata
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMPTZ,
    revoked_by          BIGINT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_owner  ON api_keys(owner_user_id);

-- ────────────────────────────────────────────────────────────
-- 5. GDPR DATA DELETION REQUESTS
-- Users invoke the right-to-erasure. Platform must track and
-- honor within 30 days. Soft-delete triggers actual anonymization.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    -- What the user wants deleted
    scope               TEXT NOT NULL DEFAULT 'full'
                            CHECK (scope IN ('full', 'activity_only', 'credentials_only', 'marketing_only')),
    reason              TEXT,
    -- Processing state machine
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    -- Compliance: must complete within 30 days of request
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    must_complete_by    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    processing_started_at TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    -- Track what was deleted
    deleted_tables      TEXT[],   -- e.g. ['persona_professions', 'testimonials', ...]
    anonymized_user_id  BIGINT,   -- replaced with anonymized ID
    -- Who processed it (admin or automated job)
    processed_by        TEXT,     -- 'automated' | 'admin:USER_ID'
    notes               TEXT,
    UNIQUE (user_id, status)      -- one active deletion per user
);

CREATE INDEX IF NOT EXISTS idx_gdpr_pending ON data_deletion_requests(status, must_complete_by)
    WHERE status IN ('pending', 'processing');

-- ────────────────────────────────────────────────────────────
-- 6. WEBHOOK DELIVERY LOG (retry tracking)
-- Already have webhooks table — add delivery attempt tracking.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id                  BIGSERIAL PRIMARY KEY,
    webhook_id          BIGINT NOT NULL,   -- references brand_api webhooks.id
    event_type          TEXT NOT NULL,
    payload_hash        TEXT NOT NULL,     -- SHA-256 of payload for dedup
    -- Attempt tracking
    attempt_number      INT NOT NULL DEFAULT 1,
    max_attempts        INT NOT NULL DEFAULT 5,
    -- HTTP result
    response_status     INT,
    response_body       TEXT,
    response_time_ms    INT,
    -- State machine
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'success', 'failed', 'exhausted')),
    error_message       TEXT,
    -- Timing
    scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempted_at        TIMESTAMPTZ,
    next_retry_at       TIMESTAMPTZ,   -- exponential backoff
    succeeded_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_pending ON webhook_delivery_log(status, next_retry_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook ON webhook_delivery_log(webhook_id);

-- ────────────────────────────────────────────────────────────
-- 7. PAYMENT PROCESSOR SETTINGS (platform-configurable)
-- Off by default. Admin enables per environment.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_processor_settings (
    id                  BIGSERIAL PRIMARY KEY,
    processor           TEXT NOT NULL UNIQUE
                            CHECK (processor IN ('stripe', 'razorpay')),
    is_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    -- Config stored encrypted at rest — just metadata here
    mode                TEXT NOT NULL DEFAULT 'sandbox'
                            CHECK (mode IN ('sandbox', 'live')),
    webhook_endpoint    TEXT,
    platform_fee_pct    NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    -- Supported currencies per processor
    supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD'],
    updated_by          BIGINT REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default disabled processors (admin turns them on)
INSERT INTO payment_processor_settings (processor, is_enabled, mode)
VALUES ('stripe', FALSE, 'sandbox'), ('razorpay', FALSE, 'sandbox')
ON CONFLICT (processor) DO NOTHING;
