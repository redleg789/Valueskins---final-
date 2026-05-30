//! Payout Reconciliation Ledger Service
//!
//! Immutable, append-only accounting for all money movements.
//! Every payout is recorded before processor is called, and updated
//! after processor confirms — idempotency key prevents double-payouts.
//!
//! Flow:
//!   1. create_payout_record()  → insert as 'pending' with idempotency_key
//!   2. initiate_processor()    → call Stripe/Razorpay, get txn_id
//!   3. mark_succeeded/failed() → update processor_status
//!
//! Retry-safe: replaying step 1 with the same idempotency_key is a no-op.

use sqlx::PgPool;
use chrono::Utc;

#[derive(Debug)]
pub enum PayoutError {
    DuplicateIdempotencyKey,
    NotFound,
    AlreadyProcessed,
    ProcessorDisabled,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for PayoutError {
    fn from(e: sqlx::Error) -> Self {
        PayoutError::Database(e)
    }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PayoutRecord {
    pub id: i64,
    pub idempotency_key: String,
    pub creator_user_id: i64,
    pub brand_user_id: i64,
    pub deal_id: Option<i64>,
    pub gross_amount_cents: i64,
    pub platform_fee_cents: i64,
    pub net_amount_cents: i64,
    pub currency: String,
    pub processor: String,
    pub processor_txn_id: Option<String>,
    pub processor_status: String,
    pub failure_reason: Option<String>,
    pub initiated_at: chrono::DateTime<Utc>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreatePayoutRequest {
    /// Caller must generate this deterministically (e.g., SHA256(deal_id + stage_id))
    pub idempotency_key: String,
    pub creator_user_id: i64,
    pub brand_user_id: i64,
    pub deal_id: Option<i64>,
    pub escrow_stage_id: Option<i64>,
    /// Total amount in cents
    pub gross_amount_cents: i64,
    /// Platform fee in cents (computed by caller from deal terms)
    pub platform_fee_cents: i64,
    pub currency: String,
    pub processor: String,
    pub metadata: Option<serde_json::Value>,
}

pub struct PayoutService {
    pool: PgPool,
}

impl PayoutService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Register a payout intent. Idempotent — duplicate keys return existing record.
    pub async fn create_payout_record(
        &self,
        req: CreatePayoutRequest,
    ) -> Result<PayoutRecord, PayoutError> {
        let net = req.gross_amount_cents - req.platform_fee_cents;
        if net < 0 {
            return Err(PayoutError::Database(sqlx::Error::Protocol(
                "platform_fee_cents exceeds gross_amount_cents".to_string()
            )));
        }

        // Validate processor is enabled
        let processor_enabled: Option<bool> = sqlx::query_scalar(
            "SELECT is_enabled FROM payment_processor_settings WHERE processor = $1"
        )
        .bind(&req.processor)
        .fetch_optional(&self.pool)
        .await?;

        if processor_enabled != Some(true) {
            return Err(PayoutError::ProcessorDisabled);
        }

        // INSERT with ON CONFLICT DO NOTHING to handle duplicate idempotency keys
        let result = sqlx::query(
            r#"
            INSERT INTO payout_ledger
                (idempotency_key, creator_user_id, brand_user_id, deal_id,
                 escrow_stage_id, gross_amount_cents, platform_fee_cents, net_amount_cents,
                 currency, processor, processor_status, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)
            ON CONFLICT (idempotency_key) DO NOTHING
            "#
        )
        .bind(&req.idempotency_key)
        .bind(req.creator_user_id)
        .bind(req.brand_user_id)
        .bind(req.deal_id)
        .bind(req.escrow_stage_id)
        .bind(req.gross_amount_cents)
        .bind(req.platform_fee_cents)
        .bind(net)
        .bind(&req.currency)
        .bind(&req.processor)
        .bind(&req.metadata)
        .execute(&self.pool)
        .await?;

        // Whether inserted or already existed, fetch the record
        let record: PayoutRecord = sqlx::query_as(
            r#"
            SELECT id, idempotency_key, creator_user_id, brand_user_id,
                   deal_id, gross_amount_cents, platform_fee_cents, net_amount_cents,
                   currency, processor, processor_txn_id, processor_status,
                   failure_reason, initiated_at, completed_at
            FROM payout_ledger WHERE idempotency_key = $1
            "#
        )
        .bind(&req.idempotency_key)
        .fetch_one(&self.pool)
        .await?;

        if result.rows_affected() == 0 && record.processor_status != "pending" {
            // Idempotency key existed and is already processed — return it
            return Ok(record);
        }

        Ok(record)
    }

    /// Mark payout as succeeded after processor confirms.
    pub async fn mark_succeeded(
        &self,
        payout_id: i64,
        processor_txn_id: &str,
    ) -> Result<(), PayoutError> {
        let rows = sqlx::query(
            r#"
            UPDATE payout_ledger SET
                processor_status = 'succeeded',
                processor_txn_id = $2,
                completed_at = NOW()
            WHERE id = $1 AND processor_status IN ('pending', 'processing')
            "#
        )
        .bind(payout_id)
        .bind(processor_txn_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows == 0 {
            Err(PayoutError::AlreadyProcessed)
        } else {
            Ok(())
        }
    }

    /// Mark payout as failed.
    pub async fn mark_failed(
        &self,
        payout_id: i64,
        reason: &str,
    ) -> Result<(), PayoutError> {
        sqlx::query(
            r#"
            UPDATE payout_ledger SET
                processor_status = 'failed',
                failure_reason = $2
            WHERE id = $1 AND processor_status IN ('pending', 'processing')
            "#
        )
        .bind(payout_id)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get payout history for a creator (paginated).
    pub async fn list_creator_payouts(
        &self,
        creator_user_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<PayoutRecord>, PayoutError> {
        let records: Vec<PayoutRecord> = sqlx::query_as(
            r#"
            SELECT id, idempotency_key, creator_user_id, brand_user_id,
                   deal_id, gross_amount_cents, platform_fee_cents, net_amount_cents,
                   currency, processor, processor_txn_id, processor_status,
                   failure_reason, initiated_at, completed_at
            FROM payout_ledger
            WHERE creator_user_id = $1
            ORDER BY initiated_at DESC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(creator_user_id)
        .bind(limit.min(100))
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    /// Get reconciliation summary for admin (total paid out, pending, fees).
    pub async fn get_reconciliation_summary(
        &self,
    ) -> Result<serde_json::Value, PayoutError> {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE processor_status = 'succeeded') AS total_succeeded,
                COUNT(*) FILTER (WHERE processor_status = 'pending') AS total_pending,
                COUNT(*) FILTER (WHERE processor_status = 'failed') AS total_failed,
                COALESCE(SUM(gross_amount_cents) FILTER (WHERE processor_status = 'succeeded'), 0) AS total_gross_cents,
                COALESCE(SUM(platform_fee_cents) FILTER (WHERE processor_status = 'succeeded'), 0) AS total_fees_cents,
                COALESCE(SUM(net_amount_cents) FILTER (WHERE processor_status = 'succeeded'), 0) AS total_net_cents
            FROM payout_ledger
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        use sqlx::Row;
        Ok(serde_json::json!({
            "total_succeeded": row.try_get::<i64, _>("total_succeeded").unwrap_or(0),
            "total_pending": row.try_get::<i64, _>("total_pending").unwrap_or(0),
            "total_failed": row.try_get::<i64, _>("total_failed").unwrap_or(0),
            "total_gross_usd": row.try_get::<i64, _>("total_gross_cents").unwrap_or(0) as f64 / 100.0,
            "total_fees_usd": row.try_get::<i64, _>("total_fees_cents").unwrap_or(0) as f64 / 100.0,
            "total_net_usd": row.try_get::<i64, _>("total_net_cents").unwrap_or(0) as f64 / 100.0,
        }))
    }
}
