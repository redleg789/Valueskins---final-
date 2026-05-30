-- Brand Marketplace Schema
-- Transaction-based revenue with 5% platform take-rate

-- Opportunities posted by brands
CREATE TABLE IF NOT EXISTS opportunities (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT REFERENCES brands(id),
    brand_user_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    required_profession_id BIGINT NOT NULL REFERENCES professions(id),
    required_level INTEGER NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    reward_amount NUMERIC(20, 2) NOT NULL,
    reward_currency VARCHAR(10) DEFAULT 'USD',
    deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'completed', 'cancelled', 'disputed')),
    selected_persona_id BIGINT REFERENCES personas(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications from creators
CREATE TABLE IF NOT EXISTS opportunity_applications (
    id BIGSERIAL PRIMARY KEY,
    opportunity_id BIGINT NOT NULL REFERENCES opportunities(id),
    persona_id BIGINT NOT NULL REFERENCES personas(id),
    applicant_user_id BIGINT NOT NULL REFERENCES users(id),
    pitch TEXT,
    proposed_rate NUMERIC(20, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(opportunity_id, persona_id)
);

-- Completed deals (for revenue tracking)
CREATE TABLE IF NOT EXISTS completed_deals (
    id BIGSERIAL PRIMARY KEY,
    opportunity_id BIGINT NOT NULL REFERENCES opportunities(id) UNIQUE,
    brand_id BIGINT REFERENCES brands(id),
    brand_user_id BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id BIGINT NOT NULL REFERENCES personas(id),
    creator_user_id BIGINT NOT NULL REFERENCES users(id),
    total_amount NUMERIC(20, 2) NOT NULL,
    creator_payout NUMERIC(20, 2) NOT NULL,
    platform_fee NUMERIC(20, 2) NOT NULL,
    platform_fee_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform revenue metrics (auto-updated via trigger)
CREATE TABLE IF NOT EXISTS revenue_metrics (
    date DATE PRIMARY KEY,
    total_deals INTEGER DEFAULT 0,
    total_volume NUMERIC(20, 2) DEFAULT 0,
    platform_revenue NUMERIC(20, 2) DEFAULT 0,
    creator_payouts NUMERIC(20, 2) DEFAULT 0,
    avg_deal_size NUMERIC(20, 2) DEFAULT 0,
    avg_platform_fee_pct NUMERIC(5, 2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status, deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_brand ON opportunities(brand_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_brand_user ON opportunities(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_profession ON opportunities(required_profession_id, required_level);
CREATE INDEX IF NOT EXISTS idx_applications_opportunity ON opportunity_applications(opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_persona ON opportunity_applications(persona_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON opportunity_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_completed_deals_date ON completed_deals(completed_at DESC);

-- Auto-update revenue metrics on deal completion
CREATE OR REPLACE FUNCTION update_revenue_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO revenue_metrics (date, total_deals, total_volume, platform_revenue, creator_payouts)
    VALUES (
        CURRENT_DATE,
        1,
        NEW.total_amount,
        NEW.platform_fee,
        NEW.creator_payout
    )
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

DROP TRIGGER IF EXISTS trigger_update_revenue_metrics ON completed_deals;
CREATE TRIGGER trigger_update_revenue_metrics
AFTER INSERT ON completed_deals
FOR EACH ROW
EXECUTE FUNCTION update_revenue_metrics();
