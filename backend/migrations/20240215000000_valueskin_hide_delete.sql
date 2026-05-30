-- Migration: ValueSkin Hide & Delete Feature
-- Allows users to temporarily hide or permanently delete their ValueSkins
-- Hidden skins are invisible to marketplace/communities but data is preserved
-- Deleted skins are soft-deleted (timestamp recorded) for audit trail

-- Add new columns to user_stickers
ALTER TABLE user_stickers
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for finding active, non-hidden skins
CREATE INDEX IF NOT EXISTS idx_stickers_active
ON user_stickers(user_id)
WHERE is_active = TRUE AND is_hidden = FALSE AND deleted_at IS NULL;

-- Index for deleted skins (for audit/recovery)
CREATE INDEX IF NOT EXISTS idx_stickers_deleted
ON user_stickers(user_id, deleted_at)
WHERE deleted_at IS NOT NULL;

-- Update marketplace access function to exclude hidden and deleted skins
CREATE OR REPLACE FUNCTION has_marketplace_access(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM user_stickers
        WHERE user_id = p_user_id
        AND is_active = TRUE
        AND is_hidden = FALSE
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;
