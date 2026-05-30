//! Event Service Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ─── Database Row Structs ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Event {
    pub id: i64,
    pub host_user_id: i64,
    pub event_type: String,
    pub category: String,
    pub title: String,
    pub description: Option<String>,
    pub location: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub ticket_price_cents: i32,
    pub community_id: Option<i64>,
    pub attendee_count: i32,
    pub visibility_status: String,
    pub storage_tier: String,
    pub public_expires_at: DateTime<Utc>,
    pub archived_at: Option<DateTime<Utc>>,
    pub is_publicly_listed: bool,
    pub attendee_list_public: bool,
    pub search_visible: bool,
    pub discovery_visible: bool,
    pub recommendation_visible: bool,
    pub profile_visible: bool,
    pub feed_visible: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventAttendee {
    pub event_id: i64,
    pub user_id: i64,
    pub status: String,
    pub registered_at: DateTime<Utc>,
}

// ─── Response Structs (API) ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttendeePreview {
    pub user_id: i64,
    pub display_name: String,
    pub avatar_color: String,
    pub role_title: Option<String>, // Musician, Founder, Investor, etc.
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EventResponse {
    pub id: i64,
    pub host_id: i64,
    pub host_name: String,
    pub host_role: String,
    pub title: String,
    pub description: Option<String>,
    pub location: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub ticket_price_cents: i32,
    pub attendee_count: i32,
    pub status: Option<String>, // 'going', 'interested', 'saved' or null if not registered
    pub friends_attending: Vec<AttendeePreview>,
    pub mutual_interests: Vec<String>,
    pub community_name: Option<String>,
    pub lifecycle_state: String,
    pub public_status_message: String,
    pub attendee_list_public: bool,
    pub is_publicly_listed: bool,
    pub event_type: String,
    pub category: String,
    pub featured_people: Vec<EventFeaturedPersonResponse>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EventFeaturedPersonResponse {
    pub id: i64,
    pub tagged_user_id: i64,
    pub tagged_persona_id: i64,
    pub name: String,
    pub handle: String,
    pub avatar_url: Option<String>,
    pub tag_type: String,
    pub badge_label: String,
    pub display_role: String,
    pub descriptor: Option<String>,
    pub approval_state: String,
    pub is_public: bool,
    pub auto_approve: bool,
    pub hidden_by_tagged_user: bool,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventFeaturedPersonRow {
    pub id: i64,
    pub event_id: i64,
    pub tagged_user_id: i64,
    pub tagged_persona_id: i64,
    pub tagged_by_user_id: Option<i64>,
    pub tag_type: String,
    pub badge_label: String,
    pub display_role: String,
    pub descriptor: Option<String>,
    pub approval_state: String,
    pub is_public: bool,
    pub auto_approve: bool,
    pub hidden_by_tagged_user: bool,
    pub approved_by_user_id: Option<i64>,
    pub approved_at: Option<DateTime<Utc>>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub hidden_at: Option<DateTime<Utc>>,
    pub removed_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub sort_order: i32,
    pub tag_metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValueSkinSearchResult {
    pub persona_id: i64,
    pub user_id: i64,
    pub name: String,
    pub handle: String,
    pub avatar_url: Option<String>,
    pub verified: bool,
    pub followers_count: i64,
    pub descriptor: String,
    pub professions: Vec<String>,
    pub primary_profession: Option<String>,
    pub can_be_tagged: bool,
    pub cursor: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct CommunityPreview {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub member_count: i32,
    pub avatar_color: String,
    pub avatar_abbr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExplorerHomeResponse {
    pub upcoming_events: Vec<EventResponse>,
    pub recommended_events: Vec<EventResponse>,
    pub featured_communities: Vec<CommunityPreview>,
    pub people_attending: Vec<AttendeePreview>,
    pub calendar: Vec<EventResponse>,
}

// ─── Request Structs (API) ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub location: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub ticket_price_cents: i32,
    pub community_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterEventRequest {
    pub status: String, // 'going', 'interested', 'saved'
}

#[derive(Debug, Deserialize)]
pub struct UpdateLocationRequest {
    pub preferred_city: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordEventInteractionRequest {
    pub interaction_type: String,
    pub source_type: Option<String>,
    pub session_id: Option<String>,
    pub referrer_event_id: Option<i64>,
    pub referrer_user_id: Option<i64>,
    pub time_spent_seconds: Option<i32>,
    pub source_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventTagRequest {
    pub tagged_persona_id: i64,
    pub tag_type: String,
    pub badge_label: Option<String>,
    pub display_role: Option<String>,
    pub descriptor: Option<String>,
    pub auto_approve: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventTagDecisionRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventTagResponse {
    pub id: i64,
    pub event_id: i64,
    pub tagged_user_id: i64,
    pub tagged_persona_id: i64,
    pub tagged_by_user_id: Option<i64>,
    pub tag_type: String,
    pub badge_label: String,
    pub display_role: String,
    pub descriptor: Option<String>,
    pub approval_state: String,
    pub is_public: bool,
    pub auto_approve: bool,
    pub hidden_by_tagged_user: bool,
    pub approved_at: Option<DateTime<Utc>>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub name: String,
    pub handle: String,
    pub avatar_url: Option<String>,
}
