//! Payout processing to creators
//! Support for ACH, wire transfer, PayPal, Stripe Connect

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutMethod {
    pub id: String,
    pub creator_id: String,
    pub method_type: String,        // "ach", "wire", "paypal", "stripe_connect"
    pub name: String,               // Display name
    pub is_default: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payout {
    pub id: String,
    pub creator_id: String,
    pub amount_usd: i32,
    pub payout_method_id: String,
    pub status: String,             // "pending", "processing", "completed", "failed"
    pub scheduled_date: DateTime<Utc>,
    pub processed_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

pub struct PayoutService {
    pool: sqlx::PgPool,
    stripe_key: Option<String>,
}

impl PayoutService {
    pub fn new(pool: sqlx::PgPool, stripe_key: Option<String>) -> Self {
        Self { pool, stripe_key }
    }

    /// Schedule payout for creator
    /// Batched weekly on Fridays
    pub async fn schedule_payout(
        &self,
        creator_id: &str,
        amount_usd: i32,
        payout_method_id: &str,
    ) -> Result<Payout, PayoutError> {
        // Verify payout method exists and belongs to creator
        let method: (String,) = sqlx::query_as(
            "SELECT id FROM payout_methods WHERE id = $1 AND creator_id = $2"
        )
        .bind(payout_method_id)
        .bind(creator_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| PayoutError::DatabaseError(e.to_string()))?
        .ok_or(PayoutError::InvalidPayoutMethod)?;

        let payout_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // Schedule for next Friday
        let scheduled_date = Self::next_friday(now);

        sqlx::query(
            "INSERT INTO payouts (id, creator_id, amount_usd, payout_method_id, status, scheduled_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(&payout_id)
        .bind(creator_id)
        .bind(amount_usd)
        .bind(payout_method_id)
        .bind("pending")
        .bind(scheduled_date)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| PayoutError::DatabaseError(e.to_string()))?;

        Ok(Payout {
            id: payout_id,
            creator_id: creator_id.to_string(),
            amount_usd,
            payout_method_id: payout_method_id.to_string(),
            status: "pending".to_string(),
            scheduled_date,
            processed_date: None,
            created_at: now,
        })
    }

    /// Register payout method (ACH, PayPal, Stripe Connect, etc.)
    pub async fn register_payout_method(
        &self,
        creator_id: &str,
        method_type: &str,
        name: &str,
        is_default: bool,
    ) -> Result<PayoutMethod, PayoutError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // In production: verify credentials before storing
        // For MVP: just store with is_verified = false, require verification step

        sqlx::query(
            "INSERT INTO payout_methods (id, creator_id, method_type, name, is_default, is_verified, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(&id)
        .bind(creator_id)
        .bind(method_type)
        .bind(name)
        .bind(is_default)
        .bind(false) // Not verified until confirmed
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| PayoutError::DatabaseError(e.to_string()))?;

        Ok(PayoutMethod {
            id,
            creator_id: creator_id.to_string(),
            method_type: method_type.to_string(),
            name: name.to_string(),
            is_default,
            is_verified: false,
            created_at: now,
        })
    }

    /// Get pending payouts (for batch processing on Friday)
    pub async fn get_pending_payouts(&self) -> Result<Vec<Payout>, PayoutError> {
        let payouts: Vec<(String, String, i32, String, String, DateTime<Utc>, Option<DateTime<Utc>>, DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, creator_id, amount_usd, payout_method_id, status, scheduled_date, processed_date, created_at FROM payouts WHERE status = 'pending' AND scheduled_date <= NOW() ORDER BY created_at ASC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| PayoutError::DatabaseError(e.to_string()))?;

        Ok(payouts.into_iter().map(|(id, creator_id, amount_usd, payout_method_id, status, scheduled_date, processed_date, created_at)| {
            Payout {
                id,
                creator_id,
                amount_usd,
                payout_method_id,
                status,
                scheduled_date,
                processed_date,
                created_at,
            }
        }).collect())
    }

    /// Mark payout as completed
    pub async fn mark_completed(&self, payout_id: &str) -> Result<(), PayoutError> {
        sqlx::query(
            "UPDATE payouts SET status = 'completed', processed_date = NOW() WHERE id = $1"
        )
        .bind(payout_id)
        .execute(&self.pool)
        .await
        .map_err(|e| PayoutError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Calculate next Friday for payout batch
    fn next_friday(now: DateTime<Utc>) -> DateTime<Utc> {
        use chrono::Datelike;
        let weekday = now.weekday();
        let days_until_friday = match weekday {
            chrono::Weekday::Mon => 4,
            chrono::Weekday::Tue => 3,
            chrono::Weekday::Wed => 2,
            chrono::Weekday::Thu => 1,
            chrono::Weekday::Fri => 7, // Next Friday
            chrono::Weekday::Sat => 6,
            chrono::Weekday::Sun => 5,
        };

        now + chrono::Duration::days(days_until_friday)
    }
}

#[derive(Debug)]
pub enum PayoutError {
    InvalidPayoutMethod,
    InsufficientBalance,
    DatabaseError(String),
    ProcessingError(String),
}

impl std::fmt::Display for PayoutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PayoutError::InvalidPayoutMethod => write!(f, "Invalid payout method"),
            PayoutError::InsufficientBalance => write!(f, "Insufficient balance for payout"),
            PayoutError::DatabaseError(e) => write!(f, "Database error: {}", e),
            PayoutError::ProcessingError(e) => write!(f, "Processing error: {}", e),
        }
    }
}

impl std::error::Error for PayoutError {}
