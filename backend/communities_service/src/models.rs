//! Community Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ─── Database Row Structs ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Community {
    pub id: i64,
    pub owner_user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub avatar_color: String,
    pub avatar_abbr: String,
    pub visibility: String,
    pub gate_type: String,
    pub required_tier: String,
    pub member_count: i32,
    pub post_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommunityMember {
    pub community_id: i64,
    pub user_id: i64,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommunityPost {
    pub id: i64,
    pub community_id: i64,
    pub author_user_id: i64,
    pub content: String,
    pub is_pinned: bool,
    pub is_announcement: bool,
    pub like_count: i32,
    pub comment_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ValueskinPricing {
    pub id: i64,
    pub profession_id: Option<i64>,
    pub tier: String,
    pub price_credits: i32,
    pub price_usd_cents: i32,
    pub is_active: bool,
    pub updated_at: DateTime<Utc>,
}

// ─── Response Structs (API) ────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CommunityResponse {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub avatar_color: String,
    pub avatar_abbr: String,
    pub visibility: String,
    pub gate_type: String,
    pub gates: Vec<String>,
    pub required_tier: String,
    pub member_count: i32,
    pub post_count: i32,
    pub is_member: bool,
    pub can_join: bool,
    pub join_blocked_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MemberResponse {
    pub user_id: i64,
    pub display_name: String,
    pub ig_handle: String,
    pub valueskin_professions: Vec<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PostResponse {
    pub id: i64,
    pub community_id: i64,
    pub author_user_id: i64,
    pub author_display_name: String,
    pub author_handle: String,
    pub author_profession: Option<String>,
    pub content: String,
    pub is_pinned: bool,
    pub is_announcement: bool,
    pub like_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PricingResponse {
    pub tier: String,
    pub price_credits: i32,
    pub price_usd_cents: i32,
    pub description: String,
}

// ─── Request Structs (API) ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCommunityRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: String,
    pub gate_type: String,
    pub required_tier: String,
    pub allowed_professions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
    pub is_announcement: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SetPricingRequest {
    pub profession: Option<String>,
    pub tier: String,
    pub price_credits: i32,
    pub price_usd_cents: i32,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseTierRequest {
    pub profession: String,
    pub tier: String,
}

#[derive(Debug, Deserialize)]
pub struct LikePostRequest {
    pub post_id: i64,
}
