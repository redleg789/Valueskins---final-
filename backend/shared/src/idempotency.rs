//! Idempotency Key Middleware
//!
//! Ensures mutation endpoints (POST /deal-rooms, POST /applications, POST /offers)
//! are safe to retry. Client sends `Idempotency-Key` header; if key was seen before,
//! return the cached response instead of re-executing.
//!
//! At Meta scale: network retries from mobile clients are constant. Without this,
//! every retry creates a duplicate deal room, application, or offer.

use sqlx::PgPool;

pub struct IdempotencyService {
    pool: PgPool,
}

impl IdempotencyService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Check if this idempotency key has been used before.
    /// Returns Some(cached_response) if key exists, None if new.
    pub async fn check(
        &self,
        key: &str,
        endpoint: &str,
    ) -> Result<Option<serde_json::Value>, sqlx::Error> {
        let cached: Option<(serde_json::Value, i16)> = sqlx::query_as(
            "SELECT response_body, response_status
             FROM idempotency_keys
             WHERE key = $1 AND endpoint = $2
               AND created_at > NOW() - INTERVAL '24 hours'"
        )
        .bind(key)
        .bind(endpoint)
        .fetch_optional(&self.pool)
        .await?;

        Ok(cached.map(|(body, _status)| body))
    }

    /// Store the response for this idempotency key.
    pub async fn store(
        &self,
        key: &str,
        endpoint: &str,
        user_id: i64,
        response_status: i16,
        response_body: &serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO idempotency_keys (key, endpoint, user_id, response_status, response_body)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (key, endpoint) DO NOTHING"
        )
        .bind(key)
        .bind(endpoint)
        .bind(user_id)
        .bind(response_status)
        .bind(response_body)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
