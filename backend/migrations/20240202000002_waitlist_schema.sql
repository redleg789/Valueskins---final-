-- Waitlist and Conversion Tracking Schema
-- BLOCKER: Proof of real user demand vs concept appeal
-- Tracks signups, intent signals, and conversions

-- Waitlist signups
CREATE TABLE IF NOT EXISTS waitlist (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    creator_type VARCHAR(50),
    follower_range VARCHAR(20),
    platforms TEXT[],
    referral_source VARCHAR(100),
    referral_code VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    position INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    converted_to_user BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversion events (for funnel analysis)
CREATE TABLE IF NOT EXISTS conversion_events (
    id BIGSERIAL PRIMARY KEY,
    waitlist_id BIGINT REFERENCES waitlist(id),
    persona_id BIGINT,
    event_type VARCHAR(50) NOT NULL, -- 'signup', 'email_verified', 'persona_created', 'first_post', etc.
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B test assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id BIGSERIAL PRIMARY KEY,
    waitlist_id BIGINT REFERENCES waitlist(id),
    test_name VARCHAR(100) NOT NULL,
    variant VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(waitlist_id, test_name)
);

-- Email engagement tracking
CREATE TABLE IF NOT EXISTS email_events (
    id BIGSERIAL PRIMARY KEY,
    waitlist_id BIGINT REFERENCES waitlist(id),
    email_type VARCHAR(50) NOT NULL, -- 'welcome', 'waitlist_update', 'launch_invite', etc.
    event_type VARCHAR(20) NOT NULL, -- 'sent', 'opened', 'clicked', 'unsubscribed'
    link_clicked VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily waitlist metrics (for tracking growth)
CREATE TABLE IF NOT EXISTS waitlist_metrics (
    date DATE PRIMARY KEY,
    total_signups INTEGER DEFAULT 0,
    verified_signups INTEGER DEFAULT 0,
    referral_signups INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral ON waitlist(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_conversion ON waitlist(converted_to_user, converted_at);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type, created_at DESC);

-- Function to auto-assign position
CREATE OR REPLACE FUNCTION assign_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
    NEW.position := (SELECT COALESCE(MAX(position), 0) + 1 FROM waitlist);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_position
BEFORE INSERT ON waitlist
FOR EACH ROW
WHEN (NEW.position IS NULL)
EXECUTE FUNCTION assign_waitlist_position();

-- Function to update daily metrics
CREATE OR REPLACE FUNCTION update_waitlist_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO waitlist_metrics (date, total_signups, referral_signups)
    VALUES (CURRENT_DATE, 1, CASE WHEN NEW.referral_code IS NOT NULL THEN 1 ELSE 0 END)
    ON CONFLICT (date) DO UPDATE SET
        total_signups = waitlist_metrics.total_signups + 1,
        referral_signups = waitlist_metrics.referral_signups + CASE WHEN NEW.referral_code IS NOT NULL THEN 1 ELSE 0 END,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_waitlist_metrics
AFTER INSERT ON waitlist
FOR EACH ROW
EXECUTE FUNCTION update_waitlist_metrics();
