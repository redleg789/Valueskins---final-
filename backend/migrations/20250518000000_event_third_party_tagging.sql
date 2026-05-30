-- Event Third-Party Tagging System
-- ===============================
--
-- Hosts can tag separate ValueSkin profiles inside events.
-- Tagged profiles can approve/reject, hide associations, and audit changes.

CREATE TABLE IF NOT EXISTS event_tag_preferences (
    tagged_user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_tag BOOLEAN NOT NULL DEFAULT TRUE,
    trusted_host_allowlist BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_featured_people (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tagged_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tagged_persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    tagged_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    tag_type TEXT NOT NULL CHECK (tag_type IN (
        'Performer', 'Speaker', 'Guest', 'DJ', 'Venue Host',
        'Partner', 'Sponsor', 'Influencer', 'Featured Attendee',
        'Organizer', 'Collaborator'
    )),
    badge_label TEXT NOT NULL DEFAULT '',
    display_role TEXT NOT NULL DEFAULT '',
    descriptor TEXT,
    approval_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (approval_state IN ('pending', 'approved', 'rejected', 'hidden', 'removed')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_by_tagged_user BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    hidden_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    sort_order INT NOT NULL DEFAULT 0,
    tag_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, tagged_persona_id, tag_type)
);

CREATE INDEX IF NOT EXISTS idx_event_featured_people_event_state
    ON event_featured_people (event_id, approval_state, sort_order, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_featured_people_tagged_user
    ON event_featured_people (tagged_user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS event_tag_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_tag_id BIGINT REFERENCES event_featured_people(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'hidden', 'unhidden', 'removed', 'updated')),
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tag_audit_event
    ON event_tag_audit_logs (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_tag_daily_analytics (
    event_tag_id BIGINT NOT NULL REFERENCES event_featured_people(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    profile_views INT NOT NULL DEFAULT 0,
    tag_clicks INT NOT NULL DEFAULT 0,
    booking_conversions INT NOT NULL DEFAULT 0,
    repeat_appearances INT NOT NULL DEFAULT 0,
    PRIMARY KEY (event_tag_id, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_event_tag_daily_event
    ON event_tag_daily_analytics (event_id, bucket_date DESC);
