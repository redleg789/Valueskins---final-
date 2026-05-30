use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct GuardianRelationship {
    pub id: i64,
    pub minor_user_id: i64,
    pub guardian_user_id: i64,
    pub relationship_state: String,
    pub relationship_type: String,
    pub invite_token: Option<String>,
    pub invite_expires_at: Option<DateTime<Utc>>,
    pub invite_accepted_at: Option<DateTime<Utc>>,
    pub consent_document_id: Option<i64>,
    pub consent_signed_at: Option<DateTime<Utc>>,
    pub guardian_identity_document_id: Option<i64>,
    pub court_order_document_id: Option<i64>,
    pub consent_revoked_at: Option<DateTime<Utc>>,
    pub revocation_reason: Option<String>,
    pub dispute_reason: Option<String>,
    pub transferred_to_guardian_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct GuardianPermission {
    pub id: i64,
    pub guardian_relationship_id: i64,
    pub permission: String,
    pub is_granted: bool,
    pub granted_at: DateTime<Utc>,
    pub granted_by: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct AgeTransferRequest {
    pub id: i64,
    pub user_id: i64,
    pub guardian_relationship_id: i64,
    pub transfer_state: String,
    pub user_confirmed_at: Option<DateTime<Utc>>,
    pub guardian_confirmed_at: Option<DateTime<Utc>>,
    pub new_age_verification_state: Option<String>,
    pub assets_transferred: bool,
    pub contracts_transferred: bool,
    pub permissions_transferred: bool,
    pub guardian_permissions_revoked_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct InviteGuardianRequest {
    pub guardian_email: String,
    pub relationship_type: String,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInviteRequest {
    pub invite_token: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePermissionsRequest {
    pub permissions: Vec<PermissionUpdate>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PermissionUpdate {
    pub permission: String,
    pub is_granted: bool,
}

#[derive(Debug, Deserialize)]
pub struct InitiateTransferRequest {
    pub confirm: bool,
}

#[derive(Debug, Deserialize)]
pub struct RevokeConsentRequest {
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct GuardianRelationshipResponse {
    pub id: i64,
    pub minor_user_id: i64,
    pub guardian_user_id: i64,
    pub relationship_state: String,
    pub relationship_type: String,
    pub permissions: Vec<GuardianPermissionResponse>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct GuardianPermissionResponse {
    pub permission: String,
    pub is_granted: bool,
    pub granted_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct GuardianDashboardResponse {
    pub linked_minors: Vec<GuardianRelationshipResponse>,
    pub pending_approvals: i32,
    pub pending_payouts: i32,
}

#[derive(Debug, thiserror::Error)]
pub enum GuardianError {
    #[error("Relationship not found")]
    RelationshipNotFound,
    #[error("Guardian not found")]
    GuardianNotFound,
    #[error("Minor not found")]
    MinorNotFound,
    #[error("Invite expired")]
    InviteExpired,
    #[error("Invite token invalid")]
    InvalidInviteToken,
    #[error("Relationship already active")]
    AlreadyActive,
    #[error("Guardian already linked to this minor")]
    AlreadyLinked,
    #[error("Cannot be own guardian")]
    SelfGuardian,
    #[error("Guardian must be 21 or older")]
    GuardianTooYoung,
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Invalid state transition: {0}")]
    InvalidStateTransition(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Transfer not available")]
    TransferNotAvailable,
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sqlx::Error> for GuardianError {
    fn from(err: sqlx::Error) -> Self {
        GuardianError::Database(err.to_string())
    }
}
