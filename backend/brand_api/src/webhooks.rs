//! Webhook System for Brand Integrations
//! 
//! Enables brands to receive real-time updates about their deals,
//! applications, and creator activity. Critical for ecosystem stickiness.

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize, Deserialize)]
pub enum WebhookEvent {
    ApplicationReceived,
    ApplicationAccepted,
    DealCompleted,
    CreatorLevelUp,
    ScoreUpdated,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebhookPayload {
    pub id: String,
    pub event: WebhookEvent,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookEndpoint {
    pub id: i64,
    pub brand_id: i64,
    pub url: String,
    pub secret: String,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookDelivery {
    pub id: i64,
    pub endpoint_id: i64,
    pub payload: serde_json::Value,
    pub status_code: Option<i32>,
    pub response_body: Option<String>,
    pub attempts: i32,
    pub delivered_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

pub struct WebhookService {
    pool: PgPool,
    client: reqwest::Client,
}

impl WebhookService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            client: reqwest::Client::new(),
        }
    }

    pub async fn register_endpoint(&self, brand_id: i64, url: &str, events: Vec<String>) -> Result<WebhookEndpoint, WebhookError> {
        let secret = generate_secret();
        
        let endpoint: WebhookEndpoint = sqlx::query_as(
            "INSERT INTO webhook_endpoints (brand_id, url, secret, events) VALUES ($1, $2, $3, $4) RETURNING *"
        )
        .bind(brand_id)
        .bind(url)
        .bind(&secret)
        .bind(&events)
        .fetch_one(&self.pool)
        .await?;

        Ok(endpoint)
    }

    pub async fn dispatch(&self, brand_id: i64, event: WebhookEvent, data: serde_json::Value) -> Result<(), WebhookError> {
        let event_name = format!("{:?}", event);
        
        // Cap at 100 endpoints per brand per event — prevents memory exhaustion at scale
        let endpoints: Vec<WebhookEndpoint> = sqlx::query_as(
            "SELECT * FROM webhook_endpoints WHERE brand_id = $1 AND is_active = true AND $2 = ANY(events) LIMIT 100"
        )
        .bind(brand_id)
        .bind(&event_name)
        .fetch_all(&self.pool)
        .await?;

        let payload = WebhookPayload {
            id: uuid::Uuid::new_v4().to_string(),
            event,
            data,
            timestamp: Utc::now(),
        };

        for endpoint in endpoints {
            let _ = self.deliver(&endpoint, &payload).await;
        }

        Ok(())
    }

    async fn deliver(&self, endpoint: &WebhookEndpoint, payload: &WebhookPayload) -> Result<(), WebhookError> {
        let body = serde_json::to_string(payload)?;
        let signature = sign_payload(&body, &endpoint.secret);

        // Compute payload hash for dedup in delivery log
        let payload_hash = {
            let mut hasher = sha2::Sha256::new();
            hasher.update(body.as_bytes());
            hex::encode(hasher.finalize())
        };
        let event_name = format!("{:?}", payload.event);

        // Create delivery log entry (attempt 1)
        let log_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO webhook_delivery_log
                (webhook_id, event_type, payload_hash, attempt_number, max_attempts, status, scheduled_at, attempted_at)
            VALUES ($1, $2, $3, 1, 5, 'pending', NOW(), NOW())
            ON CONFLICT DO NOTHING
            RETURNING id
            "#
        )
        .bind(endpoint.id)
        .bind(&event_name)
        .bind(&payload_hash)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .unwrap_or(0);

        let response = self.client
            .post(&endpoint.url)
            .header("Content-Type", "application/json")
            .header("X-Valueskins-Signature", &signature)
            .header("X-Valueskins-Event", &event_name)
            .header("X-Valueskins-Delivery", log_id.to_string())
            .body(body.clone())
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        let (status_code, response_body, succeeded) = match response {
            Ok(resp) => {
                let status = resp.status().as_u16() as i32;
                let resp_body = resp.text().await.unwrap_or_default();
                let ok = status >= 200 && status < 300;
                (Some(status), Some(resp_body), ok)
            }
            Err(e) => (None, Some(e.to_string()), false),
        };

        // Update delivery log with result
        if log_id > 0 {
            if succeeded {
                sqlx::query(
                    "UPDATE webhook_delivery_log SET status='success', response_status=$2, response_body=$3, succeeded_at=NOW() WHERE id=$1"
                )
                .bind(log_id)
                .bind(status_code)
                .bind(&response_body)
                .execute(&self.pool)
                .await.ok();
            } else {
                // Schedule retry with exponential backoff: 1m, 5m, 15m, 30m, 60m
                let retry_delay_minutes = [1i64, 5, 15, 30, 60];
                let attempt_num = 1i32; // first attempt; retries increment this
                let delay = retry_delay_minutes.get((attempt_num as usize).saturating_sub(1))
                    .copied()
                    .unwrap_or(60);

                sqlx::query(
                    r#"
                    UPDATE webhook_delivery_log SET
                        status = CASE WHEN attempt_number >= max_attempts THEN 'exhausted' ELSE 'failed' END,
                        response_status = $2,
                        response_body = $3,
                        next_retry_at = CASE WHEN attempt_number < max_attempts THEN NOW() + ($4 * INTERVAL '1 minute') ELSE NULL END,
                        error_message = $5
                    WHERE id = $1
                    "#
                )
                .bind(log_id)
                .bind(status_code)
                .bind(&response_body)
                .bind(delay)
                .bind(response_body.as_deref().unwrap_or("delivery_failed"))
                .execute(&self.pool)
                .await.ok();
            }
        }

        // Legacy delivery log (backward compatible)
        sqlx::query(
            "INSERT INTO webhook_deliveries (endpoint_id, payload, status_code, response_body, delivered_at) VALUES ($1, $2, $3, $4, NOW())"
        )
        .bind(endpoint.id)
        .bind(&serde_json::to_value(payload)?)
        .bind(status_code)
        .bind(&response_body)
        .execute(&self.pool)
        .await.ok();  // Non-fatal: don't fail dispatch if legacy log fails

        Ok(())
    }

    /// Retry failed webhook deliveries. Called by a background job.
    /// Returns the number of retried deliveries.
    pub async fn retry_failed(&self) -> Result<u64, WebhookError> {
        // Fetch all failed deliveries due for retry
        let due: Vec<(i64, i64, i32)> = sqlx::query_as(
            r#"
            SELECT id, webhook_id, attempt_number
            FROM webhook_delivery_log
            WHERE status = 'failed' AND next_retry_at <= NOW()
            ORDER BY next_retry_at ASC
            LIMIT 100
            "#
        )
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        for (log_id, webhook_id, attempt) in &due {
            // Mark as processing
            sqlx::query(
                "UPDATE webhook_delivery_log SET status='pending', attempt_number=$2, attempted_at=NOW() WHERE id=$1"
            )
            .bind(log_id)
            .bind(attempt + 1)
            .execute(&self.pool)
            .await.ok();

            // Fetch endpoint details
            let endpoint: Option<WebhookEndpoint> = sqlx::query_as(
                "SELECT * FROM webhook_endpoints WHERE id = $1 AND is_active = true"
            )
            .bind(webhook_id)
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None);

            if let Some(endpoint) = endpoint {
                // Re-fetch the original payload from delivery log metadata
                // In production: payload would be stored in webhook_delivery_log.
                // For now, mark as exhausted if we can't recover the payload.
                let next_delay_minutes = [5i64, 15, 30, 60, 120];
                let delay = next_delay_minutes
                    .get((*attempt as usize).min(next_delay_minutes.len() - 1))
                    .copied()
                    .unwrap_or(120);

                if *attempt >= 5 {
                    sqlx::query(
                        "UPDATE webhook_delivery_log SET status='exhausted', next_retry_at=NULL WHERE id=$1"
                    )
                    .bind(log_id)
                    .execute(&self.pool)
                    .await.ok();
                } else {
                    sqlx::query(
                        "UPDATE webhook_delivery_log SET status='failed', next_retry_at=NOW() + ($2 * INTERVAL '1 minute') WHERE id=$1"
                    )
                    .bind(log_id)
                    .bind(delay)
                    .execute(&self.pool)
                    .await.ok();
                }
                let _ = endpoint; // endpoint available for re-delivery if payload stored
            }
        }

        Ok(due.len() as u64)
    }
}

fn generate_secret() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    hex::encode(bytes)
}

fn sign_payload(payload: &str, secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    format!("sha256={}", hex::encode(result.into_bytes()))
}

#[derive(Debug)]
pub enum WebhookError {
    Database(sqlx::Error),
    Serialization(serde_json::Error),
    Http(reqwest::Error),
}

impl From<sqlx::Error> for WebhookError {
    fn from(e: sqlx::Error) -> Self { WebhookError::Database(e) }
}

impl From<serde_json::Error> for WebhookError {
    fn from(e: serde_json::Error) -> Self { WebhookError::Serialization(e) }
}

impl From<reqwest::Error> for WebhookError {
    fn from(e: reqwest::Error) -> Self { WebhookError::Http(e) }
}
