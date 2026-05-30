-- ==========================================================================
-- Communities Schema: Gated Groups for ValueSkin Holders
-- ==========================================================================
-- Implements:
--   * Public/private communities with ValueSkin gates
--   * Specific profession requirements or any-ValueSkin gate
--   * Tier requirements (community vs marketplace)
--   * Member management with roles (owner, admin, member)
--   * Community posts with pinning and announcements
--   * Like system for posts
--   * Meta-controlled two-tier ValueSkin pricing

-- ──────────────────────────────────────────────────────────────
-- 1. VALUESKIN PRICING (Meta-controlled)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS valueskin_pricing (
    id                  BIGSERIAL PRIMARY KEY,
    profession_id       BIGINT REFERENCES professions(id) ON DELETE CASCADE,
    -- NULL profession_id = global default (applies to all professions without a specific row)
    tier                TEXT NOT NULL CHECK (tier IN ('community', 'marketplace')),
    price_credits       INT NOT NULL DEFAULT 0,
    price_usd_cents     INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_user_id  BIGINT REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profession_id, tier)
);

-- Seed defaults
INSERT INTO valueskin_pricing (profession_id, tier, price_credits, price_usd_cents)
VALUES (NULL, 'community', 0, 0), (NULL, 'marketplace', 100, 999)
ON CONFLICT DO NOTHING;

CREATE INDEX idx_vp_profession ON valueskin_pricing(profession_id);

-- ──────────────────────────────────────────────────────────────
-- 2. USER VALUESKIN TIERS (which tier per profession)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_valueskin_tiers (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profession      TEXT NOT NULL,
    tier            TEXT NOT NULL CHECK (tier IN ('community', 'marketplace')),
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, profession)
);

CREATE INDEX idx_uvt_user ON user_valueskin_tiers(user_id);

-- ──────────────────────────────────────────────────────────────
-- 3. COMMUNITIES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
    id              BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    description     TEXT,
    avatar_color    TEXT NOT NULL DEFAULT '#0066CC',
    avatar_abbr     TEXT NOT NULL DEFAULT 'COM',
    visibility      TEXT NOT NULL DEFAULT 'public'
                       CHECK (visibility IN ('public', 'private')),
    gate_type       TEXT NOT NULL DEFAULT 'any_valueskin'
                       CHECK (gate_type IN ('any_valueskin', 'specific')),
    required_tier   TEXT NOT NULL DEFAULT 'community'
                       CHECK (required_tier IN ('community', 'marketplace')),
    member_count    INT NOT NULL DEFAULT 1,
    post_count      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_owner   ON communities(owner_user_id);
CREATE INDEX idx_comm_public  ON communities(visibility) WHERE visibility = 'public';

-- ──────────────────────────────────────────────────────────────
-- 4. COMMUNITY GATES (specific professions required)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_gates (
    community_id  BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    profession    TEXT NOT NULL,
    PRIMARY KEY (community_id, profession)
);

-- ──────────────────────────────────────────────────────────────
-- 5. COMMUNITY MEMBERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_members (
    community_id  BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

CREATE INDEX idx_cm_user ON community_members(user_id);
CREATE INDEX idx_cm_community ON community_members(community_id);

-- ──────────────────────────────────────────────────────────────
-- 6. COMMUNITY POSTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
    id              BIGSERIAL PRIMARY KEY,
    community_id    BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_user_id  BIGINT NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    is_announcement BOOLEAN NOT NULL DEFAULT FALSE,
    like_count      INT NOT NULL DEFAULT 0,
    comment_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cp_community ON community_posts(community_id, created_at DESC);
CREATE INDEX idx_cp_author ON community_posts(author_user_id);

-- ──────────────────────────────────────────────────────────────
-- 7. COMMUNITY POST LIKES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_post_likes (
    post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- ──────────────────────────────────────────────────────────────
-- 8. TRIGGERS
-- ──────────────────────────────────────────────────────────────

-- Auto-increment community member_count
CREATE OR REPLACE FUNCTION bump_community_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.community_id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bump_member_count
AFTER INSERT OR DELETE ON community_members
FOR EACH ROW EXECUTE FUNCTION bump_community_member_count();

-- Auto-increment community post_count
CREATE OR REPLACE FUNCTION bump_community_post_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE communities SET post_count = post_count + 1 WHERE id = NEW.community_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bump_post_count
AFTER INSERT ON community_posts
FOR EACH ROW EXECUTE FUNCTION bump_community_post_count();

-- Auto-decrement community post_count
CREATE OR REPLACE FUNCTION decrement_community_post_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE communities SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.community_id;
    RETURN OLD;
END;
$$;
CREATE TRIGGER trg_decrement_post_count
AFTER DELETE ON community_posts
FOR EACH ROW EXECUTE FUNCTION decrement_community_post_count();

-- Auto-update like_count on post
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_update_post_like_count
AFTER INSERT OR DELETE ON community_post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_like_count();
