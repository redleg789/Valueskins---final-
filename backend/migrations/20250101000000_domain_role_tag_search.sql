-- DOMAIN → ROLE → TAG SEARCH ARCHITECTURE
-- ──────────────────────────────────────────────────────────────────────────
-- Three-layer identity taxonomy for ValueSkins discoverability.
--
-- Layer 1: Domains (platform-controlled, ~20-30 broad categories)
-- Layer 2: Roles (platform-controlled, belong to one domain)
-- Layer 3: User Tags (user-generated descriptors — skills, locations, etc.)
--
-- This replaces the flat professions table with a structured, searchable
-- hierarchy that supports infinite specificity without a giant taxonomy.

-- ──────────────────────────────────────────────────────────────────────────
-- LAYER 1: DOMAINS (platform-controlled)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,           -- e.g., "music", "business"
    name VARCHAR(100) NOT NULL,                  -- e.g., "Music", "Business"
    description TEXT,
    icon_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,           -- admin-controlled display order
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    role_count INT NOT NULL DEFAULT 0,           -- denormalized for fast reads
    user_count INT NOT NULL DEFAULT 0,           -- users with any role in this domain
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domains_slug ON search_domains(slug);
CREATE INDEX idx_domains_active ON search_domains(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_domains_sort ON search_domains(sort_order);

-- ──────────────────────────────────────────────────────────────────────────
-- LAYER 2: ROLES (platform-controlled, belong to one domain)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES search_domains(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,                  -- e.g., "guitarist", "pilot"
    name VARCHAR(100) NOT NULL,                  -- e.g., "Guitarist", "Pilot"
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    user_count INT NOT NULL DEFAULT 0,           -- denormalized
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(domain_id, slug)
);

CREATE INDEX idx_roles_domain ON search_roles(domain_id);
CREATE INDEX idx_roles_slug ON search_roles(slug);
CREATE INDEX idx_roles_active ON search_roles(is_active, domain_id) WHERE is_active = TRUE;

-- ──────────────────────────────────────────────────────────────────────────
-- LAYER 3: TAG CATEGORIES (structured tag types)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,            -- "skill", "specialization", "industry", "location", "opportunity", "interest"
    name VARCHAR(50) NOT NULL,                   -- "Skill", "Specialization", etc.
    description TEXT,
    max_per_user INT NOT NULL DEFAULT 5,         -- max tags from this category per user
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tag_categories (slug, name, description, max_per_user, sort_order) VALUES
    ('skill', 'Skill', 'Technical or creative abilities', 5, 1),
    ('specialization', 'Specialization', 'Narrow focus within a role', 3, 2),
    ('industry', 'Industry', 'Industry or sector', 3, 3),
    ('location', 'Location', 'Geographic area or work mode', 3, 4),
    ('opportunity', 'Opportunity Type', 'Types of work or deals available', 4, 5),
    ('interest', 'Interest', 'Personal interests and preferences', 3, 6)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- TAG DICTIONARY (approved/canonical tags with analytics)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES tag_categories(id),
    slug VARCHAR(100) NOT NULL UNIQUE,           -- normalized: "electric-guitar"
    canonical_name VARCHAR(100) NOT NULL,        -- display: "Electric Guitar"
    is_suggested BOOLEAN NOT NULL DEFAULT FALSE, -- AI-curated suggestion
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,     -- blocked term
    usage_count INT NOT NULL DEFAULT 0,          -- total times used
    search_count INT NOT NULL DEFAULT 0,         -- times appeared in searches
    selection_count INT NOT NULL DEFAULT 0,      -- times selected by users
    quality_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0-100 quality metric
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dict_slug ON tag_dictionary(slug);
CREATE INDEX idx_dict_category ON tag_dictionary(category_id);
CREATE INDEX idx_dict_suggested ON tag_dictionary(is_suggested) WHERE is_suggested = TRUE;
CREATE INDEX idx_dict_banned ON tag_dictionary(is_banned) WHERE is_banned = TRUE;
CREATE INDEX idx_dict_quality ON tag_dictionary(quality_score DESC);

-- GIN trigram index for fuzzy matching on canonical names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_dict_name_trgm ON tag_dictionary USING gin (canonical_name gin_trgm_ops);
CREATE INDEX idx_dict_slug_trgm ON tag_dictionary USING gin (slug gin_trgm_ops);

-- ──────────────────────────────────────────────────────────────────────────
-- USER TAGS (what each user has selected)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id BIGINT NOT NULL REFERENCES personas(id),
    tag_id UUID NOT NULL REFERENCES tag_dictionary(id),
    source VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user', 'ai_suggested', 'admin'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(persona_id, tag_id)
);

CREATE INDEX idx_user_tags_persona ON user_tags(persona_id);
CREATE INDEX idx_user_tags_tag ON user_tags(tag_id);
CREATE INDEX idx_user_tags_source ON user_tags(source);

-- ──────────────────────────────────────────────────────────────────────────
-- USER ROLE ASSIGNMENT (replaces persona_professions for search)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id BIGINT NOT NULL REFERENCES personas(id),
    role_id UUID NOT NULL REFERENCES search_roles(id),
    domain_id UUID NOT NULL REFERENCES search_domains(id),
    level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,   -- primary identity role
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(persona_id, role_id)
);

CREATE INDEX idx_user_roles_persona ON user_role_assignments(persona_id);
CREATE INDEX idx_user_roles_role ON user_role_assignments(role_id);
CREATE INDEX idx_user_roles_domain ON user_role_assignments(domain_id);
CREATE INDEX idx_user_roles_primary ON user_role_assignments(persona_id) WHERE is_primary = TRUE;

-- ──────────────────────────────────────────────────────────────────────────
-- SYNONYM MAPPINGS (guitar player → guitarist, etc.)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(100) NOT NULL UNIQUE,           -- "guitar player", "dj"
    canonical VARCHAR(100) NOT NULL,             -- "guitarist", "disc jockey"
    term_type VARCHAR(20) NOT NULL DEFAULT 'role', -- 'role', 'tag', 'domain'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_synonyms_term ON search_synonyms(term);
CREATE INDEX idx_synonyms_canonical ON search_synonyms(canonical);

-- ──────────────────────────────────────────────────────────────────────────
-- SEARCH INDEX (denormalized flat view for fast text search)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id BIGINT NOT NULL UNIQUE REFERENCES personas(id),
    domain_ids UUID[] NOT NULL DEFAULT '{}',
    role_ids UUID[] NOT NULL DEFAULT '{}',
    tag_ids UUID[] NOT NULL DEFAULT '{}',
    tag_slugs TEXT[] NOT NULL DEFAULT '{}',
    searchable_text TSVECTOR NOT NULL,
    -- Ranking signals
    trust_score DECIMAL(5,2) NOT NULL DEFAULT 50,
    activity_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    marketplace_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    reputation_score DECIMAL(5,2) NOT NULL DEFAULT 50,
    location_preference TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX idx_search_text ON search_index USING gin (searchable_text);
CREATE INDEX idx_search_trust ON search_index(trust_score DESC);
CREATE INDEX idx_search_domain_ids ON search_index USING gin (domain_ids);
CREATE INDEX idx_search_role_ids ON search_index USING gin (role_ids);

-- ──────────────────────────────────────────────────────────────────────────
-- SEARCH LOGS (analytics + query optimization)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_logs (
    id BIGSERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    domain_filter UUID,
    role_filter UUID,
    tag_filters UUID[],
    result_count INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    user_id BIGINT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_logs_query ON search_logs USING gin (query_text gin_trgm_ops);
CREATE INDEX idx_search_logs_created ON search_logs(created_at);
CREATE INDEX idx_search_logs_domain ON search_logs(domain_filter);

-- ──────────────────────────────────────────────────────────────────────────
-- TAG ANALYTICS (quality engine data)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES tag_dictionary(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    search_appearances INT NOT NULL DEFAULT 0,
    selection_rate DECIMAL(5,4) NOT NULL DEFAULT 0, -- selections / appearances
    rejection_count INT NOT NULL DEFAULT 0,         -- times removed by users
    report_count INT NOT NULL DEFAULT 0,            -- abuse reports
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tag_id, period_start)
);

CREATE INDEX idx_tag_analytics_tag ON tag_analytics(tag_id);
CREATE INDEX idx_tag_analytics_period ON tag_analytics(period_start, period_end);

-- ──────────────────────────────────────────────────────────────────────────
-- TAG REPORTS (moderation)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_persona_id BIGINT REFERENCES personas(id),
    tag_id UUID NOT NULL REFERENCES tag_dictionary(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, reviewed, actioned, dismissed
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_tag_reports_tag ON tag_reports(tag_id);
CREATE INDEX idx_tag_reports_status ON tag_reports(status);

-- ──────────────────────────────────────────────────────────────────────────
-- BANNED TERMS LIST (anti-spam)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banned_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'profanity', -- profanity, impersonation, spam, irrelevant
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banned_terms_term ON banned_terms(term);
CREATE INDEX idx_banned_terms_category ON banned_terms(category);

-- Seed banned terms (attention-hacking, impersonation, etc.)
INSERT INTO banned_terms (term, category) VALUES
    ('viral', 'spam'),
    ('famous', 'spam'),
    ('millionaire', 'irrelevant'),
    ('billionaire', 'irrelevant'),
    ('elon musk', 'impersonation'),
    ('ceo of', 'impersonation'),
    ('verified', 'spam'),
    ('official', 'spam')
ON CONFLICT (term) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ──────────────────────────────────────────────────────────────────────────

-- Update search_index when user tags or roles change
CREATE OR REPLACE FUNCTION rebuild_search_index(p_persona_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_domain_ids UUID[];
    v_role_ids UUID[];
    v_tag_ids UUID[];
    v_tag_slugs TEXT[];
    v_search_text TEXT;
    v_location TEXT;
BEGIN
    -- Get domain and role IDs
    SELECT ARRAY_AGG(DISTINCT domain_id), ARRAY_AGG(DISTINCT role_id)
    INTO v_domain_ids, v_role_ids
    FROM user_role_assignments
    WHERE persona_id = p_persona_id;

    -- Get tag IDs and slugs
    SELECT ARRAY_AGG(DISTINCT t.id), ARRAY_AGG(DISTINCT t.slug)
    INTO v_tag_ids, v_tag_slugs
    FROM user_tags ut
    JOIN tag_dictionary t ON ut.tag_id = t.id
    WHERE ut.persona_id = p_persona_id;

    -- Build searchable text
    SELECT string_agg(' ', ' ')
    INTO v_search_text
    FROM (
        -- Domain names
        SELECT sd.name AS term FROM search_domains sd
        WHERE sd.id = ANY(COALESCE(v_domain_ids, '{}'))
        UNION ALL
        -- Role names
        SELECT sr.name AS term FROM search_roles sr
        WHERE sr.id = ANY(COALESCE(v_role_ids, '{}'))
        UNION ALL
        -- Tag canonical names
        SELECT td.canonical_name AS term FROM tag_dictionary td
        WHERE td.id = ANY(COALESCE(v_tag_ids, '{}'))
    ) combined;

    -- Get location preference from tags
    SELECT td.canonical_name
    INTO v_location
    FROM user_tags ut
    JOIN tag_dictionary td ON ut.tag_id = td.id
    JOIN tag_categories tc ON td.category_id = tc.id
    WHERE ut.persona_id = p_persona_id
      AND tc.slug = 'location'
    LIMIT 1;

    -- Upsert into search_index
    INSERT INTO search_index (
        persona_id, domain_ids, role_ids, tag_ids, tag_slugs,
        searchable_text, location_preference, updated_at
    )
    VALUES (
        p_persona_id,
        COALESCE(v_domain_ids, '{}'),
        COALESCE(v_role_ids, '{}'),
        COALESCE(v_tag_ids, '{}'),
        COALESCE(v_tag_slugs, '{}'),
        to_tsvector('english', COALESCE(v_search_text, '')),
        v_location,
        NOW()
    )
    ON CONFLICT (persona_id) DO UPDATE SET
        domain_ids = EXCLUDED.domain_ids,
        role_ids = EXCLUDED.role_ids,
        tag_ids = EXCLUDED.tag_ids,
        tag_slugs = EXCLUDED.tag_slugs,
        searchable_text = EXCLUDED.searchable_text,
        location_preference = EXCLUDED.location_preference,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger: rebuild index when user tags change
CREATE OR REPLACE FUNCTION trigger_rebuild_search_index()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM rebuild_search_index(COALESCE(NEW.persona_id, OLD.persona_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_tags_rebuild_index
    AFTER INSERT OR UPDATE OR DELETE ON user_tags
    FOR EACH ROW EXECUTE FUNCTION trigger_rebuild_search_index();

CREATE TRIGGER trg_user_roles_rebuild_index
    AFTER INSERT OR UPDATE OR DELETE ON user_role_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_rebuild_search_index();

-- Trigger: update denormalized counts on roles/domains
CREATE OR REPLACE FUNCTION update_role_user_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE search_roles SET user_count = user_count + 1 WHERE id = NEW.role_id;
        UPDATE search_domains SET user_count = user_count + 1, role_count = (
            SELECT COUNT(DISTINCT role_id) FROM user_role_assignments
            WHERE domain_id = (SELECT domain_id FROM search_roles WHERE id = NEW.role_id)
        ) WHERE id = (SELECT domain_id FROM search_roles WHERE id = NEW.role_id);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE search_roles SET user_count = GREATEST(user_count - 1, 0) WHERE id = OLD.role_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_role_counts
    AFTER INSERT OR DELETE ON user_role_assignments
    FOR EACH ROW EXECUTE FUNCTION update_role_user_count();

-- Trigger: update tag dictionary usage counts
CREATE OR REPLACE FUNCTION update_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tag_dictionary SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tag_dictionary SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.tag_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tag_usage
    AFTER INSERT OR DELETE ON user_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_usage();

-- ──────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ──────────────────────────────────────────────────────────────────────────

-- Normalize tag input (lowercase, trim, hyphenate)
CREATE OR REPLACE FUNCTION normalize_tag(p_input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(trim(regexp_replace(p_input, '[^a-zA-Z0-9\s]', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if a term is banned
CREATE OR REPLACE FUNCTION is_banned_term(p_term TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS(
        SELECT 1 FROM banned_terms
        WHERE lower(term) = lower(trim(p_term))
    );
$$ LANGUAGE SQL STABLE;

-- Resolve synonym (guitar player → guitarist)
CREATE OR REPLACE FUNCTION resolve_synonym(p_term TEXT)
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT canonical FROM search_synonyms WHERE lower(term) = lower(trim(p_term))),
        trim(p_term)
    );
$$ LANGUAGE SQL STABLE;
