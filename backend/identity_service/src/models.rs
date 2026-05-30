use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============================================================
// DB Row Types
// ============================================================

/// 1:1 extension of users table for all verification state
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct UserVerificationProfile {
    pub user_id: i64,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub date_of_birth_sha256: Option<String>,
    pub age_verification_state: String,
    pub declared_age_at_signup: Option<i16>,
    pub verified_age: Option<i16>,
    pub age_verified_at: Option<DateTime<Utc>>,
    pub age_verification_expires_at: Option<DateTime<Utc>>,
    pub identity_document_id: Option<i64>,
    pub selfie_verified: bool,
    pub liveness_check_passed: bool,
    pub liveness_checked_at: Option<DateTime<Utc>>,
    pub risk_level: String,
    pub trust_tier: String,
    pub trust_score: i32,
    pub trust_score_updated_at: Option<DateTime<Utc>>,
    pub is_public_figure: bool,
    pub phone_verified: bool,
    pub phone_country_code: Option<String>,
    pub phone_number_hash: Option<String>,
    pub email_verified: bool,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub account_created_ip: Option<String>,
    pub account_created_device_fingerprint: Option<String>,
    pub account_created_user_agent: Option<String>,
    pub last_risk_assessment_at: Option<DateTime<Utc>>,
    pub active_warning_count: i32,
    pub is_under_investigation: bool,
    pub investigation_case_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Identity document record
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct IdentityDocument {
    pub id: i64,
    pub user_id: Option<i64>,
    pub company_id: Option<i64>,
    pub document_type: String,
    pub document_status: String,
    pub file_storage_key: String,
    pub file_hash: String,
    pub file_size_bytes: Option<i32>,
    pub file_mime_type: Option<String>,
    pub extracted_data: Option<serde_json::Value>,
    pub verification_data: Option<serde_json::Value>,
    pub verification_provider: Option<String>,
    pub verification_score: Option<f32>,
    pub reviewed_by_user_id: Option<i64>,
    pub review_notes: Option<String>,
    pub rejection_reason: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub upload_ip: Option<String>,
    pub upload_user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ============================================================
// KYC Status
// ============================================================

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct KycStatus {
    pub id: i64,
    pub user_id: Option<i64>,
    pub company_id: Option<i64>,
    pub kyc_level: String,
    pub kyc_state: String,
    pub current_document_id: Option<i64>,
    pub documents_submitted: i32,
    pub documents_verified: i32,
    pub liveness_passed: bool,
    pub liveness_attempts: i32,
    pub pep_check_passed: Option<bool>,
    pub sanctions_check_passed: Option<bool>,
    pub adverse_media_check_passed: Option<bool>,
    pub checks_performed_at: Option<DateTime<Utc>>,
    pub kyc_provider: Option<String>,
    pub kyc_provider_reference: Option<String>,
    pub notes: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================
// Request Types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct SubmitDobRequest {
    pub date_of_birth: chrono::NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct UploadDocumentRequest {
    pub document_type: String,
    pub file_storage_key: String,
    pub file_hash: String,
    pub file_size_bytes: Option<i32>,
    pub file_mime_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitSelfieRequest {
    pub selfie_storage_key: String,
    pub selfie_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct InitiateKycRequest {
    pub kyc_level: String,
}

#[derive(Debug, Deserialize)]
pub struct AgeVerificationQuery {
    pub user_id: i64,
}

// ============================================================
// Response Types
// ============================================================

#[derive(Debug, Serialize)]
pub struct AgeVerificationStatusResponse {
    pub user_id: i64,
    pub age_verification_state: String,
    pub declared_age: Option<i16>,
    pub verified_age: Option<i16>,
    pub is_adult: bool,
    pub is_minor: bool,
    pub needs_guardian: bool,
    pub verification_expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct KycStatusResponse {
    pub user_id: i64,
    pub kyc_level: String,
    pub kyc_state: String,
    pub documents_submitted: i32,
    pub documents_verified: i32,
    pub liveness_passed: bool,
    pub pep_check_passed: Option<bool>,
    pub sanctions_check_passed: Option<bool>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct DocumentUploadResponse {
    pub document_id: i64,
    pub status: String,
    pub requires_review: bool,
}

// ============================================================
// Error Types
// ============================================================

#[derive(Debug, thiserror::Error)]
pub enum IdentityError {
    #[error("User not found")]
    UserNotFound,
    #[error("Invalid date of birth: {0}")]
    InvalidDob(String),
    #[error("Age already verified")]
    AgeAlreadyVerified,
    #[error("Age verification required")]
    AgeVerificationRequired,
    #[error("Document not found")]
    DocumentNotFound,
    #[error("Document already exists")]
    DocumentAlreadyExists,
    #[error("Document verification failed: {0}")]
    DocumentVerificationFailed(String),
    #[error("Liveness check failed")]
    LivenessCheckFailed,
    #[error("Forbidden")]
    Forbidden,
    #[error("Database error: {0}")]
    Database(String),
    #[error("KYC not found")]
    KycNotFound,
    #[error("Invalid state transition: {0}")]
    InvalidStateTransition(String),
    #[error("External verification service error: {0}")]
    ExternalServiceError(String),
}

impl From<sqlx::Error> for IdentityError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => IdentityError::UserNotFound,
            _ => IdentityError::Database(err.to_string()),
        }
    }
}
