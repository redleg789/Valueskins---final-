//! Session Management
//!
//! Manages refresh token lifecycle with family-based rotation.
//! Each refresh token belongs to a "family". When a token is rotated,
//! the old token is invalidated and a new one is issued within the same family.
//! If a rotated token is reused, the entire family is invalidated (token theft detection).

use chrono::{Utc, DateTime, Duration};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: uuid::Uuid,
    pub account_id: i64,
    pub refresh_token_hash: String,
    pub expires_at: DateTime<Utc>,
}

pub struct SessionManager {
    pool: PgPool,
}

impl SessionManager {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create a new session (for first-time login)
    pub async fn create_session(
        &self,
        account_id: i64,
        device_info: &serde_json::Value,
        ip_address: Option<std::net::IpAddr>,
    ) -> Result<(uuid::Uuid, String), SessionError> {
        let refresh_token = generate_raw_token();
        let token_hash = hash_token(&refresh_token);
        let session_id = uuid::Uuid::new_v4();
        let expires_at = Utc::now() + Duration::days(30);

        sqlx::query(
            r#"INSERT INTO sessions (id, account_id, refresh_token, device_info, ip_address, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6)"#
        )
        .bind(session_id)
        .bind(account_id)
        .bind(&token_hash)
        .bind(device_info)
        .bind(ip_address.map(|ip| sqlx::types::ipnetwork::IpNetwork::from(ip)))
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok((session_id, refresh_token))
    }

    /// Rotate a refresh token (issue new, invalidate old)
    /// Returns (new_session_id, new_refresh_token) on success
    /// Returns SessionError::TokenTheft if a rotated token is reused
    pub async fn rotate_token(
        &self,
        old_refresh_token: &str,
    ) -> Result<(uuid::Uuid, String), SessionError> {
        let old_hash = hash_token(old_refresh_token);

        // Find the session
        let session = sqlx::query_as::<_, (uuid::Uuid, i64, DateTime<Utc>, bool)>(
            r#"SELECT id, account_id, expires_at, is_active FROM sessions
               WHERE refresh_token = $1"#
        )
        .bind(&old_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?
        .ok_or(SessionError::InvalidToken)?;

        let (session_id, account_id, expires_at, is_active) = session;

        if !is_active {
            // Token was already rotated → potential theft
            // Invalidate ALL sessions for this account
            self.revoke_all_sessions(account_id).await?;
            return Err(SessionError::TokenTheft);
        }

        if Utc::now() > expires_at {
            self.revoke_session(session_id).await?;
            return Err(SessionError::Expired);
        }

        // Issue new token
        let new_token = generate_raw_token();
        let new_hash = hash_token(&new_token);
        let new_session_id = uuid::Uuid::new_v4();
        let new_expires = Utc::now() + Duration::days(30);

        sqlx::query(
            r#"UPDATE sessions SET is_active = FALSE, revoked_at = NOW()
               WHERE id = $1"#
        )
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        sqlx::query(
            r#"INSERT INTO sessions (id, account_id, refresh_token, device_info, expires_at)
               VALUES ($1, $2, $3, (SELECT device_info FROM sessions WHERE id = $4), $5)"#
        )
        .bind(new_session_id)
        .bind(account_id)
        .bind(&new_hash)
        .bind(session_id)
        .bind(new_expires)
        .execute(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;

        Ok((new_session_id, new_token))
    }

    /// Revoke a single session
    pub async fn revoke_session(&self, session_id: uuid::Uuid) -> Result<(), SessionError> {
        sqlx::query(
            r#"UPDATE sessions SET is_active = FALSE, revoked_at = NOW()
               WHERE id = $1 AND is_active = TRUE"#
        )
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;
        Ok(())
    }

    /// Revoke all sessions for an account (logout everywhere)
    pub async fn revoke_all_sessions(&self, account_id: i64) -> Result<(), SessionError> {
        sqlx::query(
            r#"UPDATE sessions SET is_active = FALSE, revoked_at = NOW()
               WHERE account_id = $1 AND is_active = TRUE"#
        )
        .bind(account_id)
        .execute(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?;
        Ok(())
    }

    /// Get account ID from a refresh token
    pub async fn get_account_id(&self, refresh_token: &str) -> Result<i64, SessionError> {
        let hash = hash_token(refresh_token);
        let result = sqlx::query_as::<_, (i64, bool, DateTime<Utc>)>(
            r#"SELECT account_id, is_active, expires_at FROM sessions
               WHERE refresh_token = $1"#
        )
        .bind(&hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SessionError::Database(e.to_string()))?
        .ok_or(SessionError::InvalidToken)?;

        let (account_id, is_active, expires_at) = result;
        if !is_active {
            return Err(SessionError::InvalidToken);
        }
        if Utc::now() > expires_at {
            return Err(SessionError::Expired);
        }

        Ok(account_id)
    }
}

fn generate_raw_token() -> String {
    let bytes: [u8; 32] = rand::thread_rng().gen();
    hex::encode(bytes)
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug)]
pub enum SessionError {
    InvalidToken,
    Expired,
    TokenTheft,
    Database(String),
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::InvalidToken => write!(f, "Invalid refresh token"),
            SessionError::Expired => write!(f, "Session expired"),
            SessionError::TokenTheft => write!(f, "Token theft detected"),
            SessionError::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}
