use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============================================================
// DB Row Types
// ============================================================

/// A moderation queue item — every report, system flag, appeal,
/// risk engine alert, or legal request creates one entry.
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct ModerationQueueItem {
    pub id: i64,
    pub target_user_id: Option<i64>,
    pub target_company_id: Option<i64>,
    pub target_contract_id: Option<i64>,
    pub source: String,
    pub priority: String,
    pub category: String,
    pub description: String,
    pub assigned_moderator_user_id: Option<i64>,
    pub moderator_action: Option<String>,
    pub moderator_notes: Option<String>,
    pub action_taken_at: Option<DateTime<Utc>>,
    pub requires_escalation: bool,
    pub escalated_to_user_id: Option<i64>,
    pub escalated_at: Option<DateTime<Utc>>,
    pub escalation_reason: Option<String>,
    pub is_appealable: bool,
    pub appeal_deadline: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Immutable audit log of every moderator action.
/// Required for detecting insider abuse, bribery, and mistakes.
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct ModeratorAuditEntry {
    pub id: i64,
    pub moderator_user_id: i64,
    pub action_type: String,
    pub target_type: String,
    pub target_id: i64,
    pub previous_state: Option<String>,
    pub new_state: Option<String>,
    pub action_description: String,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// A single appeal filed against a moderation action.
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct Appeal {
    pub id: i64,
    pub queue_item_id: i64,
    pub appellant_user_id: i64,
    pub reason: String,
    pub supporting_evidence: Option<serde_json::Value>,
    pub status: String,
    pub reviewed_by_user_id: Option<i64>,
    pub reviewer_notes: Option<String>,
    pub resolution: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Restriction placed on a user (feature-level, less severe than suspension).
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct UserRestriction {
    pub id: i64,
    pub user_id: i64,
    pub restriction_type: String,
    pub reason: String,
    pub queue_item_id: Option<i64>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_by_user_id: i64,
    pub created_at: DateTime<Utc>,
}

// ============================================================
// Request Types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct CreateReportRequest {
    pub target_user_id: i64,
    pub category: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct AssignModeratorRequest {
    pub moderator_user_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct TakeActionRequest {
    pub action: String,
    pub notes: String,
    pub silence_duration_hours: Option<i64>,
    pub restriction_type: Option<String>,
    pub restriction_expires_hours: Option<i64>,
    pub is_appealable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EscalateRequest {
    pub escalated_to_user_id: i64,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct AddNoteRequest {
    pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct FileAppealRequest {
    pub reason: String,
    pub supporting_evidence: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewAppealRequest {
    pub resolution: String,
    pub reviewer_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QueueQueryParams {
    pub status: Option<String>,
    pub source: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub assigned_to: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQueryParams {
    pub moderator_user_id: Option<i64>,
    pub action_type: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ============================================================
// Response Types
// ============================================================

#[derive(Debug, Serialize)]
pub struct QueueStatsResponse {
    pub open: i64,
    pub in_progress: i64,
    pub resolved: i64,
    pub escalated: i64,
    pub total: i64,
    pub by_category: serde_json::Value,
    pub by_priority: serde_json::Value,
    pub oldest_item_minutes: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ModerationActionTakenResponse {
    pub queue_item_id: i64,
    pub action: String,
    pub user_suspended: bool,
    pub user_banned: bool,
    pub sessions_revoked: bool,
    pub appeal_available: bool,
    pub appeal_deadline: Option<DateTime<Utc>>,
}

// ============================================================
// Error Types
// ============================================================

#[derive(Debug, thiserror::Error)]
pub enum ModerationError {
    #[error("Queue item not found")]
    QueueItemNotFound,
    #[error("User not found")]
    UserNotFound,
    #[error("Appeal not found")]
    AppealNotFound,
    #[error("Invalid action: {0}")]
    InvalidAction(String),
    #[error("Invalid state transition: {0}")]
    InvalidStateTransition(String),
    #[error("Appeal already resolved")]
    AppealAlreadyResolved,
    #[error("Cannot escalate further — already at highest level")]
    AlreadyAtHighestLevel,
    #[error("Cannot act on already-resolved item")]
    AlreadyResolved,
    #[error("Target user is moderator")]
    TargetIsModerator,
    #[error("Cannot report self")]
    CannotReportSelf,
    #[error("Duplicate report — item already open for this user")]
    DuplicateReport,
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sqlx::Error> for ModerationError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ModerationError::QueueItemNotFound,
            _ => ModerationError::Database(err.to_string()),
        }
    }
}
