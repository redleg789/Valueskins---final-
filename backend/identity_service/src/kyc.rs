//! KYC (Know Your Customer) Service
//!
//! Manages KYC levels and flows for both individuals and companies.
//! Integrates with external KYC providers for document verification,
//! PEP/sanctions/adverse media screening.

use crate::models::{IdentityError, KycStatus, KycStatusResponse};
use sqlx::PgPool;

pub struct KycService {
    pool: PgPool,
}

impl KycService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Initialize KYC for a user (called after basic account setup)
    pub async fn init_kyc(&self, user_id: i64) -> Result<KycStatusResponse, IdentityError> {
        // Upsert KYC status record
        sqlx::query(
            "INSERT INTO kyc_status (user_id, kyc_level, kyc_state)
             VALUES ($1, 'NONE', 'NOT_STARTED')
             ON CONFLICT (user_id) DO NOTHING",
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        self.get_kyc_status(user_id).await
    }

    /// Transition KYC to next level after successful checks
    pub async fn advance_kyc_level(
        &self,
        user_id: i64,
        new_level: &str,
        document_id: i64,
    ) -> Result<KycStatusResponse, IdentityError> {
        let kyc = sqlx::query_as::<_, KycStatus>(
            "SELECT * FROM kyc_status WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::KycNotFound)?;

        // Validate level progression
        let levels = ["NONE", "EMAIL_ONLY", "PHONE_VERIFIED", "BASIC_KYC", 
                       "FULL_KYC", "ENHANCED_KYC", "INSTITUTIONAL_KYC", "GOVERNMENT_KYC"];
        let current_idx = levels.iter().position(|l| *l == kyc.kyc_level).unwrap_or(0);
        let new_idx = levels.iter().position(|l| *l == new_level).unwrap_or(0);

        if new_idx <= current_idx {
            return Err(IdentityError::InvalidStateTransition(format!(
                "KYC level already at {} or higher",
                kyc.kyc_level
            )));
        }

        sqlx::query(
            "UPDATE kyc_status 
             SET kyc_level = $2, kyc_state = 'COMPLETED', current_document_id = $3,
                 documents_submitted = documents_submitted + 1,
                 documents_verified = documents_verified + 1,
                 updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(new_level)
        .bind(document_id)
        .execute(&self.pool)
        .await?;

        // Publish event
        let payload = serde_json::json!({
            "user_id": user_id,
            "new_level": new_level,
            "document_id": document_id
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            user_id,
            "kyc.level.changed",
            &payload,
        )
        .await;

        self.get_kyc_status(user_id).await
    }

    /// Record a failed KYC attempt
    pub async fn record_kyc_failure(
        &self,
        user_id: i64,
        reason: &str,
    ) -> Result<KycStatusResponse, IdentityError> {
        sqlx::query(
            "UPDATE kyc_status 
             SET documents_submitted = documents_submitted + 1,
                 kyc_state = 'REJECTED',
                 notes = $2,
                 updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        self.get_kyc_status(user_id).await
    }

    /// Get KYC status
    pub async fn get_kyc_status(&self, user_id: i64) -> Result<KycStatusResponse, IdentityError> {
        let kyc = sqlx::query_as::<_, KycStatus>(
            "SELECT * FROM kyc_status WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::KycNotFound)?;

        Ok(KycStatusResponse {
            user_id,
            kyc_level: kyc.kyc_level,
            kyc_state: kyc.kyc_state,
            documents_submitted: kyc.documents_submitted,
            documents_verified: kyc.documents_verified,
            liveness_passed: kyc.liveness_passed,
            pep_check_passed: kyc.pep_check_passed,
            sanctions_check_passed: kyc.sanctions_check_passed,
            expires_at: kyc.expires_at,
        })
    }

    /// Check if a user has a minimum KYC level
    pub async fn meets_minimum_level(
        &self,
        user_id: i64,
        required_level: &str,
    ) -> Result<bool, IdentityError> {
        let kyc = sqlx::query_as::<_, KycStatus>(
            "SELECT * FROM kyc_status WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::KycNotFound)?;

        let levels = ["NONE", "EMAIL_ONLY", "PHONE_VERIFIED", "BASIC_KYC", 
                       "FULL_KYC", "ENHANCED_KYC", "INSTITUTIONAL_KYC", "GOVERNMENT_KYC"];
        let current_idx = levels.iter().position(|l| *l == kyc.kyc_level).unwrap_or(0);
        let required_idx = levels.iter().position(|l| *l == required_level).unwrap_or(0);

        Ok(current_idx >= required_idx)
    }
}
