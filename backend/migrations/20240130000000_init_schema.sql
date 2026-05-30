-- Users — authenticated via Instagram OAuth (Meta Graph API)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    instagram_user_id VARCHAR(64) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'brand')),
    followers_count BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_instagram ON users(instagram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Personas — public-facing identity on the platform
CREATE TABLE IF NOT EXISTS personas (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
    owner_address VARCHAR(255) NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    avatar_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exists BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_personas_owner ON personas(owner_user_id);

-- Professions — the ValueSkin categories
CREATE TABLE IF NOT EXISTS professions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Persona Professions — which ValueSkins a user has equipped
CREATE TABLE IF NOT EXISTS persona_professions (
    persona_id BIGINT REFERENCES personas(id),
    profession_id BIGINT REFERENCES professions(id),
    slot VARCHAR(20) NOT NULL DEFAULT 'hobby' CHECK (slot IN ('hobby', 'passion', 'profession')),
    level INT NOT NULL DEFAULT 1,
    real_score BIGINT NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (persona_id, profession_id)
);

-- Social Graph
CREATE TABLE IF NOT EXISTS follows (
    follower_id BIGINT REFERENCES personas(id),
    following_id BIGINT REFERENCES personas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Content
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_persona_id BIGINT REFERENCES personas(id),
    content TEXT NOT NULL,
    media_urls TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID REFERENCES posts(id),
    persona_id BIGINT REFERENCES personas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, persona_id)
);
