-- Creator Interest & Signup Dashboard
-- Tracks creators expressing interest in joining the platform with their Instagram handle and motivation

CREATE TABLE IF NOT EXISTS creator_interest_signups (
    id BIGSERIAL PRIMARY KEY,
    instagram_handle TEXT NOT NULL,
    email TEXT,
    name TEXT,
    reason_for_interest TEXT NOT NULL,
    primary_profession TEXT,
    target_annual_income_usd INT,
    preferred_platforms TEXT[], -- ['instagram', 'tiktok', 'youtube', 'linkedin']
    has_existing_audience BOOLEAN DEFAULT FALSE,
    estimated_follower_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted_user', 'rejected')),
    converted_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    contacted_at TIMESTAMPTZ,
    contacted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(instagram_handle)
);

CREATE INDEX idx_signups_status ON creator_interest_signups(status);
CREATE INDEX idx_signups_created ON creator_interest_signups(created_at DESC);
CREATE INDEX idx_signups_instagram ON creator_interest_signups(instagram_handle);
CREATE INDEX idx_signups_converted ON creator_interest_signups(converted_user_id) WHERE converted_user_id IS NOT NULL;

-- Audit trail for signup status changes
CREATE TABLE IF NOT EXISTS creator_interest_audit (
    id BIGSERIAL PRIMARY KEY,
    signup_id BIGINT NOT NULL REFERENCES creator_interest_signups(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_signup ON creator_interest_audit(signup_id);
CREATE INDEX idx_audit_changed ON creator_interest_audit(changed_at DESC);
