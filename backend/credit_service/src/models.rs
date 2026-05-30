use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Creator's credit line status.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CreditLine {
    pub id: i64,
    pub user_id: i64,
    pub credit_limit_cents: i64,
    pub used_cents: i64,
    pub available_cents: i64,
    pub credit_score: i16,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Individual advance draw against a credit line.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CreditAdvance {
    pub id: i64,
    pub credit_line_id: i64,
    pub deal_room_id: i64,
    pub amount_cents: i64,
    pub repayment_auto_deduct: bool,
    pub repayment_due_at: Option<DateTime<Utc>>,
    pub repaid_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Credit score breakdown for transparency.
#[derive(Debug, Serialize)]
pub struct CreditScoreBreakdown {
    pub total_score: i16,
    pub factors: CreditScoreFactors,
    pub credit_limit_cents: i64,
}

#[derive(Debug, Serialize)]
pub struct CreditScoreFactors {
    pub completed_deals_factor: i16,
    pub avg_deal_value_factor: i16,
    pub trust_score_factor: i16,
    pub tenure_factor: i16,
    pub on_time_rate_factor: i16,
}

/// Request to draw an advance.
#[derive(Debug, Deserialize)]
pub struct DrawAdvanceRequest {
    pub deal_room_id: i64,
    pub amount_cents: i64,
    pub auto_deduct: Option<bool>,
}

/// Request to apply for a credit line.
#[derive(Debug, Deserialize)]
pub struct ApplyCreditRequest {
    pub persona_id: i64,
}

/// Query for listing advances.
#[derive(Debug, Deserialize)]
pub struct AdvanceListQuery {
    pub status: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}
