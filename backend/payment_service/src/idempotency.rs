//! Idempotency keys prevent double-charges
//! Browser might retry requests if connection fails - we deduplicate server-side

use sqlx::PgPool;
use chrono::{DateTime, Utc, Duration};
use serde_json::Value;

pub struct IdempotencyService {
    pool: PgPool,
}

impl IdempotencyService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Check if request was already processed
    /// Returns Some(response) if cached, None if new request
    pub async fn get_cached_response(
        &self,
        idempotency_key: &str,
    ) -> Result<Option<Value>, sqlx::Error> {
        let result: Option<(String,)> = sqlx::query_as(
            "SELECT response FROM idempotency_keys WHERE key = $1 AND created_at > NOW() - INTERVAL '24 hours'"
        )
        .bind(idempotency_key)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((response_json,)) = result {
            return Ok(Some(serde_json::from_str(&response_json).unwrap_or(Value::Null)));
        }

        Ok(None)
    }

    /// Record successful request
    pub async fn record_request(
        &self,
        idempotency_key: &str,
        request_body: &str,
        response: Value,
    ) -> Result<(), sqlx::Error> {
        let response_json = response.to_string();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO idempotency_keys (key, request_body, response, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (key) DO UPDATE SET
                response = EXCLUDED.response,
                expires_at = EXCLUDED.expires_at
            "#
        )
        .bind(idempotency_key)
        .bind(request_body)
        .bind(&response_json)
        .bind(now)
        .bind(now + Duration::days(1))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Cleanup old keys (24 hours)
    pub async fn cleanup_expired(&self) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "DELETE FROM idempotency_keys WHERE expires_at < NOW()"
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }
}
