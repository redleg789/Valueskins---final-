-- Production Event Creation Schema
-- Extends the events table with all fields from the CreateEventForm
-- =========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. EXTEND EVENTS TABLE WITH NEW COLUMNS
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE events
    -- Basic Information
    ADD COLUMN IF NOT EXISTS event_name_display TEXT,
    ADD COLUMN IF NOT EXISTS event_type_detail TEXT NOT NULL DEFAULT 'in-person'
        CHECK (event_type_detail IN ('in-person', 'virtual', 'hybrid')),
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS one_line_summary TEXT,
    ADD COLUMN IF NOT EXISTS full_description TEXT,
    ADD COLUMN IF NOT EXISTS event_visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (event_visibility IN ('public', 'private', 'invite-only')),

    -- Date & Time (doors_open, last_entry stored in metadata; new cols here)
    ADD COLUMN IF NOT EXISTS doors_open_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_entry_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',

    -- Location
    ADD COLUMN IF NOT EXISTS venue_name TEXT,
    ADD COLUMN IF NOT EXISTS full_address TEXT,
    ADD COLUMN IF NOT EXISTS landmark TEXT,
    ADD COLUMN IF NOT EXISTS indoor_outdoor TEXT NOT NULL DEFAULT 'indoor'
        CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
    ADD COLUMN IF NOT EXISTS parking_available BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS valet_available BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS public_transport_nearby BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS address_reveal TEXT NOT NULL DEFAULT 'after-rsvp'
        CHECK (address_reveal IN ('immediately', 'after-rsvp', 'day-before')),

    -- Capacity
    ADD COLUMN IF NOT EXISTS max_attendees INT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS unlimited_tickets BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS invite_limit INT NOT NULL DEFAULT 0,

    -- Ticketing
    ADD COLUMN IF NOT EXISTS ticketing_model TEXT NOT NULL DEFAULT 'free'
        CHECK (ticketing_model IN ('free', 'paid')),
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS refund_policy TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
    ADD COLUMN IF NOT EXISTS ticket_sales_end_date TIMESTAMPTZ,

    -- Audience
    ADD COLUMN IF NOT EXISTS intended_audience TEXT,
    ADD COLUMN IF NOT EXISTS age_restriction INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gender_preferences TEXT NOT NULL DEFAULT 'any'
        CHECK (gender_preferences IN ('any', 'male', 'female', 'non-binary')),
    ADD COLUMN IF NOT EXISTS communities_targeted JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS interests_targeted JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS experience_level TEXT NOT NULL DEFAULT 'all-levels'
        CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'all-levels')),

    -- Vibe
    ADD COLUMN IF NOT EXISTS dress_code TEXT,
    ADD COLUMN IF NOT EXISTS event_vibe TEXT,
    ADD COLUMN IF NOT EXISTS music_genre TEXT,
    ADD COLUMN IF NOT EXISTS networking_level TEXT NOT NULL DEFAULT 'medium'
        CHECK (networking_level IN ('low', 'medium', 'high')),
    ADD COLUMN IF NOT EXISTS energy_level TEXT NOT NULL DEFAULT 'medium'
        CHECK (energy_level IN ('low', 'medium', 'high')),

    -- Rules
    ADD COLUMN IF NOT EXISTS id_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reentry_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS alcohol_rules TEXT,
    ADD COLUMN IF NOT EXISTS guest_rules TEXT,
    ADD COLUMN IF NOT EXISTS photography_rules TEXT,
    ADD COLUMN IF NOT EXISTS prohibited_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS security_rules TEXT,

    -- Contact
    ADD COLUMN IF NOT EXISTS host_contact TEXT,
    ADD COLUMN IF NOT EXISTS support_contact TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,

    -- Post-event settings
    ADD COLUMN IF NOT EXISTS event_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS attendee_visibility_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS photo_sharing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS networking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS follow_ups_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. TICKET TIERS TABLE
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_ticket_tiers (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tier_type TEXT NOT NULL DEFAULT 'general'
        CHECK (tier_type IN ('general', 'early-bird', 'vip', 'group', 'couple')),
    price_cents INT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 0,
    remaining INT NOT NULL DEFAULT 0,
    description TEXT,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    sale_start TIMESTAMPTZ,
    sale_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns for existing tables (idempotent for dev re-runs)
ALTER TABLE event_ticket_tiers ADD COLUMN IF NOT EXISTS sale_start TIMESTAMPTZ;
ALTER TABLE event_ticket_tiers ADD COLUMN IF NOT EXISTS sale_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_event
    ON event_ticket_tiers (event_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. FEATURED PEOPLE (complements the existing event_featured_people table)
-- ──────────────────────────────────────────────────────────────────────────

-- The existing event_featured_people table from 20250518000000 already exists.
-- We extend it with a sort_order column if not present.
ALTER TABLE event_featured_people
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_featured_people_sort
    ON event_featured_people (event_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. FAQ ENTRIES
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_faq_entries (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_suggested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_faq_entries_event
    ON event_faq_entries (event_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- 5. EVENT APPLICATIONS (for the apply/browse flow)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_applications (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_applications_event
    ON event_applications (event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_applications_user
    ON event_applications (user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. DATA SYNCHRONIZATION (backfill event_name_display from title)
-- ──────────────────────────────────────────────────────────────────────────

UPDATE events
SET
    event_name_display = COALESCE(event_name_display, title),
    venue_name = COALESCE(venue_name, location),
    full_address = COALESCE(full_address, location),
    one_line_summary = COALESCE(one_line_summary, LEFT(description, 120)),
    full_description = COALESCE(full_description, description)
WHERE event_name_display IS NULL
   OR venue_name IS NULL
   OR full_address IS NULL
   OR one_line_summary IS NULL
   OR full_description IS NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 7. INDEXES FOR NEW COLUMNS
-- ──────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_events_event_visibility
    ON events (event_visibility);
CREATE INDEX IF NOT EXISTS idx_events_event_type_detail
    ON events (event_type_detail);
CREATE INDEX IF NOT EXISTS idx_events_indoor_outdoor
    ON events (indoor_outdoor);
CREATE INDEX IF NOT EXISTS idx_events_ticketing_model
    ON events (ticketing_model);
CREATE INDEX IF NOT EXISTS idx_events_experience_level
    ON events (experience_level);
CREATE INDEX IF NOT EXISTS idx_events_age_restriction
    ON events (age_restriction);

-- ──────────────────────────────────────────────────────────────────────────
-- 8. SCHEDULE / AGENDA TABLE
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_schedule_items (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    time_label TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_schedule_items_event
    ON event_schedule_items (event_id, sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- 9. ADD LOGISTICS COLUMNS TO EVENTS TABLE
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS what_to_bring JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS food_and_drink TEXT,
    ADD COLUMN IF NOT EXISTS accessibility_info TEXT,
    ADD COLUMN IF NOT EXISTS weather_contingency TEXT,
    ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS event_website TEXT,
    ADD COLUMN IF NOT EXISTS event_language TEXT NOT NULL DEFAULT '';
