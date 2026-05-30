use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct RiskEvent {
    pub id: i64,
    pub user_id: Option<i64>,
    pub company_id: Option<i64>,
    pub event_type: String,
    pub severity: String,
    pub risk_score_delta: i32,
    pub source_ip: Option<String>,
    pub user_agent: Option<String>,
    pub device_fingerprint: Option<String>,
    pub description: String,
    pub details: Option<serde_json::Value>,
    pub is_automated: bool,
    pub is_resolved: bool,
    pub resolution_notes: Option<String>,
    pub resolved_by_user_id: Option<i64>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RecordRiskEventRequest {
    pub user_id: Option<i64>,
    pub company_id: Option<i64>,
    pub event_type: String,
    pub severity: String,
    pub description: String,
    pub details: Option<serde_json::Value>,
    pub source_ip: Option<String>,
    pub user_agent: Option<String>,
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RiskAssessmentResponse {
    pub user_id: i64,
    pub risk_level: String,
    pub risk_score: i32,
    pub active_flags: Vec<RiskFlag>,
    pub recent_events: Vec<RiskEvent>,
}

#[derive(Debug, Serialize)]
pub struct RiskFlag {
    pub event_type: String,
    pub severity: String,
    pub description: String,
    pub detected_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum RiskError {
    #[error("User not found")]
    UserNotFound,
    #[error("Invalid event type: {0}")]
    InvalidEventType(String),
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sqlx::Error> for RiskError {
    fn from(err: sqlx::Error) -> Self {
        RiskError::Database(err.to_string())
    }
}
