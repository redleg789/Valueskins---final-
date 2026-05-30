//! Waitlist Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WaitlistEntry {
    pub id: i64,
    pub email: String,
    pub creator_type: Option<String>,
    pub follower_range: Option<String>,
    pub platforms: Option<Vec<String>>,
    pub referral_source: Option<String>,
    pub referral_code: Option<String>,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub position: i32,
    pub is_verified: bool,
    pub converted_to_user: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct JoinWaitlistRequest {
    pub email: String,
    pub creator_type: Option<String>,
    pub follower_range: Option<String>,
    pub platforms: Option<Vec<String>>,
    pub referral_code: Option<String>,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JoinWaitlistResponse {
    pub position: i32,
    pub referral_code: String,
    pub share_url: String,
    pub ahead_count: i32,
}

#[derive(Debug, Serialize)]
pub struct WaitlistStats {
    pub total_signups: i64,
    pub verified_signups: i64,
    pub referral_signups: i64,
    pub conversion_rate: f64,
    pub top_creator_types: Vec<(String, i64)>,
    pub top_platforms: Vec<(String, i64)>,
}

#[derive(Debug, Serialize)]
pub struct PositionResponse {
    pub position: i32,
    pub ahead_count: i32,
    pub referrals_made: i32,
    pub positions_jumped: i32,
}
