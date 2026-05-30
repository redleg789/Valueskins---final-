use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// DB Row Types
#[derive(Clone, Debug, FromRow, Serialize)]
pub struct CreatorCredential {
    pub user_id: i64,
    pub platform: String,
    pub external_handle: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub verification_proof: Option<String>,
    pub is_active: bool,
}

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct IdentityProof {
    pub user_id: i64,
    pub platform: String,
    pub external_handle: String,
    pub proof_url: Option<String>,
    pub proof_hash: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    pub is_active: bool,
}

// Request Types
#[derive(Clone, Debug, Deserialize)]
pub struct LinkCredentialRequest {
    pub platform: String,
    pub external_handle: String,
    pub verification_token: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LinkIdentityRequest {
    pub platform: String,
    pub external_handle: String,
    pub proof_url: String,
}

// Response Types
#[derive(Clone, Debug, Serialize)]
pub struct CredentialResponse {
    pub platform: String,
    pub external_handle: String,
    pub verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub display_name: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct IdentityProofResponse {
    pub platform: String,
    pub external_handle: String,
    pub verified: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub display_name: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct CombinedVerificationResponse {
    pub credentials: Vec<CredentialResponse>,
    pub identity_proofs: Vec<IdentityProofResponse>,
    pub total_verified: usize,
}

// Error Type
#[derive(Clone, Debug)]
pub enum ServiceError {
    NotFound,
    Forbidden,
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
