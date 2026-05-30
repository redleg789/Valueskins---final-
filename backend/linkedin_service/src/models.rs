use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── DB Row Types ──────────────────────────────────────────────────────

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct LinkedInProfile {
    pub id: i64,
    pub user_id: i64,
    pub platform: String,
    pub external_id: String,
    pub external_handle: Option<String>,
    pub profile_url: String,
    pub profile_hash: String,
    pub headline: Option<String>,
    pub bio: Option<String>,
    pub profile_image_url: Option<String>,
    pub company: Option<String>,
    pub job_title: Option<String>,
    pub location: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct LinkedInConnection {
    pub user_id: i64,
    pub connected_user_id: i64,
    pub connection_type: String,
    pub connected_at: Option<DateTime<Utc>>,
    pub shared_valueskins: Option<Vec<String>>,
    pub mutual_communities: Option<Vec<i64>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct LinkedInRecommendation {
    pub id: i64,
    pub recommender_user_id: i64,
    pub recipient_user_id: i64,
    pub profession: String,
    pub rating: f64,
    pub testimonial: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct LinkedInInvitation {
    pub id: i64,
    pub sender_user_id: i64,
    pub recipient_user_id: i64,
    pub community_id: i64,
    pub reason: Option<String>,
    pub status: String,
    pub responded_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// ── Request Types ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
pub struct LinkLinkedInRequest {
    pub profile_url: String,
    pub headline: Option<String>,
    pub company: Option<String>,
    pub job_title: Option<String>,
    pub location: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateVisibilityRequest {
    pub is_public: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SendConnectionRequest {
    pub connected_user_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RespondConnectionRequest {
    pub user_id: i64,
    pub accept: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct InviteToCommunityRequest {
    pub recipient_user_id: i64,
    pub community_id: i64,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RespondInvitationRequest {
    pub accept: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct GiveRecommendationRequest {
    pub recipient_user_id: i64,
    pub profession: String,
    pub rating: f64,
    pub testimonial: Option<String>,
}

// ── Response Types ────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
pub struct LinkedInProfileResponse {
    pub id: i64,
    pub external_id: String,
    pub headline: Option<String>,
    pub company: Option<String>,
    pub job_title: Option<String>,
    pub location: Option<String>,
    pub verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub is_public: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct ConnectionResponse {
    pub connected_user_id: i64,
    pub connection_type: String,
    pub connected_at: Option<DateTime<Utc>>,
    pub shared_valueskins: Vec<String>,
    pub mutual_communities: Vec<i64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct RecommendationResponse {
    pub id: i64,
    pub profession: String,
    pub rating: f64,
    pub testimonial: Option<String>,
    pub verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub recommender_user_id: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct InvitationResponse {
    pub id: i64,
    pub sender_user_id: i64,
    pub community_id: i64,
    pub reason: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// ── Error Type ────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub enum ServiceError {
    NotFound,
    Forbidden,
    Conflict(String),
    Validation(String),
    Database(String),
}

impl From<sqlx::Error> for ServiceError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ServiceError::NotFound,
            _ => ServiceError::Database(err.to_string()),
        }
    }
}
