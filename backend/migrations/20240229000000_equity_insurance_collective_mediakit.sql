-- ============================================================================
-- EQUITY, INSURANCE, COLLECTIVE BARGAINING, MEDIA KIT
-- Feature-flagged features: equity, insurance, media_kit (seeded in feature_flags)
-- Collective bargaining: new feature
-- ============================================================================

-- ============================================================================
-- 1. CREATOR EQUITY SYSTEM
-- 10% of platform revenue → equity pool → tokens → dividends
-- ============================================================================

CREATE TABLE IF NOT EXISTS equity_pool (
    id                      SERIAL PRIMARY KEY,
    total_tokens_issued     BIGINT      NOT NULL DEFAULT 0,
    total_tokens_vested     BIGINT      NOT NULL DEFAULT 0,
    pool_value_cents        BIGINT      NOT NULL DEFAULT 0,
    price_per_token_cents   INT         NOT NULL DEFAULT 0,
    revenue_share_pct       INT         NOT NULL DEFAULT 10,
    total_revenue_allocated_cents BIGINT NOT NULL DEFAULT 0,
    total_creators_holding  INT         NOT NULL DEFAULT 0,
    dividend_pool_cents     BIGINT      NOT NULL DEFAULT 0,
    last_dividend_at        TIMESTAMPTZ,
    next_dividend_at        TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton row
INSERT INTO equity_pool (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS creator_equity_accounts (
    id              SERIAL PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_tokens    BIGINT      NOT NULL DEFAULT 0,
    vested_tokens   BIGINT      NOT NULL DEFAULT 0,
    unvested_tokens BIGINT      NOT NULL DEFAULT 0,
    tier            VARCHAR(20) NOT NULL DEFAULT 'Seed'
                    CHECK (tier IN ('Seed', 'Growth', 'Scale', 'Partner', 'Founder')),
    multiplier      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    -- Contribution tracking
    deals_completed          INT    NOT NULL DEFAULT 0,
    platform_fees_generated  BIGINT NOT NULL DEFAULT 0,
    referrals_converted      INT    NOT NULL DEFAULT 0,
    content_created          INT    NOT NULL DEFAULT 0,
    community_contributions  INT    NOT NULL DEFAULT 0,
    -- Dividends
    total_dividends_earned   BIGINT NOT NULL DEFAULT 0,
    last_dividend_amount     BIGINT NOT NULL DEFAULT 0,
    last_dividend_at         TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_equity_accounts_user ON creator_equity_accounts(user_id);
CREATE INDEX idx_equity_accounts_tier ON creator_equity_accounts(tier);

CREATE TABLE IF NOT EXISTS equity_vesting_events (
    id          SERIAL PRIMARY KEY,
    user_id     INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tokens      INT         NOT NULL CHECK (tokens > 0),
    vest_date   TIMESTAMPTZ NOT NULL,
    source      VARCHAR(30) NOT NULL
                CHECK (source IN ('deal_completion', 'referral', 'loyalty_bonus', 'community', 'early_adopter')),
    status      VARCHAR(15) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'vested', 'forfeited')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vesting_user ON equity_vesting_events(user_id);
CREATE INDEX idx_vesting_status ON equity_vesting_events(status);

CREATE TABLE IF NOT EXISTS equity_dividend_payouts (
    id              SERIAL PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents    BIGINT      NOT NULL CHECK (amount_cents > 0),
    tokens_held     BIGINT      NOT NULL,
    payout_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key VARCHAR(64) NOT NULL UNIQUE
);

CREATE INDEX idx_dividends_user ON equity_dividend_payouts(user_id);

-- ============================================================================
-- 2. CREATOR INSURANCE / PROTECTION FUND
-- 2% of every deal → protection pool → claims
-- ============================================================================

CREATE TABLE IF NOT EXISTS protection_pool (
    id                  SERIAL PRIMARY KEY,
    total_balance_cents BIGINT NOT NULL DEFAULT 0,
    available_cents     BIGINT NOT NULL DEFAULT 0,
    reserved_cents      BIGINT NOT NULL DEFAULT 0,
    contribution_rate   INT    NOT NULL DEFAULT 2,
    total_contributions_cents BIGINT NOT NULL DEFAULT 0,
    total_claims_paid_cents   BIGINT NOT NULL DEFAULT 0,
    health_score        INT    NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    runway_months       INT    NOT NULL DEFAULT 0,
    total_policies      INT    NOT NULL DEFAULT 0,
    active_claims       INT    NOT NULL DEFAULT 0,
    claim_approval_rate INT    NOT NULL DEFAULT 0,
    last_audit_at       TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO protection_pool (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS creator_insurance_policies (
    id              SERIAL PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'lapsed', 'cancelled')),
    tier            VARCHAR(20) NOT NULL DEFAULT 'Basic'
                    CHECK (tier IN ('Basic', 'Standard', 'Premium', 'Elite')),
    -- Coverage limits in cents
    non_payment_max_cents          BIGINT NOT NULL DEFAULT 250000,
    income_protection_monthly_cents BIGINT NOT NULL DEFAULT 50000,
    legal_defense_max_cents        BIGINT NOT NULL DEFAULT 100000,
    emergency_fund_max_cents       BIGINT NOT NULL DEFAULT 50000,
    -- Contributions
    total_contributed_cents BIGINT NOT NULL DEFAULT 0,
    last_contribution_cents BIGINT NOT NULL DEFAULT 0,
    last_contribution_at    TIMESTAMPTZ,
    -- Eligibility
    months_active       INT NOT NULL DEFAULT 0,
    claims_last_12m     INT NOT NULL DEFAULT 0,
    risk_score          INT NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
    total_claims_paid_cents BIGINT NOT NULL DEFAULT 0,
    start_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renewal_date        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 year',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_insurance_user ON creator_insurance_policies(user_id);
CREATE INDEX idx_insurance_status ON creator_insurance_policies(status);

CREATE TABLE IF NOT EXISTS insurance_claims (
    id              SERIAL PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id       INT         NOT NULL REFERENCES creator_insurance_policies(id),
    claim_type      VARCHAR(30) NOT NULL
                    CHECK (claim_type IN ('non_payment', 'partial_payment', 'income_drop', 'legal_defense', 'platform_ban', 'reputation_damage', 'emergency')),
    amount_cents    BIGINT      NOT NULL CHECK (amount_cents > 0),
    description     TEXT        NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'under_review', 'approved', 'denied', 'paid')),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    reviewer_user_id INT,
    review_notes    TEXT,
    amount_approved_cents BIGINT,
    payment_date    TIMESTAMPTZ,
    community_votes_for   INT NOT NULL DEFAULT 0,
    community_votes_against INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE
);

CREATE INDEX idx_claims_user ON insurance_claims(user_id);
CREATE INDEX idx_claims_status ON insurance_claims(status);
CREATE INDEX idx_claims_policy ON insurance_claims(policy_id);

-- ============================================================================
-- 3. CREATOR COLLECTIVES / GUILDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_collectives (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120)    NOT NULL,
    description     TEXT            NOT NULL DEFAULT '',
    category        VARCHAR(60)     NOT NULL,
    president_user_id INT           NOT NULL REFERENCES users(id),
    voting_threshold  INT           NOT NULL DEFAULT 66 CHECK (voting_threshold BETWEEN 1 AND 100),
    total_members     INT           NOT NULL DEFAULT 0,
    total_combined_followers BIGINT NOT NULL DEFAULT 0,
    avg_member_level  NUMERIC(3,1)  NOT NULL DEFAULT 1.0,
    -- Stats
    total_deals_negotiated INT    NOT NULL DEFAULT 0,
    avg_deal_value_cents   BIGINT NOT NULL DEFAULT 0,
    avg_rate_increase_pct  INT    NOT NULL DEFAULT 0,
    brands_partnered       INT    NOT NULL DEFAULT 0,
    -- Treasury
    treasury_balance_cents BIGINT NOT NULL DEFAULT 0,
    monthly_contribution_cents INT NOT NULL DEFAULT 2500,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collectives_category ON creator_collectives(category);

CREATE TABLE IF NOT EXISTS collective_members (
    id              SERIAL PRIMARY KEY,
    collective_id   INT         NOT NULL REFERENCES creator_collectives(id) ON DELETE CASCADE,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('member', 'council', 'president')),
    voting_power    NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    contributions_cents BIGINT  NOT NULL DEFAULT 0,
    deals_thru_collective INT   NOT NULL DEFAULT 0,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(collective_id, user_id)
);

CREATE INDEX idx_coll_members_user ON collective_members(user_id);
CREATE INDEX idx_coll_members_collective ON collective_members(collective_id);

CREATE TABLE IF NOT EXISTS collective_minimum_rates (
    id              SERIAL PRIMARY KEY,
    collective_id   INT         NOT NULL REFERENCES creator_collectives(id) ON DELETE CASCADE,
    content_type    VARCHAR(60) NOT NULL,
    platform        VARCHAR(30) NOT NULL,
    min_rate_cents  BIGINT      NOT NULL CHECK (min_rate_cents > 0),
    per_metric      VARCHAR(30) NOT NULL DEFAULT 'per_post'
                    CHECK (per_metric IN ('per_post', 'per_1k_followers', 'per_1k_views')),
    effective_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    votes_for       INT         NOT NULL DEFAULT 0,
    votes_against   INT         NOT NULL DEFAULT 0,
    voted_on        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collective_blacklisted_brands (
    id              SERIAL PRIMARY KEY,
    collective_id   INT         NOT NULL REFERENCES creator_collectives(id) ON DELETE CASCADE,
    brand_name      VARCHAR(120) NOT NULL,
    reason          TEXT        NOT NULL,
    blacklisted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blacklisted_until TIMESTAMPTZ,
    votes_for       INT         NOT NULL DEFAULT 0,
    votes_against   INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collective_treasury_transactions (
    id              SERIAL PRIMARY KEY,
    collective_id   INT         NOT NULL REFERENCES creator_collectives(id) ON DELETE CASCADE,
    txn_type        VARCHAR(20) NOT NULL
                    CHECK (txn_type IN ('contribution', 'strike_fund', 'legal', 'marketing')),
    amount_cents    BIGINT      NOT NULL,
    description     TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market rate data (aggregated from completed deals)
CREATE TABLE IF NOT EXISTS market_rate_data (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(60) NOT NULL,
    platform        VARCHAR(30) NOT NULL,
    content_type    VARCHAR(60) NOT NULL,
    level           INT         NOT NULL CHECK (level BETWEEN 1 AND 5),
    min_rate_cents  BIGINT      NOT NULL DEFAULT 0,
    median_rate_cents BIGINT    NOT NULL DEFAULT 0,
    max_rate_cents  BIGINT      NOT NULL DEFAULT 0,
    trend           VARCHAR(10) NOT NULL DEFAULT 'stable'
                    CHECK (trend IN ('rising', 'stable', 'falling')),
    change_last_month_pct NUMERIC(5,1) NOT NULL DEFAULT 0,
    data_points     INT         NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, platform, content_type, level)
);

-- ============================================================================
-- 4. MEDIA KIT
-- Auto-generated professional portfolios for creators
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_media_kits (
    id              SERIAL PRIMARY KEY,
    user_id         INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Branding
    tagline         VARCHAR(200) NOT NULL DEFAULT '',
    bio             TEXT         NOT NULL DEFAULT '',
    location        VARCHAR(100),
    languages       TEXT[]       NOT NULL DEFAULT '{}',
    niche           VARCHAR(60)  NOT NULL DEFAULT '',
    specialties     TEXT[]       NOT NULL DEFAULT '{}',
    brand_color_primary   VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
    brand_color_secondary VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    brand_color_accent    VARCHAR(7) NOT NULL DEFAULT '#ec4899',
    -- Aggregated stats (cached, recalculated periodically)
    total_followers       BIGINT NOT NULL DEFAULT 0,
    avg_engagement_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,
    monthly_reach         BIGINT NOT NULL DEFAULT 0,
    -- Sharing
    is_public       BOOLEAN     NOT NULL DEFAULT TRUE,
    custom_slug     VARCHAR(60) UNIQUE,
    -- Metrics
    views           INT         NOT NULL DEFAULT 0,
    downloads       INT         NOT NULL DEFAULT 0,
    show_rates      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_mediakit_user ON creator_media_kits(user_id);
CREATE INDEX idx_mediakit_slug ON creator_media_kits(custom_slug) WHERE custom_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS mediakit_rates (
    id          SERIAL PRIMARY KEY,
    mediakit_id INT         NOT NULL REFERENCES creator_media_kits(id) ON DELETE CASCADE,
    rate_type   VARCHAR(60) NOT NULL,
    platform    VARCHAR(30) NOT NULL,
    price_cents BIGINT      NOT NULL CHECK (price_cents >= 0),
    description TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mediakit_featured_content (
    id          SERIAL PRIMARY KEY,
    mediakit_id INT         NOT NULL REFERENCES creator_media_kits(id) ON DELETE CASCADE,
    platform    VARCHAR(30) NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'image', 'post')),
    thumbnail_url TEXT,
    url         TEXT        NOT NULL,
    views       INT         NOT NULL DEFAULT 0,
    likes       INT         NOT NULL DEFAULT 0,
    comments    INT         NOT NULL DEFAULT 0,
    sort_order  INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mediakit_collaborations (
    id          SERIAL PRIMARY KEY,
    mediakit_id INT         NOT NULL REFERENCES creator_media_kits(id) ON DELETE CASCADE,
    brand_name  VARCHAR(120) NOT NULL,
    campaign_type VARCHAR(60) NOT NULL,
    results     TEXT,
    collab_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DATA RETENTION for new tables
-- ============================================================================
INSERT INTO data_retention_policies (table_name, id_column, timestamp_column, retention_days)
VALUES
    ('collective_treasury_transactions', 'id', 'created_at', 2555),
    ('equity_dividend_payouts', 'id', 'payout_date', 2555),
    ('insurance_claims', 'id', 'submitted_at', 2555)
ON CONFLICT DO NOTHING;
