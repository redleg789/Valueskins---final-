-- Event Lifecycle, Retention, and Intelligence System
-- ==================================================
--
-- Principle:
-- Public event visibility is temporary.
-- Internal behavioral intelligence is permanent.

-- ──────────────────────────────────────────────────────────────
-- 1. HOT EVENT TABLE ENRICHMENT
-- ──────────────────────────────────────────────────────────────

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'general'
        CHECK (event_type IN (
            'house_party', 'networking', 'college_fest', 'startup_meetup',
            'music', 'private_gathering', 'workshop', 'general'
        )),
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS visibility_status TEXT NOT NULL DEFAULT 'active'
        CHECK (visibility_status IN ('active', 'ended_visible', 'archived')),
    ADD COLUMN IF NOT EXISTS storage_tier TEXT NOT NULL DEFAULT 'hot'
        CHECK (storage_tier IN ('hot', 'warm', 'cold')),
    ADD COLUMN IF NOT EXISTS public_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS warm_moved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cold_moved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_publicly_listed BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS search_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS discovery_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS recommendation_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS feed_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS attendee_list_public BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS search_index_status TEXT NOT NULL DEFAULT 'indexed'
        CHECK (search_index_status IN ('indexed', 'pending_removal', 'removed')),
    ADD COLUMN IF NOT EXISTS analytics_retained BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE events
SET public_expires_at = COALESCE(
        public_expires_at,
        COALESCE(end_time, start_time) + INTERVAL '7 days'
    ),
    visibility_status = CASE
        WHEN COALESCE(end_time, start_time) < NOW()
             AND COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW()
        THEN 'archived'
        WHEN COALESCE(end_time, start_time) < NOW()
        THEN 'ended_visible'
        ELSE 'active'
    END,
    storage_tier = CASE
        WHEN COALESCE(end_time, start_time) < NOW() - INTERVAL '30 days' THEN 'cold'
        WHEN COALESCE(end_time, start_time) < NOW() THEN 'warm'
        ELSE 'hot'
    END,
    is_publicly_listed = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    search_visible = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    discovery_visible = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    recommendation_visible = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    profile_visible = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    feed_visible = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    attendee_list_public = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW() THEN FALSE
        ELSE TRUE
    END,
    archived_at = CASE
        WHEN COALESCE(end_time, start_time) + INTERVAL '7 days' <= NOW()
        THEN COALESCE(archived_at, COALESCE(end_time, start_time) + INTERVAL '7 days')
        ELSE archived_at
    END
WHERE public_expires_at IS NULL
   OR visibility_status = 'active'
   OR storage_tier = 'hot';

ALTER TABLE events
    ALTER COLUMN public_expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_public_listing
    ON events (is_publicly_listed, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_visibility_status
    ON events (visibility_status, public_expires_at);
CREATE INDEX IF NOT EXISTS idx_events_storage_tier
    ON events (storage_tier, archived_at);
CREATE INDEX IF NOT EXISTS idx_events_search_visibility
    ON events (search_visible, search_index_status, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type_city
    ON events (event_type, location, start_time DESC);

-- ──────────────────────────────────────────────────────────────
-- 2. PUBLIC LIFECYCLE AUDIT
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_public_lifecycle_audit (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    previous_visibility_status TEXT,
    next_visibility_status TEXT NOT NULL,
    previous_storage_tier TEXT,
    next_storage_tier TEXT NOT NULL,
    reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_lifecycle_audit_event
    ON event_public_lifecycle_audit (event_id, changed_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 3. ARCHIVE SNAPSHOT TABLES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS archived_events (
    event_id BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    host_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    community_id BIGINT,
    attendee_count INT NOT NULL DEFAULT 0,
    ticket_price_cents INT NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived_at TIMESTAMPTZ NOT NULL,
    source_visibility_status TEXT NOT NULL,
    source_storage_tier TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archived_events_host
    ON archived_events (host_user_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_events_type
    ON archived_events (event_type, archived_at DESC);

CREATE TABLE IF NOT EXISTS cold_storage_events (
    event_id BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    compressed_snapshot BYTEA,
    analytics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    relationship_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    moved_to_cold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    object_storage_uri TEXT,
    compression_codec TEXT NOT NULL DEFAULT 'zstd'
);

-- ──────────────────────────────────────────────────────────────
-- 4. EVENT INTELLIGENCE CAPTURE TABLES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_interaction_events (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    interaction_type TEXT NOT NULL
        CHECK (interaction_type IN (
            'view', 'share', 'search_click', 'profile_click', 'ticket_click',
            'purchase_started', 'purchase_completed', 'invite_opened',
            'invite_accepted', 'save', 'unsave', 'recommendation_impression',
            'recommendation_click', 'attend', 'dropoff'
        )),
    source_type TEXT
        CHECK (source_type IN (
            'search', 'community', 'profile', 'invite', 'feed', 'recommendation', 'direct', 'unknown'
        )),
    referrer_event_id BIGINT,
    referrer_user_id BIGINT,
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    time_spent_seconds INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_interactions_event_time
    ON event_interaction_events (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_interactions_actor
    ON event_interaction_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_interactions_type
    ON event_interaction_events (interaction_type, source_type, created_at DESC);

CREATE TABLE IF NOT EXISTS event_conversion_attribution (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_count INT NOT NULL DEFAULT 1,
    purchase_source TEXT NOT NULL
        CHECK (purchase_source IN ('search', 'community', 'profile', 'invite', 'feed', 'recommendation', 'direct')),
    community_source_id BIGINT REFERENCES communities(id) ON DELETE SET NULL,
    invite_source_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    mutual_connection_count INT NOT NULL DEFAULT 0,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_conversion_event
    ON event_conversion_attribution (event_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_conversion_source
    ON event_conversion_attribution (purchase_source, converted_at DESC);

CREATE TABLE IF NOT EXISTS event_attendee_intelligence (
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    demographic_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    repeat_community_count INT NOT NULL DEFAULT 0,
    repeat_event_type_count INT NOT NULL DEFAULT 0,
    collaboration_after_event BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendee_intel_user
    ON event_attendee_intelligence (user_id, registered_at DESC);

CREATE TABLE IF NOT EXISTS event_relationship_edges (
    id BIGSERIAL PRIMARY KEY,
    user_a_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL
        CHECK (edge_type IN ('co_attendance', 'repeat_co_attendance', 'collaboration', 'community_overlap')),
    weight NUMERIC(10,2) NOT NULL DEFAULT 1.0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (user_a_id, user_b_id, event_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_event_relationship_edges_user_a
    ON event_relationship_edges (user_a_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_relationship_edges_event
    ON event_relationship_edges (event_id, edge_type);

CREATE TABLE IF NOT EXISTS event_analytics_daily (
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    host_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    page_views INT NOT NULL DEFAULT 0,
    unique_viewers INT NOT NULL DEFAULT 0,
    shares INT NOT NULL DEFAULT 0,
    saves INT NOT NULL DEFAULT 0,
    ticket_clicks INT NOT NULL DEFAULT 0,
    purchases_started INT NOT NULL DEFAULT 0,
    tickets_sold INT NOT NULL DEFAULT 0,
    attendance_count INT NOT NULL DEFAULT 0,
    repeat_attendance_count INT NOT NULL DEFAULT 0,
    dropoff_count INT NOT NULL DEFAULT 0,
    total_time_spent_seconds BIGINT NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_event_analytics_daily_bucket
    ON event_analytics_daily (bucket_date DESC, event_type, city);

CREATE TABLE IF NOT EXISTS event_intelligence_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    top_event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_cities JSONB NOT NULL DEFAULT '[]'::jsonb,
    repeat_community_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    attendance_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
    tribe_cluster_key TEXT,
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 5. REPORTING + AI INSIGHT OUTPUT
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_report_runs (
    id BIGSERIAL PRIMARY KEY,
    report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    generated_at TIMESTAMPTZ,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (report_type, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS event_report_insights (
    id BIGSERIAL PRIMARY KEY,
    report_run_id BIGINT NOT NULL REFERENCES event_report_runs(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL
        CHECK (insight_type IN ('pattern', 'anomaly', 'recommendation', 'growth_opportunity', 'network_shift')),
    headline TEXT NOT NULL,
    supporting_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority_score NUMERIC(8,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 6. ADMIN ANALYTICS MATERIALIZED VIEWS
-- ──────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS admin_event_category_performance AS
SELECT
    e.event_type,
    e.category,
    COUNT(*)::BIGINT AS total_events,
    COALESCE(SUM(d.attendance_count), 0)::BIGINT AS attendance_total,
    COALESCE(AVG(d.conversion_rate), 0)::NUMERIC(8,4) AS avg_conversion_rate,
    COALESCE(SUM(d.repeat_attendance_count), 0)::BIGINT AS repeat_attendance_total
FROM events e
LEFT JOIN event_analytics_daily d ON d.event_id = e.id
GROUP BY e.event_type, e.category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_event_category_performance_unique
    ON admin_event_category_performance (event_type, category);

CREATE MATERIALIZED VIEW IF NOT EXISTS admin_event_city_performance AS
SELECT
    e.location AS city,
    COUNT(*)::BIGINT AS total_events,
    COALESCE(SUM(d.attendance_count), 0)::BIGINT AS attendance_total,
    COALESCE(SUM(d.tickets_sold), 0)::BIGINT AS tickets_sold_total,
    COALESCE(AVG(d.conversion_rate), 0)::NUMERIC(8,4) AS avg_conversion_rate
FROM events e
LEFT JOIN event_analytics_daily d ON d.event_id = e.id
GROUP BY e.location;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_event_city_performance_unique
    ON admin_event_city_performance (city);

CREATE MATERIALIZED VIEW IF NOT EXISTS admin_event_host_performance AS
SELECT
    e.host_user_id,
    COUNT(*)::BIGINT AS hosted_events,
    COALESCE(SUM(d.attendance_count), 0)::BIGINT AS attendance_total,
    COALESCE(SUM(d.tickets_sold), 0)::BIGINT AS tickets_sold_total,
    COALESCE(AVG(d.conversion_rate), 0)::NUMERIC(8,4) AS avg_conversion_rate
FROM events e
LEFT JOIN event_analytics_daily d ON d.event_id = e.id
GROUP BY e.host_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_event_host_performance_unique
    ON admin_event_host_performance (host_user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS admin_event_network_overlap AS
SELECT
    LEAST(user_a_id, user_b_id) AS node_a,
    GREATEST(user_a_id, user_b_id) AS node_b,
    COUNT(*)::BIGINT AS shared_events,
    COALESCE(SUM(weight), 0)::NUMERIC(10,2) AS total_weight
FROM event_relationship_edges
GROUP BY LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_event_network_overlap_unique
    ON admin_event_network_overlap (node_a, node_b);
