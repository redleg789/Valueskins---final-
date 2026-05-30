-- Migration: MIM (Marketplace Inside Marketplace) Schema
-- PATENT-RELEVANT: Dual-Perspective Asymmetric Marketplace
--
-- This schema supports the core patentable mechanism:
-- brand_creator_matches stores TWO different scores for the SAME match pair.
-- opportunity_fit_score = what the CREATOR sees (ranked by how good the deal is for them)
-- creator_quality_score = what the BRAND sees (ranked by how good the creator is for them)
--
-- This asymmetric scoring is fundamentally different from symmetric marketplaces
-- (Indeed, Upwork, Fiverr) where both parties see the same listing/ranking.

-- Brand-creator match cache (updated hourly via background job)
-- PATENT: Stores asymmetric scores — same pair, different perspectives
CREATE TABLE IF NOT EXISTS brand_creator_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    profession_id BIGINT NOT NULL REFERENCES professions(id),

    -- Asymmetric scores (the patent-worthy mechanism)
    opportunity_fit_score INT NOT NULL DEFAULT 0,   -- Creator sees this (0-10000)
    creator_quality_score INT NOT NULL DEFAULT 0,   -- Brand sees this (0-10000)

    -- Score components (for breakdown UI)
    category_affinity_score INT NOT NULL DEFAULT 0,  -- Shared component
    engagement_match_score INT NOT NULL DEFAULT 0,   -- Weighted differently per perspective
    level_bonus_score INT NOT NULL DEFAULT 0,        -- Weighted differently per perspective

    -- Match metadata
    match_reason TEXT,                               -- System-generated explanation
    price_estimate INT,                              -- Estimated deal value in cents
    status TEXT NOT NULL DEFAULT 'pending',           -- pending, contacted, accepted, rejected

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(brand_id, persona_id, profession_id)
);

-- Indexes for dual-view queries
-- Creator view: "Show me brands ranked by how good they are for me"
CREATE INDEX IF NOT EXISTS idx_matches_creator_view
    ON brand_creator_matches(persona_id, opportunity_fit_score DESC)
    WHERE status != 'rejected';

-- Brand view: "Show me creators ranked by how good they are for my campaign"
CREATE INDEX IF NOT EXISTS idx_matches_brand_view
    ON brand_creator_matches(brand_id, creator_quality_score DESC)
    WHERE status != 'rejected';

-- Brand campaigns
CREATE TABLE IF NOT EXISTS brand_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    campaign_type TEXT NOT NULL DEFAULT 'Sponsorship',
    budget_amount INT DEFAULT 0,
    required_profession_id BIGINT,
    required_min_level INT DEFAULT 1,
    slots_available INT DEFAULT 1,
    slots_filled INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active ON brand_campaigns(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON brand_campaigns(brand_id, is_active);

-- Match applications (when a creator applies to a brand deal)
CREATE TABLE IF NOT EXISTS match_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES brand_creator_matches(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES brand_campaigns(id) ON DELETE SET NULL,
    applicant_persona_id BIGINT NOT NULL REFERENCES personas(id),
    cover_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,

    UNIQUE(match_id, applicant_persona_id)
);

CREATE INDEX IF NOT EXISTS idx_match_applications_status ON match_applications(status, applied_at DESC);
