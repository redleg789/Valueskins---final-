-- Social Media Connections — external platform followers
CREATE TABLE IF NOT EXISTS social_media_accounts (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'twitch', 'snapchat')),
    platform_username VARCHAR(255) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    followers_count BIGINT NOT NULL DEFAULT 0,
    follower_count_last_synced_at TIMESTAMPTZ,
    bio_text TEXT,
    profile_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(persona_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_persona ON social_media_accounts(persona_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_media_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_followers ON social_media_accounts(followers_count DESC);

-- Profile metadata for searching — searchable fields
CREATE TABLE IF NOT EXISTS profile_metadata (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
    bio_text TEXT,
    location_city VARCHAR(255),
    location_country VARCHAR(255),
    location_country_code VARCHAR(2),
    interests TEXT[], -- e.g., ['music', 'fashion', 'tech']
    skills TEXT[], -- e.g., ['photography', 'videography', 'editing']
    languages TEXT[], -- e.g., ['english', 'hindi', 'spanish']
    experience_level VARCHAR(50) CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    primary_content_type VARCHAR(100), -- e.g., 'Reels', 'Shorts', 'Long-form'
    audience_age_range VARCHAR(50), -- e.g., '18-24', '25-34', '35-44'
    audience_gender VARCHAR(50), -- e.g., 'mixed', 'female-majority', 'male-majority'
    collaboration_openness BOOLEAN DEFAULT TRUE, -- willing to collaborate
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_metadata_persona ON profile_metadata(persona_id);
CREATE INDEX IF NOT EXISTS idx_profile_metadata_location ON profile_metadata(location_country, location_city);
CREATE INDEX IF NOT EXISTS idx_profile_metadata_interests ON profile_metadata USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_profile_metadata_skills ON profile_metadata USING GIN(skills);

-- Full-text search index for bios and descriptions
CREATE TABLE IF NOT EXISTS search_index (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
    -- Combined searchable content
    search_text TSVECTOR,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_text ON search_index USING GIN(search_text);

-- Follower sync history — track when we last updated counts
CREATE TABLE IF NOT EXISTS follower_sync_history (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    old_count BIGINT NOT NULL,
    new_count BIGINT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status VARCHAR(20) CHECK (sync_status IN ('success', 'failed', 'rate_limited'))
);

CREATE INDEX IF NOT EXISTS idx_sync_history_persona ON follower_sync_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_synced_at ON follower_sync_history(synced_at DESC);

-- Precomputed aggregates for fast filtering
CREATE TABLE IF NOT EXISTS creator_aggregate_stats (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
    total_followers BIGINT NOT NULL DEFAULT 0, -- sum across all platforms
    platforms_connected INT NOT NULL DEFAULT 0, -- count of connected platforms
    highest_follower_count BIGINT NOT NULL DEFAULT 0, -- max followers on any platform
    dominant_platform VARCHAR(50), -- platform with most followers
    engagement_score DECIMAL(5, 2) DEFAULT 0, -- 0-100 score based on activity
    collaborations_count INT DEFAULT 0, -- number of past collabs
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aggregate_persona ON creator_aggregate_stats(persona_id);
CREATE INDEX IF NOT EXISTS idx_aggregate_followers ON creator_aggregate_stats(total_followers DESC);

-- Function to update search_text whenever profile_metadata changes
CREATE OR REPLACE FUNCTION update_search_index()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO search_index (persona_id, search_text, updated_at)
    VALUES (
        NEW.persona_id,
        to_tsvector('english', COALESCE(NEW.bio_text, '') || ' ' ||
                              COALESCE(NEW.location_city, '') || ' ' ||
                              COALESCE(NEW.location_country, '') || ' ' ||
                              array_to_string(COALESCE(NEW.interests, ARRAY[]::text[]), ' ') || ' ' ||
                              array_to_string(COALESCE(NEW.skills, ARRAY[]::text[]), ' ')),
        NOW()
    )
    ON CONFLICT (persona_id) DO UPDATE SET
        search_text = to_tsvector('english', COALESCE(NEW.bio_text, '') || ' ' ||
                                              COALESCE(NEW.location_city, '') || ' ' ||
                                              COALESCE(NEW.location_country, '') || ' ' ||
                                              array_to_string(COALESCE(NEW.interests, ARRAY[]::text[]), ' ') || ' ' ||
                                              array_to_string(COALESCE(NEW.skills, ARRAY[]::text[]), ' ')),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_search_index
AFTER INSERT OR UPDATE ON profile_metadata
FOR EACH ROW EXECUTE FUNCTION update_search_index();

-- Function to aggregate follower stats
CREATE OR REPLACE FUNCTION update_aggregate_stats()
RETURNS TRIGGER AS $$
DECLARE
    total_followers BIGINT;
    platform_count INT;
    highest_followers BIGINT;
    dominant_plat VARCHAR(50);
BEGIN
    SELECT
        COALESCE(SUM(followers_count), 0),
        COUNT(*),
        MAX(followers_count)
    INTO total_followers, platform_count, highest_followers
    FROM social_media_accounts
    WHERE persona_id = NEW.persona_id AND is_active = TRUE;

    SELECT platform INTO dominant_plat
    FROM social_media_accounts
    WHERE persona_id = NEW.persona_id AND is_active = TRUE
    ORDER BY followers_count DESC
    LIMIT 1;

    INSERT INTO creator_aggregate_stats
    (persona_id, total_followers, platforms_connected, highest_follower_count, dominant_platform, last_updated_at)
    VALUES (NEW.persona_id, total_followers, platform_count, highest_followers, dominant_plat, NOW())
    ON CONFLICT (persona_id) DO UPDATE SET
        total_followers = total_followers,
        platforms_connected = platform_count,
        highest_follower_count = highest_followers,
        dominant_platform = dominant_plat,
        last_updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_aggregate_stats
AFTER INSERT OR UPDATE ON social_media_accounts
FOR EACH ROW EXECUTE FUNCTION update_aggregate_stats();
