-- Add reputation tier to community members
-- Tiers assigned automatically based on creator reputation score

ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS reputation_tier TEXT
    CHECK (reputation_tier IN ('senior', 'member', 'apprentice'))
    DEFAULT 'member';

CREATE INDEX IF NOT EXISTS idx_cm_tier ON community_members(community_id, reputation_tier);
