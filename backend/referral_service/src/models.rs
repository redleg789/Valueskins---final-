//! Referral Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferralCode {
    pub id: i64,
    pub persona_id: i64,
    pub code: String,
    pub code_hash: String,
    pub uses: i32,
    pub total_earnings: String,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferralChain {
    pub id: i64,
    pub new_persona_id: i64,
    pub tier1_persona_id: Option<i64>,
    pub tier2_persona_id: Option<i64>,
    pub tier3_persona_id: Option<i64>,
    pub referral_code_id: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferralReward {
    pub id: i64,
    pub recipient_persona_id: i64,
    pub recipient_address: String,
    pub source_persona_id: i64,
    pub tier: i32,
    pub amount_wei: String,
    pub transaction_type: String,
    pub is_claimed: bool,
    pub claimed_at: Option<DateTime<Utc>>,
    pub claim_tx_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferralStats {
    pub persona_id: i64,
    pub total_referrals: i32,
    pub tier1_count: i32,
    pub tier2_count: i32,
    pub tier3_count: i32,
    pub total_earnings_wei: String,
    pub last_referral_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub persona_id: i64,
    pub display_name: String,
    pub avatar_uri: Option<String>,
    pub referral_count: i32,
    pub total_earnings: String,
}

// Request/Response types

#[derive(Debug, Deserialize)]
pub struct CreateCodeRequest {
    pub persona_id: i64,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct CreateCodeResponse {
    pub code: String,
    pub referral_link: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordReferralRequest {
    pub new_persona_id: i64,
    pub referral_code: String,
    pub mint_amount_wei: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReferralStatsResponse {
    pub code: String,
    pub referral_link: String,
    pub total_referrals: i32,
    pub tier1_count: i32,
    pub tier2_count: i32,
    pub tier3_count: i32,
    pub pending_rewards: String,
    pub total_earnings: String,
}

#[derive(Debug, Serialize)]
pub struct PendingRewardsResponse {
    pub total_pending: String,
    pub rewards: Vec<PendingReward>,
}

#[derive(Debug, Serialize)]
pub struct PendingReward {
    pub id: i64,
    pub source_persona_name: String,
    pub tier: i32,
    pub amount: String,
    pub transaction_type: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateCodeRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateCodeResponse {
    pub valid: bool,
    pub persona_id: Option<i64>,
    pub persona_name: Option<String>,
}
