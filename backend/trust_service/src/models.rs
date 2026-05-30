use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct TrustScoreEvent {
    pub id: i64,
    pub user_id: Option<i64>,
    pub company_id: Option<i64>,
    pub category: String,
    pub event_type: String,
    pub score_delta: i32,
    pub score_before: i32,
    pub score_after: i32,
    pub weight: f32,
    pub reason: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub source: String,
    pub confidence: f32,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct TrustScoreWeight {
    pub id: i64,
    pub category: String,
    pub subcategory: String,
    pub weight: f32,
    pub max_score: i32,
    pub decay_days: Option<i32>,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct TrustScoreResponse {
    pub user_id: i64,
    pub overall_score: i32,
    pub trust_tier: String,
    pub risk_level: String,
    pub dimensions: Vec<TrustDimensionScore>,
    pub recent_events: Vec<TrustScoreEvent>,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TrustDimensionScore {
    pub name: String,
    pub score: i32,
    pub max: i32,
    pub weight: f32,
    pub contribution: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct TrustTierInfo {
    pub tier: &'static str,
    pub score_range: (i32, i32),
    pub label: &'static str,
    pub color: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct RecordEventRequest {
    pub category: String,
    pub event_type: String,
    pub score_delta: i32,
    pub reason: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum TrustError {
    #[error("User profile not found")]
    ProfileNotFound,
    #[error("Score out of range: {0}")]
    ScoreOutOfRange(String),
    #[error("Invalid category: {0}")]
    InvalidCategory(String),
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sqlx::Error> for TrustError {
    fn from(err: sqlx::Error) -> Self {
        TrustError::Database(err.to_string())
    }
}

/// Trust tier definitions with score ranges
pub const TRUST_TIERS: &[TrustTierInfo] = &[
    TrustTierInfo { tier: "UNTRUSTED", score_range: (0, 0), label: "New User", color: "#9CA3AF" },
    TrustTierInfo { tier: "BASIC", score_range: (1, 200), label: "Basic", color: "#D97706" },
    TrustTierInfo { tier: "IDENTITY_VERIFIED", score_range: (201, 400), label: "ID Verified", color: "#9CA3AF" },
    TrustTierInfo { tier: "TRUSTED", score_range: (401, 600), label: "Trusted", color: "#F59E0B" },
    TrustTierInfo { tier: "HIGHLY_TRUSTED", score_range: (601, 800), label: "Highly Trusted", color: "#8B5CF6" },
    TrustTierInfo { tier: "VERIFIED_CREATOR", score_range: (801, 950), label: "Verified", color: "#3B82F6" },
    TrustTierInfo { tier: "ELITE", score_range: (951, 1000), label: "Elite", color: "#10B981" },
];
