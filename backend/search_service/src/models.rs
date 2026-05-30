use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ──────────────────────────────────────────────────────────────────────────
// Domain models
// ──────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SearchDomain {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub role_count: i32,
    pub user_count: i32,
}

// ──────────────────────────────────────────────────────────────────────────
// Role models
// ──────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SearchRole {
    pub id: Uuid,
    pub domain_id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub user_count: i32,
}

#[derive(Debug, Serialize)]
pub struct RoleWithDomain {
    pub id: Uuid,
    pub domain_slug: String,
    pub domain_name: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
}

// ──────────────────────────────────────────────────────────────────────────
// Tag models
// ──────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TagCategory {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub max_per_user: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TagDictionaryEntry {
    pub id: Uuid,
    pub category_id: Option<Uuid>,
    pub category_slug: Option<String>,
    pub slug: String,
    pub canonical_name: String,
    pub is_suggested: bool,
    pub usage_count: i32,
    pub quality_score: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserTag {
    pub id: Uuid,
    pub persona_id: i64,
    pub tag_id: Uuid,
    pub tag_slug: String,
    pub tag_name: String,
    pub category_slug: Option<String>,
    pub source: String,
}

// ──────────────────────────────────────────────────────────────────────────
// Request/Response models
// ──────────────────────────────────────────────────────────────────────────

/// Profile setup request — domain + role + tags
#[derive(Debug, Deserialize)]
pub struct ProfileSetupRequest {
    pub persona_id: i64,
    pub domain_slug: String,
    pub role_slug: String,
    pub selected_tags: Vec<String>,     // slugs from tag_dictionary
    pub custom_tags: Vec<String>,       // user-generated custom tags
    pub is_primary: bool,
    pub level: Option<i32>,
}

/// Add tag request
#[derive(Debug, Deserialize)]
pub struct AddTagRequest {
    pub persona_id: i64,
    pub tag_slug: Option<String>,       // existing dictionary tag
    pub custom_tag: Option<String>,     // new custom tag
    pub category_slug: Option<String>,  // for custom tags
}

/// Search query parameters
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,              // free text query
    pub domain: Option<String>,         // domain slug filter
    pub role: Option<String>,           // role slug filter
    pub tags: Option<Vec<String>>,      // tag slug filters
    pub location: Option<String>,       // location preference
    pub opportunity_type: Option<String>, // e.g., "brand-deals", "events"
    pub min_trust: Option<f64>,         // minimum trust score filter
    pub sort: Option<String>,           // "relevance", "trust", "activity", "recent"
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Search result item
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub persona_id: i64,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub domains: Vec<DomainBrief>,
    pub roles: Vec<RoleBrief>,
    pub tags: Vec<TagBrief>,
    pub search_score: f64,
    pub trust_score: f64,
    pub reputation_score: f64,
    pub activity_score: f64,
    pub marketplace_score: f64,
    pub location_preference: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DomainBrief {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct RoleBrief {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct TagBrief {
    pub slug: String,
    pub name: String,
    pub category: Option<String>,
}

/// Autocomplete request
#[derive(Debug, Deserialize)]
pub struct AutocompleteQuery {
    pub q: String,
    pub r#type: Option<String>,         // "domain", "role", "tag", or all
    pub domain_filter: Option<String>,  // filter roles by domain
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AutocompleteResult {
    pub domains: Vec<DomainBrief>,
    pub roles: Vec<RoleBrief>,
    pub tags: Vec<TagBrief>,
}

/// Tag report request
#[derive(Debug, Deserialize)]
pub struct ReportTagRequest {
    pub reporter_persona_id: i64,
    pub tag_slug: String,
    pub reason: String,
}

/// AI tag suggestion request
#[derive(Debug, Deserialize)]
pub struct AISuggestionRequest {
    pub persona_id: i64,
    pub domain_slug: Option<String>,
    pub role_slug: Option<String>,
    pub existing_tags: Vec<String>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AISuggestion {
    pub tag_slug: String,
    pub tag_name: String,
    pub category: Option<String>,
    pub confidence: f64,
    pub reason: String,
}

// ──────────────────────────────────────────────────────────────────────────
// Analytics models
// ──────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TagAnalytics {
    pub tag_id: Uuid,
    pub tag_slug: String,
    pub period_start: chrono::NaiveDate,
    pub usage_count: i32,
    pub search_appearances: i32,
    pub selection_rate: f64,
    pub report_count: i32,
    pub quality_score: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SearchLog {
    pub id: i64,
    pub query_text: String,
    pub result_count: i32,
    pub latency_ms: i32,
    pub created_at: DateTime<Utc>,
}
