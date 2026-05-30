-- Referral System Schema
-- Multi-tier referral tracking with rewards

-- Referral codes
CREATE TABLE IF NOT EXISTS referral_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    persona_id BIGINT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    code_hash VARCHAR(128) NOT NULL UNIQUE,
    uses INTEGER DEFAULT 0,
    total_earnings NUMERIC(20, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Referral relationships (who referred whom)
CREATE TABLE IF NOT EXISTS referral_chains (
    id BIGSERIAL PRIMARY KEY,
    new_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
    new_persona_id BIGINT NOT NULL,
    tier1_user_id BIGINT REFERENCES users(id),
    tier1_persona_id BIGINT,
    tier2_user_id BIGINT REFERENCES users(id),
    tier2_persona_id BIGINT,
    tier3_user_id BIGINT REFERENCES users(id),
    tier3_persona_id BIGINT,
    referral_code_id BIGINT REFERENCES referral_codes(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral rewards (pending and claimed)
CREATE TABLE IF NOT EXISTS referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id),
    recipient_persona_id BIGINT NOT NULL,
    source_user_id BIGINT NOT NULL REFERENCES users(id),
    source_persona_id BIGINT NOT NULL,
    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
    amount_cents INT NOT NULL DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral stats (materialized for leaderboard)
CREATE TABLE IF NOT EXISTS referral_stats (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    persona_id BIGINT NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    tier1_count INTEGER DEFAULT 0,
    tier2_count INTEGER DEFAULT 0,
    tier3_count INTEGER DEFAULT 0,
    total_earnings_cents INT DEFAULT 0,
    last_referral_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_persona ON referral_codes(persona_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_hash ON referral_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_referral_chains_tiers ON referral_chains(tier1_user_id, tier2_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient ON referral_rewards(recipient_user_id, is_claimed);
CREATE INDEX IF NOT EXISTS idx_referral_stats_leaderboard ON referral_stats(total_referrals DESC);

-- Auto-update referral stats on new chain entry
CREATE OR REPLACE FUNCTION update_referral_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tier1_user_id IS NOT NULL THEN
        INSERT INTO referral_stats (user_id, persona_id, total_referrals, tier1_count, last_referral_at, updated_at)
        VALUES (NEW.tier1_user_id, COALESCE(NEW.tier1_persona_id, 0), 1, 1, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            total_referrals = referral_stats.total_referrals + 1,
            tier1_count = referral_stats.tier1_count + 1,
            last_referral_at = NOW(),
            updated_at = NOW();
    END IF;

    IF NEW.tier2_user_id IS NOT NULL THEN
        INSERT INTO referral_stats (user_id, persona_id, total_referrals, tier2_count, last_referral_at, updated_at)
        VALUES (NEW.tier2_user_id, COALESCE(NEW.tier2_persona_id, 0), 1, 1, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            total_referrals = referral_stats.total_referrals + 1,
            tier2_count = referral_stats.tier2_count + 1,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_referral_stats ON referral_chains;
CREATE TRIGGER trigger_update_referral_stats
AFTER INSERT ON referral_chains
FOR EACH ROW
EXECUTE FUNCTION update_referral_stats();
