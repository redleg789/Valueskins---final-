-- Credential Verification & Cross-Platform Identity Schema
-- Enables creators to link and verify external credentials

-- Creator Credentials (GitHub, LinkedIn, Portfolio, LeetCode)
CREATE TABLE IF NOT EXISTS creator_credentials (
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL CHECK (platform IN ('github', 'linkedin', 'portfolio', 'leetcode')),
    external_handle     TEXT NOT NULL,
    verified_at         TIMESTAMPTZ,
    verification_proof  TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_credentials_user ON creator_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_platform ON creator_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_credentials_verified ON creator_credentials(verified_at DESC) WHERE verified_at IS NOT NULL;

-- Identity Proofs (Twitter/X, GitHub, LinkedIn, TikTok cryptographic linking)
CREATE TABLE IF NOT EXISTS identity_proofs (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL CHECK (platform IN ('twitter', 'github', 'linkedin', 'tiktok')),
    external_handle TEXT NOT NULL,
    proof_url       TEXT,
    proof_hash      TEXT,
    verified_at     TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_identity_user ON identity_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_platform ON identity_proofs(platform);
CREATE INDEX IF NOT EXISTS idx_identity_verified ON identity_proofs(verified_at DESC) WHERE verified_at IS NOT NULL;
