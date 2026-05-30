use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── DB Row Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct PlatformCSuiteSettings {
    pub platform_id: String,
    pub enabled: bool,
    pub enforcement_type: String, // 'level_boost' | 'price_multiplier' | 'both' | 'none'
    pub level_boost_amount: i32,
    pub price_multiplier: f64,
    pub title_whitelist: Vec<String>,
    pub verification_strategy: String, // 'self_reported' | 'linkedin_oauth' | 'admin_verified' | 'hybrid'
    pub updated_at: DateTime<Utc>,
    pub updated_by_user_id: Option<i64>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct PersonaTitle {
    pub id: i64,
    pub persona_id: i64,
    pub title: String,
    pub company: Option<String>,
    pub verified_via: String, // 'self_reported' | 'linkedin_oauth' | 'admin_verified' | 'document_upload'
    pub verified_at: Option<DateTime<Utc>>,
    pub is_verified: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct PersonaTitleAudit {
    pub id: i64,
    pub persona_id: i64,
    pub user_id: Option<i64>,
    pub old_title: Option<String>,
    pub new_title: Option<String>,
    pub changed_by: String, // 'user_action' | 'linkedin_sync' | 'admin_override'
    pub reason: Option<String>,
    pub changed_at: DateTime<Utc>,
}

// ── Request Types ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateCSuiteSettingsRequest {
    pub enabled: Option<bool>,
    pub enforcement_type: Option<String>, // 'level_boost' | 'price_multiplier' | 'both' | 'none'
    pub level_boost_amount: Option<i32>,
    pub price_multiplier: Option<f64>,
    pub title_whitelist: Option<Vec<String>>,
    pub verification_strategy: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTitleRequest {
    pub title: String,
    pub company: Option<String>,
    pub verified_via: String, // 'self_reported' | 'linkedin_oauth' | 'admin_verified' | 'document_upload'
}

#[derive(Debug, Deserialize)]
pub struct VerifyTitleRequest {
    pub title_id: i64,
    pub verified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveTitleRequest {
    pub title_id: i64,
}

// ── Response Types ────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CSuiteSettingsResponse {
    pub platform_id: String,
    pub enabled: bool,
    pub enforcement_type: String,
    pub level_boost_amount: i32,
    pub price_multiplier: f64,
    pub title_whitelist: Vec<String>,
    pub verification_strategy: String,
    pub available_verification_strategies: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct PersonaTitleResponse {
    pub id: i64,
    pub title: String,
    pub company: Option<String>,
    pub verified_via: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub is_verified: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogEntry {
    pub id: i64,
    pub persona_id: i64,
    pub user_id: Option<i64>,
    pub old_title: Option<String>,
    pub new_title: Option<String>,
    pub changed_by: String,
    pub reason: Option<String>,
    pub changed_at: DateTime<Utc>,
}

// ── Error Types ────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum ServiceError {
    NotFound,
    Forbidden,
    BadRequest(String),
    Conflict(String),
    Database(String),
}

impl From<sqlx::Error> for ServiceError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ServiceError::NotFound,
            e => ServiceError::Database(e.to_string()),
        }
    }
}
