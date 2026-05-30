-- Transparent Scoring Schema
-- BLOCKER: Trust, verification, and fraud resistance layer
-- Stores score components with full audit trail

-- Score components (detailed breakdown)
CREATE TABLE IF NOT EXISTS persona_scores (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    profession_id BIGINT NOT NULL,
    activity_score INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    consistency_score INTEGER DEFAULT 0,
    verification_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    algorithm_version INTEGER DEFAULT 1,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_id, profession_id)
);

-- Score history (full audit trail)
CREATE TABLE IF NOT EXISTS score_history (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    profession_id BIGINT NOT NULL,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    old_level INTEGER NOT NULL,
    new_level INTEGER NOT NULL,
    score_delta INTEGER GENERATED ALWAYS AS (new_score - old_score) STORED,
    reason VARCHAR(255),
    computed_by VARCHAR(100), -- 'oracle', 'manual', 'system'
    algorithm_version INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity metrics (input data for scoring)
CREATE TABLE IF NOT EXISTS activity_metrics (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    profession_id BIGINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_posts INTEGER DEFAULT 0,
    posts_this_period INTEGER DEFAULT 0,
    likes_received INTEGER DEFAULT 0,
    comments_received INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    avg_days_between_posts NUMERIC(5,2),
    consecutive_active_days INTEGER DEFAULT 0,
    verified_credentials INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_id, profession_id, period_start)
);

-- Verified credentials
CREATE TABLE IF NOT EXISTS persona_credentials (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    credential_type VARCHAR(50) NOT NULL, -- 'twitter_verified', 'youtube_partner', 'github_contributor', etc.
    credential_data JSONB,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    verification_proof VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_id, credential_type)
);

-- Badges earned
CREATE TABLE IF NOT EXISTS persona_badges (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_id, name)
);

-- Scoring algorithm versions (for transparency)
CREATE TABLE IF NOT EXISTS scoring_algorithm_versions (
    version INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weights JSONB NOT NULL, -- {"activity": 3000, "engagement": 3000, ...}
    thresholds JSONB NOT NULL, -- {"level_2": 2000, "level_3": 4000, ...}
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deprecated_at TIMESTAMPTZ
);

-- Insert initial algorithm version
INSERT INTO scoring_algorithm_versions (version, name, description, weights, thresholds)
VALUES (
    1,
    'V1 Initial Algorithm',
    'First version of transparent scoring: Activity 30%, Engagement 30%, Consistency 20%, Verification 20%',
    '{"activity": 3000, "engagement": 3000, "consistency": 2000, "verification": 2000}',
    '{"level_2": 2000, "level_3": 4000, "level_4": 6000, "level_5": 8000}'
) ON CONFLICT (version) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_persona_scores_lookup ON persona_scores(persona_id, profession_id);
CREATE INDEX IF NOT EXISTS idx_score_history_persona ON score_history(persona_id, profession_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_metrics_period ON activity_metrics(persona_id, profession_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_persona_credentials_persona ON persona_credentials(persona_id);

-- Add score columns to persona_professions if not exists
ALTER TABLE persona_professions 
ADD COLUMN IF NOT EXISTS activity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consistency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verification_score INTEGER DEFAULT 0;
