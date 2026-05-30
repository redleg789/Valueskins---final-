-- PROFESSION EXPANSION SYSTEM
-- ──────────────────────────────────────────────────────────────────────────
-- This migration creates tables for the AI-powered profession discovery system.
--
-- FEATURES:
-- 1. profession_requests: User-submitted profession requests (e.g., "SDE2 at Meta")
-- 2. profession_approvals: Admin approval workflow + trending tracking
-- 3. trending_professions: AI-scanned professions ranked by demand
--
-- PATENT ANGLE: The system continuously scans user requests to identify
-- high-demand professions and auto-approve trending ones, creating a
-- dynamic profession catalog that evolves with creator demand.

CREATE TABLE profession_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    profession_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    request_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    request_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_requests_status (request_status),
    INDEX idx_requests_category (category)
);

CREATE TABLE profession_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profession_request_id UUID REFERENCES profession_requests(id),
    admin_email VARCHAR(255),
    approval_status VARCHAR(20), -- approved, rejected
    approval_reason TEXT,
    approved_at TIMESTAMP,
    trending BOOLEAN DEFAULT false,
    trending_rank INT,
    estimated_avg_deal INT,
    active_brands_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_approvals_trending (trending),
    INDEX idx_approvals_rank (trending_rank DESC)
);

CREATE TABLE trending_professions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profession_id VARCHAR(100), -- maps to lib/professions.ts ID
    profession_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    ai_score DECIMAL(10, 2), -- 0-100 trending score
    request_count INT DEFAULT 0,
    unique_requesters INT DEFAULT 0,
    estimated_avg_deal INT,
    active_brands INT DEFAULT 0,
    trending_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trending_until TIMESTAMP, -- expires after 30 days
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trending_score (ai_score DESC),
    INDEX idx_trending_expires (trending_until)
);

-- Helper function: Get trending professions for display
CREATE OR REPLACE FUNCTION get_trending_professions(limit_count INT DEFAULT 5)
RETURNS TABLE (
    profession_id VARCHAR,
    profession_name VARCHAR,
    ai_score DECIMAL,
    request_count INT
) AS $$
    SELECT
        profession_id,
        profession_name,
        ai_score,
        request_count
    FROM trending_professions
    WHERE trending_until IS NULL OR trending_until > CURRENT_TIMESTAMP
    ORDER BY ai_score DESC
    LIMIT limit_count;
$$ LANGUAGE SQL STABLE;

-- Helper function: Calculate profession trending score (AI mock)
CREATE OR REPLACE FUNCTION calculate_trending_score(
    p_request_count INT,
    p_unique_requesters INT,
    p_days_old INT
)
RETURNS DECIMAL AS $$
BEGIN
    -- Score = (requests * 0.4 + unique_requesters * 0.5 + recency * 0.1) / days_old
    -- Newer requests = higher score
    RETURN ROUND(
        ((p_request_count * 0.4 + p_unique_requesters * 0.5) / GREATEST(p_days_old, 1)) * 100,
        2
    )::DECIMAL;
END;
$$ LANGUAGE PLPGSQL;

-- Trigger: Auto-update trending_until (30-day expiration)
CREATE OR REPLACE FUNCTION update_trending_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.trending IS TRUE THEN
        NEW.trending_until := CURRENT_TIMESTAMP + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

CREATE TRIGGER trigger_trending_expiration
BEFORE INSERT OR UPDATE ON trending_professions
FOR EACH ROW
EXECUTE FUNCTION update_trending_expiration();
