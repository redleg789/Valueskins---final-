//! Brand API Data Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Brand API key for authentication
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiKey {
    pub id: i64,
    pub brand_id: i64,
    pub key_hash: String,
    pub name: String,
    pub permissions: Vec<String>,
    pub rate_limit: i32,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub is_active: bool,
}

/// Brand profile for API access
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Brand {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub website: Option<String>,
    pub logo_uri: Option<String>,
    pub category: String,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

/// Creator verification response (public API)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatorVerification {
    pub persona_id: i64,
    pub display_name: String,
    pub profession: String,
    pub level: i32,
    pub level_name: String,
    pub verified_at: DateTime<Utc>,
    pub score_components: ScoreBreakdown,
    pub badges: Vec<Badge>,
    pub verification_hash: String,
}

/// Score breakdown for transparency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreBreakdown {
    pub activity_score: i32,
    pub engagement_score: i32,
    pub consistency_score: i32,
    pub verification_score: i32,
    pub total_score: i32,
}

/// Verification badge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Badge {
    pub name: String,
    pub description: String,
    pub earned_at: DateTime<Utc>,
}

/// Creator search request
#[derive(Debug, Clone, Deserialize)]
pub struct CreatorSearchRequest {
    pub profession_id: Option<i64>,
    pub min_level: Option<i32>,
    pub max_level: Option<i32>,
    pub category: Option<String>,
    /// If true, only return creators who are willing to barter
    pub open_to_barter: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Creator search result
#[derive(Debug, Clone, Serialize)]
pub struct CreatorSearchResult {
    pub persona_id: i64,
    pub display_name: String,
    pub avatar_uri: Option<String>,
    pub profession: String,
    pub level: i32,
    pub level_name: String,
    pub engagement_rate: f64,
    pub willing_to_barter: bool,
    pub last_active: DateTime<Utc>,
}

/// Embeddable badge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddableBadge {
    pub persona_id: i64,
    pub profession_id: i64,
    pub level: i32,
    pub embed_code: String,
    pub svg_url: String,
    pub png_url: String,
    pub verification_url: String,
}

/// API usage stats
#[derive(Debug, Clone, Serialize)]
pub struct ApiUsageStats {
    pub total_requests: i64,
    pub requests_today: i64,
    pub requests_this_month: i64,
    pub top_endpoints: Vec<EndpointUsage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EndpointUsage {
    pub endpoint: String,
    pub count: i64,
}

/// Webhook configuration for brands
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Webhook {
    pub id: i64,
    pub brand_id: i64,
    pub url: String,
    pub events: Vec<String>,
    pub secret: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Level name mapping
pub fn level_to_name(level: i32) -> &'static str {
    match level {
        1 => "Entry",
        2 => "Established",
        3 => "Professional",
        4 => "Expert",
        5 => "Legendary",
        _ => "Unknown",
    }
}
