//! Refresh Token Service — secure token rotation with family-based reuse detection.
//!
//! Security model:
//!   - Tokens are SHA-256 hashed before storage (server never stores plaintext)
//!   - Each token belongs to a "family" (UUID). On rotation, old token is revoked
//!     and new token inherits the family.
//!   - If a revoked token is reused, the ENTIRE family is revoked (compromise detected).
//!   - Tokens expire after `refresh_ttl` (default 30 days).

use sha2::{Sha256, Digest};
use sqlx::PgPool;
use uuid::Uuid;

pub struct RefreshTokenService {
    pool: PgPool,
    refresh_ttl_days: i64,
}

/// Opaque token pair returned to the client.
pub struct TokenPair {
    pub refresh_token: String,  // Raw token — returned ONCE, never stored
    pub family_id: Uuid,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl RefreshTokenService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool, refresh_ttl_days: 30 }
    }

    pub fn with_ttl(pool: PgPool, days: i64) -> Self {
        Self { pool, refresh_ttl_days: days }
    }

    /// Issue a brand-new refresh token for the user (e.g., on login).
    pub async fn create(
        &self,
        user_id: i64,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<TokenPair, sqlx::Error> {
        let raw_token = Uuid::new_v4().to_string();
        let token_hash = Self::hash_token(&raw_token);
        let family_id = Uuid::new_v4();
        let expires_at = chrono::Utc::now() + chrono::Duration::days(self.refresh_ttl_days);

        sqlx::query(
            "INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(user_id)
        .bind(&token_hash)
        .bind(family_id)
        .bind(expires_at)
        .bind(user_agent)
        .bind(ip_address)
        .execute(&self.pool)
        .await?;

        Ok(TokenPair { refresh_token: raw_token, family_id, expires_at })
    }

    /// Rotate: validate old token, revoke it, issue new token in same family.
    /// If the old token was already revoked, revoke the ENTIRE family (reuse detected).
    pub async fn rotate(
        &self,
        raw_token: &str,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<TokenPair, RefreshError> {
        let token_hash = Self::hash_token(raw_token);

        // Lookup the token
        let row: Option<(i64, i64, Uuid, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)> =
            sqlx::query_as(
                "SELECT id, user_id, family_id, expires_at, revoked_at
                 FROM refresh_tokens WHERE token_hash = $1"
            )
            .bind(&token_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(RefreshError::Db)?;

        let (id, user_id, family_id, expires_at, revoked_at) = row.ok_or(RefreshError::Invalid)?;

        // If already revoked → reuse attack. Revoke entire family.
        if revoked_at.is_some() {
            tracing::warn!(
                family_id = %family_id,
                user_id = user_id,
                "Refresh token reuse detected — revoking entire family"
            );
            self.revoke_family(family_id).await.map_err(RefreshError::Db)?;
            return Err(RefreshError::ReuseDetected);
        }

        // Check expiry
        if expires_at < chrono::Utc::now() {
            return Err(RefreshError::Expired);
        }

        // Revoke this token
        sqlx::query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(RefreshError::Db)?;

        // Issue new token in same family
        let new_raw = Uuid::new_v4().to_string();
        let new_hash = Self::hash_token(&new_raw);
        let new_expires = chrono::Utc::now() + chrono::Duration::days(self.refresh_ttl_days);

        sqlx::query(
            "INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(user_id)
        .bind(&new_hash)
        .bind(family_id)
        .bind(new_expires)
        .bind(user_agent)
        .bind(ip_address)
        .execute(&self.pool)
        .await
        .map_err(RefreshError::Db)?;

        Ok(TokenPair { refresh_token: new_raw, family_id, expires_at: new_expires })
    }

    /// Revoke a single token by its raw value.
    pub async fn revoke(&self, raw_token: &str) -> Result<(), sqlx::Error> {
        let token_hash = Self::hash_token(raw_token);
        sqlx::query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL")
            .bind(&token_hash)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Revoke ALL tokens for a user (e.g., on password change or logout-all).
    pub async fn revoke_all_for_user(&self, user_id: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Revoke an entire token family (reuse detection response).
    async fn revoke_family(&self, family_id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL"
        )
        .bind(family_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    fn hash_token(raw: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(raw.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Public accessor for token hashing (used by auth handler for lookups).
    pub fn hash_token_public(raw: &str) -> String {
        Self::hash_token(raw)
    }
}

#[derive(Debug)]
pub enum RefreshError {
    Invalid,
    Expired,
    ReuseDetected,
    Db(sqlx::Error),
}

impl std::fmt::Display for RefreshError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid => write!(f, "Invalid refresh token"),
            Self::Expired => write!(f, "Refresh token expired"),
            Self::ReuseDetected => write!(f, "Token reuse detected — all sessions revoked"),
            Self::Db(e) => write!(f, "Database error: {}", e),
        }
    }
}
