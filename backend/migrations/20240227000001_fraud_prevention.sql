-- Fraud Prevention Gates Migration
-- Adds proactive fraud prevention (rate limiting, sybil protection, velocity controls)
-- on top of existing reactive fraud detection in reputation_fraud_signals.

-- Rate limiting for account creation (sybil detection at signup)
CREATE TABLE IF NOT EXISTS account_creation_log (
    id BIGSERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acct_creation_ip ON account_creation_log(ip_address, created_at);

-- Persona limit enforcement columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_personas INTEGER NOT NULL DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(255); -- SHA256 of phone for dedup

-- Discovery scan rate limiting (per user per hour)
CREATE TABLE IF NOT EXISTS discovery_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    scan_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_disc_rate_user ON discovery_rate_limits(user_id);

-- Fraud prevention rules (admin-configurable thresholds)
CREATE TABLE IF NOT EXISTS fraud_rules (
    id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL, -- 'velocity', 'sybil', 'collusion', 'amount'
    threshold_value NUMERIC NOT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'block', -- 'block', 'flag', 'shadowban'
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default fraud prevention rules
INSERT INTO fraud_rules (rule_name, rule_type, threshold_value, action) VALUES
    ('max_accounts_per_ip_per_day', 'sybil', 3, 'block'),
    ('max_personas_per_user', 'sybil', 3, 'block'),
    ('max_deals_per_week', 'velocity', 10, 'flag'),
    ('max_discovery_scans_per_hour', 'velocity', 100, 'block'),
    ('max_applications_per_day', 'velocity', 20, 'block'),
    ('min_deal_amount_usd', 'amount', 10, 'block'),
    ('max_same_brand_deals', 'collusion', 5, 'flag')
ON CONFLICT (rule_name) DO NOTHING;
