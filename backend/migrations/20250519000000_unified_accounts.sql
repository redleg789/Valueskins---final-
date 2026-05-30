-- Unified Account System
-- ======================
-- One account for everything. Optional modules. No duplicate identities.
-- Users sign up once, enable modules as needed.

-- 1. Core Accounts table (universal identity, NOT tied to Instagram)
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    legacy_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Core identity (at least one required)
    email           TEXT UNIQUE,
    phone           TEXT UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Auth methods
    password_hash   TEXT,
    google_sub      TEXT UNIQUE,
    apple_user      TEXT UNIQUE,

    -- Profile basics (lightweight, NOT a ValueSkin)
    display_name    TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT,
    preferred_locale TEXT NOT NULL DEFAULT 'en',

    -- State
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    locked_until    TIMESTAMPTZ,
    lock_reason     TEXT,
    deactivated_at  TIMESTAMPTZ,

    -- Onboarding
    onboarding_stage TEXT NOT NULL DEFAULT 'preferences'
        CHECK (onboarding_stage IN ('preferences', 'complete')),
    preferences     JSONB NOT NULL DEFAULT '[]',

    -- Security
    totp_secret     TEXT,
    totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    recovery_codes  TEXT[],
    email_verification_token TEXT,

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    login_count     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_google ON accounts(google_sub);
CREATE INDEX IF NOT EXISTS idx_accounts_apple ON accounts(apple_user);
CREATE INDEX IF NOT EXISTS idx_accounts_legacy ON accounts(legacy_user_id);

-- 2. User Modules (optional capabilities attached to account)
CREATE TABLE IF NOT EXISTS user_modules (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    module_code     TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at  TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',

    UNIQUE(account_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_user_modules_account ON user_modules(account_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_code ON user_modules(module_code);

-- 3. Sessions (server-managed, Redis-backed)
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL UNIQUE,
    device_info     JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(account_id, is_active) WHERE is_active = TRUE;

-- 4. Permissions (granular access control)
CREATE TABLE IF NOT EXISTS permissions (
    id              BIGSERIAL PRIMARY KEY,
    module_code     TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    description     TEXT,
    UNIQUE(module_code, permission_code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role            TEXT NOT NULL,
    permission_id   BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

-- 5. Audit Log (immutable auth event trail)
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT,
    event_type      TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_account ON auth_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_time ON auth_audit_log(created_at DESC);

-- 6. Seed Permissions
INSERT INTO permissions (module_code, permission_code, description) VALUES
    -- Explorer module
    ('explorer', 'event.browse', 'Browse and discover events'),
    ('explorer', 'event.attend', 'Attend events (register/purchase tickets)'),
    ('explorer', 'event.view_details', 'View event details, attendees, featured people'),
    ('explorer', 'community.join', 'Join communities'),
    ('explorer', 'network.connect', 'Connect with other users'),
    ('explorer', 'ticket.purchase', 'Purchase event tickets'),
    -- Host module
    ('host', 'event.create', 'Create events'),
    ('host', 'event.edit', 'Edit own events'),
    ('host', 'event.publish', 'Publish/unpublish events'),
    ('host', 'event.delete', 'Delete own events'),
    ('host', 'attendee.manage', 'Manage event attendees'),
    ('host', 'attendee.message', 'Message event attendees'),
    ('host', 'analytics.event_basic', 'View event analytics'),
    ('host', 'ticket.configure', 'Configure ticket types and pricing'),
    -- ValueSkin module
    ('valueskin', 'valueskin.create', 'Create a ValueSkin profile'),
    ('valueskin', 'valueskin.edit', 'Edit own ValueSkin'),
    ('valueskin', 'marketplace.browse', 'Browse marketplace opportunities'),
    ('valueskin', 'marketplace.list', 'List in marketplace'),
    ('valueskin', 'deals.apply', 'Apply to brand deals'),
    ('valueskin', 'deals.manage', 'Manage active deals'),
    ('valueskin', 'brand.connect', 'Connect with brands'),
    -- Brand module
    ('brand', 'brand.profile', 'Create and manage brand profile'),
    ('brand', 'creator.discover', 'Discover and search creators'),
    ('brand', 'campaign.create', 'Create brand campaigns'),
    ('brand', 'campaign.manage', 'Manage active campaigns'),
    ('brand', 'deals.negotiate', 'Negotiate deals with creators'),
    ('brand', 'analytics.campaign', 'View campaign analytics'),
    -- Community module
    ('community', 'community.create', 'Create communities'),
    ('community', 'community.manage', 'Manage own communities'),
    ('community', 'community.moderate', 'Moderate community content'),
    ('community', 'moderation.flag', 'Flag content for review')
ON CONFLICT (module_code, permission_code) DO NOTHING;

-- Seed admin role permissions (full access — all current permissions)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- 7. Alter existing users table for compatibility
ALTER TABLE users ALTER COLUMN instagram_user_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('creator', 'brand', 'explorer', 'attendee', 'host'));

-- Note on existing tables (events, event_attendees, etc.):
-- These already reference users(id). After migration, they will reference
-- accounts(id) via legacy_user_id linkage. New FK column added in future migration.
