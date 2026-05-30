use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct Company {
    pub id: i64,
    pub legal_name: String,
    pub doing_business_as: Option<String>,
    pub website: Option<String>,
    pub domain_name: Option<String>,
    pub company_state: String,
    pub tax_id_sha256: Option<String>,
    pub tax_id_country: Option<String>,
    pub tax_id_type: Option<String>,
    pub registration_number: Option<String>,
    pub registration_country: Option<String>,
    pub registration_jurisdiction: Option<String>,
    pub duns_number: Option<String>,
    pub lei_number: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    pub verification_expires_at: Option<DateTime<Utc>>,
    pub verified_by_user_id: Option<i64>,
    pub trust_score: i32,
    pub risk_level: String,
    pub is_publicly_traded: bool,
    pub stock_ticker: Option<String>,
    pub stock_exchange: Option<String>,
    pub parent_company_id: Option<i64>,
    pub subsidiary_of_id: Option<i64>,
    pub known_aliases: Vec<String>,
    pub blocked_domains: Vec<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct EmployeeVerification {
    pub id: i64,
    pub user_id: i64,
    pub company_id: i64,
    pub state: String,
    pub work_email: Option<String>,
    pub work_email_sha256: Option<String>,
    pub work_email_verified_at: Option<DateTime<Utc>>,
    pub linkedin_profile_url: Option<String>,
    pub linkedin_verified_at: Option<DateTime<Utc>>,
    pub linkedin_employment_data: Option<serde_json::Value>,
    pub employment_document_id: Option<i64>,
    pub employment_document_verified_at: Option<DateTime<Utc>>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub employment_type: Option<String>,
    pub is_primary_employment: bool,
    pub verification_expires_at: Option<DateTime<Utc>>,
    pub verified_by_user_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct CompanyDomainClaim {
    pub id: i64,
    pub company_id: i64,
    pub domain_name: String,
    pub verification_method: String,
    pub verification_token: String,
    pub verification_token_sha256: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub verified_by_ip: Option<String>,
    pub verification_attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct EnterpriseClaim {
    pub id: i64,
    pub claiming_user_id: i64,
    pub claimed_company_name: String,
    pub claimed_domain: Option<String>,
    pub actual_company_id: Option<i64>,
    pub claim_state: String,
    pub verification_method: Option<String>,
    pub verification_data: Option<serde_json::Value>,
    pub rejection_reason: Option<String>,
    pub flagged_as_impersonation: bool,
    pub impersonation_evidence: Option<serde_json::Value>,
    pub moderation_queue_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by_user_id: Option<i64>,
}

// Request types
#[derive(Debug, Deserialize)]
pub struct CreateCompanyRequest {
    pub legal_name: String,
    pub doing_business_as: Option<String>,
    pub website: Option<String>,
    pub domain_name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InitiateDomainVerificationRequest {
    pub company_id: i64,
    pub domain: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyDomainRequest {
    pub company_id: i64,
    pub domain: String,
    pub verification_token: String,
}

#[derive(Debug, Deserialize)]
pub struct InitiateEmployeeVerificationRequest {
    pub company_id: i64,
    pub work_email: String,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub employment_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmployeeEmailRequest {
    pub verification_id: i64,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct CompanyVerificationStatusResponse {
    pub company_id: i64,
    pub company_name: String,
    pub company_state: String,
    pub domain_verified: bool,
    pub registration_verified: bool,
    pub employee_count: i32,
    pub verification_tier: String,
}

#[derive(Debug, thiserror::Error)]
pub enum VerificationError {
    #[error("Company not found")]
    CompanyNotFound,
    #[error("Company already exists with this domain")]
    CompanyAlreadyExists,
    #[error("Domain verification failed: {0}")]
    DomainVerificationFailed(String),
    #[error("DNS verification failed: {0}")]
    DnsVerificationFailed(String),
    #[error("Invalid verification token")]
    InvalidToken,
    #[error("Employee verification not found")]
    EmployeeVerificationNotFound,
    #[error("Email sending failed: {0}")]
    EmailFailed(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sqlx::Error> for VerificationError {
    fn from(err: sqlx::Error) -> Self {
        VerificationError::Database(err.to_string())
    }
}
