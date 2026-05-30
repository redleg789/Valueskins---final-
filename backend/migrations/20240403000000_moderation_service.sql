-- MODERATION SERVICE SCHEMA
-- Extends the existing moderation_queue table with appeals,
-- report tracking, and user restrictions.

-- Track who submitted each report (many reporters can report same target)
CREATE TABLE IF NOT EXISTS report_creators (
    id BIGSERIAL PRIMARY KEY,
    queue_item_id BIGINT NOT NULL REFERENCES moderation_queue(id) ON DELETE CASCADE,
    reporter_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (queue_item_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_rc_reporter ON report_creators(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_rc_queue ON report_creators(queue_item_id);

COMMENT ON TABLE report_creators IS 'Tracks who submitted each report. Supports multiple reporters per target.';

-- Appeals against moderation actions
CREATE TABLE IF NOT EXISTS appeals (
    id BIGSERIAL PRIMARY KEY,
    queue_item_id BIGINT NOT NULL REFERENCES moderation_queue(id) ON DELETE CASCADE,
    appellant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    supporting_evidence JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resolved', 'dismissed')),
    reviewed_by_user_id BIGINT REFERENCES users(id),
    reviewer_notes TEXT,
    resolution TEXT
        CHECK (resolution IS NULL OR resolution IN ('UPHELD', 'OVERTURNED', 'PARTIALLY_UPHELD')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_queue ON appeals(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant_user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

COMMENT ON TABLE appeals IS 'User appeals against moderation actions. Allows overturned suspensions.';

-- Feature-level restrictions on users (less severe than full suspension)
CREATE TABLE IF NOT EXISTS user_restrictions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restriction_type TEXT NOT NULL
        CHECK (restriction_type IN (
            'MESSAGING_DISABLED',
            'SEARCH_DISABLED',
            'PROFILE_HIDDEN',
            'CONNECTION_DISABLED',
            'VALUESKIN_CREATION_DISABLED',
            'SUSPENDED'
        )),
    reason TEXT NOT NULL,
    queue_item_id BIGINT REFERENCES moderation_queue(id),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ur_user ON user_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ur_active ON user_restrictions(user_id) WHERE is_active = TRUE;

COMMENT ON TABLE user_restrictions IS 'Feature-level restrictions on users. Less severe than suspension.';

-- Trigger to update appeals.updated_at
CREATE OR REPLACE FUNCTION update_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_appeals_updated_at ON appeals;
CREATE TRIGGER update_appeals_updated_at
    BEFORE UPDATE ON appeals
    FOR EACH ROW
    EXECUTE FUNCTION update_appeals_updated_at();

-- Auto-expire restrictions past their expiry
CREATE OR REPLACE FUNCTION expire_restrictions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_restrictions
    SET is_active = FALSE
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = TRUE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
