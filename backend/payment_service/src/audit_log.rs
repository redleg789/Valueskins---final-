//! Immutable audit log of all payments
//! Every transaction logged for compliance

use sqlx::PgPool;
use chrono::Utc;

#[derive(Debug, Clone)]
pub struct AuditLog {
    pub id: String,
    pub event_type: String, // "payment_created", "stage_released", "refund_issued"
    pub deal_id: String,
    pub amount_usd: i32,
    pub details: String,
    pub created_at: chrono::DateTime<Utc>,
}

pub struct AuditLogger {
    pool: PgPool,
}

impl AuditLogger {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Log a payment event (immutable)
    pub async fn log_event(
        &self,
        event_type: &str,
        deal_id: &str,
        amount_usd: i32,
        details: &str,
    ) -> Result<(), sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO payment_audit_log
            (id, event_type, deal_id, amount_usd, details, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(&id)
        .bind(event_type)
        .bind(deal_id)
        .bind(amount_usd)
        .bind(details)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get audit trail for a deal
    pub async fn get_deal_history(&self, deal_id: &str) -> Result<Vec<AuditLog>, sqlx::Error> {
        let logs: Vec<(String, String, String, i32, String, chrono::DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, event_type, deal_id, amount_usd, details, created_at FROM payment_audit_log WHERE deal_id = $1 ORDER BY created_at ASC"
        )
        .bind(deal_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(logs.into_iter().map(|(id, event_type, deal_id, amount_usd, details, created_at)| {
            AuditLog {
                id,
                event_type,
                deal_id,
                amount_usd,
                details,
                created_at,
            }
        }).collect())
    }
}
