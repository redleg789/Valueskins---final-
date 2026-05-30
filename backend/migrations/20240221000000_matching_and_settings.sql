-- Migration: ValuSkin-Based Matching Engine + User Settings
--
-- Core rule: Creators and brands are matched ONLY if they share the same ValuSkin.
-- A brand selling fitness products must hold a "Fitness Coach" or related ValuSkin.
-- A creator with "Software Engineer" ValuSkin only sees tech-related brand opportunities.
-- This creates a trust layer: both sides have verified domain identity.

-- 1. User settings — decoupled from users table for extensibility
-- Stores per-user preferences that were previously inline (e.g., willing_to_barter).
-- New settings can be added without ALTER TABLE on the hot users table.
CREATE TABLE IF NOT EXISTS user_settings (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    willing_to_barter   BOOLEAN NOT NULL DEFAULT FALSE,
    energy_state        TEXT NOT NULL DEFAULT 'available'
                        CHECK (energy_state IN ('available', 'limited', 'burnout', 'pause')),
    price_band          TEXT NOT NULL DEFAULT 'mid-tier'
                        CHECK (price_band IN ('experimental', 'mid-tier', 'premium', 'exclusive')),
    auto_escalation     BOOLEAN NOT NULL DEFAULT FALSE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    profile_visibility  TEXT NOT NULL DEFAULT 'public'
                        CHECK (profile_visibility IN ('public', 'private', 'connections_only')),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION trg_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_settings_ts
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION trg_user_settings_updated_at();

-- 2. Matching requirements — brands specify which ValuSkin field(s) they want
-- When a brand creates an opportunity, they MUST specify at least one required profession.
-- The matching engine uses this to filter creators: only those with a matching ValuSkin appear.
CREATE TABLE IF NOT EXISTS matching_requirements (
    id                  BIGSERIAL PRIMARY KEY,
    opportunity_id      BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    required_profession TEXT NOT NULL,
    min_level           INT NOT NULL DEFAULT 1 CHECK (min_level BETWEEN 1 AND 5),
    priority            INT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (opportunity_id, required_profession)
);

CREATE INDEX IF NOT EXISTS idx_matching_req_opp ON matching_requirements(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_matching_req_prof ON matching_requirements(required_profession);

-- 3. Matching audit log — transparency for both sides
-- Every match decision is logged: why a creator was shown to a brand (or filtered out).
-- Enables dispute resolution and regulatory compliance.
CREATE TABLE IF NOT EXISTS matching_audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    opportunity_id      BIGINT REFERENCES opportunities(id) ON DELETE SET NULL,
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_user_id     BIGINT NOT NULL REFERENCES users(id),
    matched_profession  TEXT NOT NULL,
    match_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
    match_factors       JSONB NOT NULL DEFAULT '{}',
    decision            TEXT NOT NULL CHECK (decision IN ('matched', 'filtered_no_skin', 'filtered_level', 'filtered_energy', 'filtered_hidden')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_opp ON matching_audit_log(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_brand ON matching_audit_log(brand_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_creator ON matching_audit_log(creator_user_id, created_at DESC);

-- 4. Add required_professions array to opportunities for quick filtering
-- This denormalizes matching_requirements for read performance.
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS required_professions TEXT[] NOT NULL DEFAULT '{}';

-- 5. Migrate existing willing_to_barter data into user_settings
-- INSERT ... ON CONFLICT to avoid duplication if run multiple times.
INSERT INTO user_settings (user_id, willing_to_barter)
SELECT id, COALESCE(willing_to_barter, FALSE)
FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;
