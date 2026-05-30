-- Brands — companies and organizations on the platform
CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    logo_uri TEXT,
    website_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    min_score INT DEFAULT 0,
    budget_range TEXT,
    engagement_rate_min DECIMAL(5,2) DEFAULT 0,
    preferred_categories TEXT[] DEFAULT '{}',
    budget_min INT DEFAULT 0,
    budget_max INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(is_active) WHERE is_active = TRUE;
