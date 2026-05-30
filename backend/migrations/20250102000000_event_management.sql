-- Up migration for Event Management Architecture
-- ==========================================

-- 1. Update users role check to allow explorer
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('creator', 'brand', 'explorer'));

-- 2. Events table
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    host_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    ticket_price_cents INT NOT NULL DEFAULT 0,
    community_id BIGINT REFERENCES communities(id) ON DELETE SET NULL,
    attendee_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_user_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);

-- 3. Event attendees
CREATE TABLE IF NOT EXISTS event_attendees (
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'saved')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_att_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_att_status ON event_attendees(status);

-- 4. User preferred location (lightweight preferences for Explorer / all users)
-- This allows intent-based recommended events.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS preferred_city TEXT NOT NULL DEFAULT '';

-- 5. Trigger to increment/decrement events attendee_count
CREATE OR REPLACE FUNCTION update_event_attendee_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'going' THEN
            UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'going' THEN
            UPDATE events SET attendee_count = GREATEST(0, attendee_count - 1) WHERE id = OLD.event_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'going' AND NEW.status = 'going' THEN
            UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
        ELSIF OLD.status = 'going' AND NEW.status != 'going' THEN
            UPDATE events SET attendee_count = GREATEST(0, attendee_count - 1) WHERE id = NEW.event_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_attendee_count
    AFTER INSERT OR UPDATE OR DELETE ON event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_event_attendee_count();
