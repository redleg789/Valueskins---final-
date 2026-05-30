-- C-Suite Advantage System: Platform-configurable title-based level multiplier
-- Allows Meta, TikTok, LinkedIn, YouTube to independently choose enforcement strategy

-- Platform configuration for C-Suite advantage
CREATE TABLE IF NOT EXISTS platform_csuite_settings (
  platform_id VARCHAR(50) PRIMARY KEY,  -- 'meta', 'youtube', 'linkedin', 'tiktok'
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enforcement_type VARCHAR(50) NOT NULL DEFAULT 'none'
    CHECK (enforcement_type IN ('level_boost', 'price_multiplier', 'both', 'none')),
  level_boost_amount INT NOT NULL DEFAULT 1
    CHECK (level_boost_amount BETWEEN 0 AND 4),
  price_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.5
    CHECK (price_multiplier >= 1.0 AND price_multiplier <= 3.0),
  title_whitelist TEXT[] NOT NULL DEFAULT ARRAY['CEO', 'CTO', 'VP', 'Founder', 'President'],
  verification_strategy VARCHAR(50) NOT NULL DEFAULT 'self_reported'
    CHECK (verification_strategy IN ('self_reported', 'linkedin_oauth', 'admin_verified', 'hybrid')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
);

-- Creator job titles (extracted from LinkedIn, resumes, OAuth, etc.)
CREATE TABLE IF NOT EXISTS persona_titles (
  id BIGSERIAL PRIMARY KEY,
  persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  verified_via VARCHAR(50) NOT NULL DEFAULT 'self_reported'
    CHECK (verified_via IN ('self_reported', 'linkedin_oauth', 'admin_verified', 'document_upload')),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, title, company)
);

CREATE INDEX idx_persona_titles_persona ON persona_titles(persona_id) WHERE is_active;
CREATE INDEX idx_persona_titles_verified ON persona_titles(persona_id, is_verified, title) WHERE is_active;

-- Audit log for title changes (for moderation + transparency)
CREATE TABLE IF NOT EXISTS persona_title_audit (
  id BIGSERIAL PRIMARY KEY,
  persona_id BIGINT NOT NULL,
  user_id BIGINT REFERENCES users(id),
  old_title VARCHAR(255),
  new_title VARCHAR(255),
  changed_by VARCHAR(50) NOT NULL
    CHECK (changed_by IN ('user_action', 'linkedin_sync', 'admin_override')),
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_title_audit_persona ON persona_title_audit(persona_id, changed_at DESC);

-- Seed platform defaults (platforms can override via API)
INSERT INTO platform_csuite_settings (platform_id, enabled, enforcement_type, level_boost_amount, verification_strategy)
VALUES
  ('meta', FALSE, 'none', 1, 'self_reported'),
  ('youtube', FALSE, 'none', 1, 'self_reported'),
  ('linkedin', FALSE, 'none', 1, 'self_reported'),
  ('tiktok', FALSE, 'none', 1, 'self_reported')
ON CONFLICT (platform_id) DO NOTHING;
