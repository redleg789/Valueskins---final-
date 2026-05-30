-- Reputation Bootstrap Migration
-- Solves the cold-start problem for new creators by providing reputation seeds
-- from verified credentials and onboarding deals.

-- Reputation seeds from verified credentials and other sources
CREATE TABLE IF NOT EXISTS reputation_seeds (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    source VARCHAR(50) NOT NULL, -- 'credential', 'referral', 'onboarding_deal'
    seed_points INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, source)
);

CREATE INDEX idx_rep_seeds_user ON reputation_seeds(user_id);

-- Onboarding deals (guaranteed first deals for new creators)
CREATE TABLE IF NOT EXISTS onboarding_deals (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    required_profession_id BIGINT REFERENCES professions(id),
    reward_amount NUMERIC NOT NULL DEFAULT 50,
    max_claims INTEGER NOT NULL DEFAULT 100,
    claimed_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed some onboarding deals
INSERT INTO onboarding_deals (title, description, reward_amount, max_claims) VALUES
    ('First Creator Deal', 'Complete your profile and submit a sample deliverable to earn your first reputation points', 50, 1000),
    ('Credential Verification Bonus', 'Link your GitHub or LinkedIn to earn bonus reputation', 25, 5000)
ON CONFLICT DO NOTHING;
