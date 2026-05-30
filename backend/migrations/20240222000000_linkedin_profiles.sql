-- LinkedIn Profiles: Links a Valueskins user to their LinkedIn identity.
-- SHA-256 hash of profile_url stored for tamper detection.
-- is_public controls whether ValueSkins appear on the user's public LinkedIn profile view.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS linkedin_profiles (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            VARCHAR(50) NOT NULL DEFAULT 'linkedin',
    external_id         VARCHAR(255) NOT NULL,
    external_handle     VARCHAR(255),
    profile_url         TEXT NOT NULL,
    profile_hash        VARCHAR(64) NOT NULL,
    headline            TEXT,
    bio                 TEXT,
    profile_image_url   TEXT,
    company             TEXT,
    job_title           TEXT,
    location            TEXT,
    verified_at         TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_profiles_external_id
    ON linkedin_profiles(external_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id
    ON linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_verified
    ON linkedin_profiles(verified_at, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_public
    ON linkedin_profiles(is_public, verified_at) WHERE is_active = TRUE AND is_public = TRUE;

CREATE TRIGGER trg_linkedin_profiles_updated_at
    BEFORE UPDATE ON linkedin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
