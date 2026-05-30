-- Migration: User Stickers (ValueSkins)
-- PATENT-RELEVANT: Instant-grant access via database with optional async blockchain minting
--
-- Flow:
--   1. User purchases ValueSkin ($10) -> row inserted in user_stickers INSTANTLY
--   2. Marketplace access granted based on user_stickers (database is source of truth)
--   3. Optional: background job can mint credential on-chain asynchronously
--   4. User never waits for any blockchain confirmation

-- User-facing sticker ownership
CREATE TABLE IF NOT EXISTS user_stickers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id),
    persona_id BIGINT REFERENCES personas(id),
    profession_id BIGINT NOT NULL REFERENCES professions(id),
    slot VARCHAR(20) NOT NULL DEFAULT 'hobby' CHECK (slot IN ('hobby', 'passion', 'profession')),
    tier INT NOT NULL DEFAULT 1,

    -- Payment tracking
    payment_method VARCHAR(50) DEFAULT 'stripe',
    payment_id VARCHAR(255),
    amount_paid_cents INT NOT NULL DEFAULT 1000,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, profession_id)
);

CREATE INDEX IF NOT EXISTS idx_stickers_user ON user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_stickers_persona ON user_stickers(persona_id);

-- Marketplace access check function
-- Gates /marketplace access — pure database, no external dependencies
CREATE OR REPLACE FUNCTION has_marketplace_access(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM user_stickers
        WHERE user_id = p_user_id
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Level pricing multiplier function
-- Level directly determines pricing multiplier
CREATE OR REPLACE FUNCTION get_level_multiplier(p_level INT)
RETURNS DECIMAL AS $$
BEGIN
    RETURN CASE p_level
        WHEN 1 THEN 1.0
        WHEN 2 THEN 1.5
        WHEN 3 THEN 2.5
        WHEN 4 THEN 5.0
        WHEN 5 THEN 10.0
        ELSE 1.0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
