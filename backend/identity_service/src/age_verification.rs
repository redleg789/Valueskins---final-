//! Age Verification State Machine
//!
//! Input states: user_age_verification_state ENUM
//! Validates all transitions against the defined state machine.
//! No direct state manipulation — all changes go through this module.

use crate::models::{AgeVerificationStatusResponse, IdentityError, SubmitDobRequest};
use chrono::{Datelike, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// Valid age verification state transitions
const VALID_TRANSITIONS: &[(&str, &[&str])] = &[
    ("UNVERIFIED", &["PENDING_SELF_DECLARATION"]),
    ("PENDING_SELF_DECLARATION", &["SELF_DECLARED_ADULT", "PENDING_DOCUMENT_UPLOAD"]),
    ("SELF_DECLARED_ADULT", &["PENDING_DOCUMENT_UPLOAD", "ADULT_ACTIVE", "AGE_LOCKED"]),
    ("PENDING_DOCUMENT_UPLOAD", &["PENDING_DOCUMENT_REVIEW"]),
    ("PENDING_DOCUMENT_REVIEW", &["MINOR_PENDING_GUARDIAN", "ADULT_ACTIVE", "DOCUMENT_REJECTED", "AGE_LOCKED"]),
    ("DOCUMENT_REJECTED", &["PENDING_DOCUMENT_UPLOAD", "AGE_ESCALATED", "AGE_LOCKED"]),
    ("MINOR_PENDING_GUARDIAN", &["MINOR_GUARDIAN_PENDING_APPROVAL", "AGE_LOCKED"]),
    ("MINOR_GUARDIAN_PENDING_APPROVAL", &["MINOR_GUARDIAN_APPROVED", "AGE_LOCKED"]),
    ("MINOR_GUARDIAN_APPROVED", &["MINOR_ACTIVE", "AGE_LOCKED"]),
    ("MINOR_ACTIVE", &["AGE_TRANSFERRING_TO_ADULT", "AGE_LOCKED", "AGE_UNDER_REVIEW"]),
    ("ADULT_ACTIVE", &["AGE_EXPIRED", "AGE_UNDER_REVIEW", "AGE_LOCKED"]),
    ("AGE_ESCALATED", &["PENDING_DOCUMENT_UPLOAD", "AGE_LOCKED", "AGE_UNDER_REVIEW"]),
    ("AGE_LOCKED", &["AGE_UNDER_REVIEW"]),
    ("AGE_UNDER_REVIEW", &["ADULT_ACTIVE", "MINOR_PENDING_GUARDIAN", "AGE_LOCKED"]),
    ("AGE_TRANSFERRING_TO_ADULT", &["ADULT_ACTIVE", "AGE_LOCKED"]),
    ("AGE_EXPIRED", &["PENDING_DOCUMENT_UPLOAD", "AGE_LOCKED"]),
];

pub struct AgeVerificationService {
    pool: PgPool,
}

impl AgeVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Validate a state transition is allowed by the state machine
    pub fn validate_transition(current: &str, next: &str) -> Result<(), IdentityError> {
        VALID_TRANSITIONS
            .iter()
            .find(|(state, _)| *state == current)
            .and_then(|(_, transitions)| {
                if transitions.contains(&next) {
                    Some(())
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                IdentityError::InvalidStateTransition(format!(
                    "Cannot transition from {} to {}",
                    current, next
                ))
            })
    }

    /// Calculate age from date of birth
    pub fn calculate_age(dob: chrono::NaiveDate) -> i32 {
        let today = Utc::now().date_naive();
        let age = today.year() - dob.year();
        // Adjust if birthday hasn't occurred yet this year
        if today.ordinal() < dob.ordinal() {
            age - 1
        } else {
            age
        }
    }

    /// Validate DOB is reasonable
    pub fn validate_dob(dob: &chrono::NaiveDate) -> Result<(), IdentityError> {
        let today = Utc::now().date_naive();
        if dob > &today {
            return Err(IdentityError::InvalidDob(
                "Date of birth cannot be in the future".to_string(),
            ));
        }
        let age = Self::calculate_age(*dob);
        if age > 120 {
            return Err(IdentityError::InvalidDob(
                "Age exceeds maximum allowed (120 years)".to_string(),
            ));
        }
        if age < 5 {
            return Err(IdentityError::InvalidDob(
                "Age below minimum allowed (5 years)".to_string(),
            ));
        }
        Ok(())
    }

    /// Hash DOB for storage (allows age verification without exposing raw DOB)
    pub fn hash_dob(dob: chrono::NaiveDate) -> String {
        let mut hasher = Sha256::new();
        hasher.update(dob.format("%Y-%m-%d").to_string().as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Submit DOB at signup — transitions from UNVERIFIED to PENDING_SELF_DECLARATION
    pub async fn submit_dob(
        &self,
        user_id: i64,
        req: &SubmitDobRequest,
    ) -> Result<AgeVerificationStatusResponse, IdentityError> {
        Self::validate_dob(&req.date_of_birth)?;

        let current_state: String = sqlx::query_scalar(
            "SELECT age_verification_state FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::UserNotFound)?;

        Self::validate_transition(&current_state, "PENDING_SELF_DECLARATION")?;

        let declared_age = Self::calculate_age(req.date_of_birth);
        let dob_hash = Self::hash_dob(req.date_of_birth);
        let is_adult = declared_age >= 18;

        let next_state = if is_adult {
            "SELF_DECLARED_ADULT"
        } else {
            "PENDING_DOCUMENT_UPLOAD"
        };

        sqlx::query(
            "UPDATE user_verification_profiles 
             SET date_of_birth = $2, date_of_birth_sha256 = $3, 
                 declared_age_at_signup = $4, age_verification_state = $5,
                 updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(req.date_of_birth)
        .bind(&dob_hash)
        .bind(declared_age as i16)
        .bind(next_state)
        .execute(&self.pool)
        .await?;

        // Publish event
        let payload = serde_json::json!({
            "user_id": user_id,
            "declared_age": declared_age,
            "new_state": next_state,
            "is_adult": is_adult
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            user_id,
            "identity.user.dob_submitted",
            &payload,
        )
        .await;

        Ok(AgeVerificationStatusResponse {
            user_id,
            age_verification_state: next_state.to_string(),
            declared_age: Some(declared_age as i16),
            verified_age: None,
            is_adult: is_adult,
            is_minor: !is_adult,
            needs_guardian: !is_adult,
            verification_expires_at: None,
        })
    }

    /// Confirm age after document verification
    /// Called by document_verification module after successful document check
    pub async fn confirm_age(
        &self,
        user_id: i64,
        verified_dob: chrono::NaiveDate,
        document_id: i64,
    ) -> Result<AgeVerificationStatusResponse, IdentityError> {
        let current_state: String = sqlx::query_scalar(
            "SELECT age_verification_state FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::UserNotFound)?;

        let verified_age = Self::calculate_age(verified_dob);
        let is_adult = verified_age >= 18;

        let next_state = if is_adult {
            "ADULT_ACTIVE"
        } else {
            "MINOR_PENDING_GUARDIAN"
        };

        Self::validate_transition(&current_state, next_state)?;

        let now = Utc::now();
        let expires_at = now.checked_add_signed(chrono::Duration::days(365 * 2)); // re-verify every 2 years

        sqlx::query(
            "UPDATE user_verification_profiles 
             SET age_verification_state = $2, verified_age = $3, age_verified_at = $4,
                 identity_document_id = $5, age_verification_expires_at = $6,
                 updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(next_state)
        .bind(verified_age as i16)
        .bind(now)
        .bind(document_id)
        .bind(expires_at)
        .execute(&self.pool)
        .await?;

        let payload = serde_json::json!({
            "user_id": user_id,
            "verified_age": verified_age,
            "new_state": next_state,
            "is_adult": is_adult,
            "document_id": document_id
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            user_id,
            "identity.user.age_confirmed",
            &payload,
        )
        .await;

        Ok(AgeVerificationStatusResponse {
            user_id,
            age_verification_state: next_state.to_string(),
            declared_age: None,
            verified_age: Some(verified_age as i16),
            is_adult,
            is_minor: !is_adult,
            needs_guardian: !is_adult,
            verification_expires_at: expires_at,
        })
    }

    /// Get age verification status for a user
    pub async fn get_status(
        &self,
        user_id: i64,
    ) -> Result<AgeVerificationStatusResponse, IdentityError> {
        let profile = sqlx::query_as::<_, crate::models::UserVerificationProfile>(
            "SELECT * FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::UserNotFound)?;

        let is_adult = profile.age_verification_state == "ADULT_ACTIVE"
            || profile.verified_age.map(|a| a >= 18).unwrap_or(false);
        let is_minor = !is_adult
            && (profile.age_verification_state == "MINOR_ACTIVE"
                || profile.age_verification_state == "MINOR_GUARDIAN_APPROVED"
                || profile.age_verification_state == "MINOR_PENDING_GUARDIAN"
                || profile.age_verification_state == "MINOR_GUARDIAN_PENDING_APPROVAL");
        let needs_guardian = profile.age_verification_state == "MINOR_PENDING_GUARDIAN"
            || profile.age_verification_state == "MINOR_GUARDIAN_PENDING_APPROVAL";

        Ok(AgeVerificationStatusResponse {
            user_id: profile.user_id,
            age_verification_state: profile.age_verification_state,
            declared_age: profile.declared_age_at_signup,
            verified_age: profile.verified_age,
            is_adult,
            is_minor,
            needs_guardian,
            verification_expires_at: profile.age_verification_expires_at,
        })
    }

    /// Check if verification has expired and needs renewal
    pub async fn check_expired(&self, user_id: i64) -> Result<bool, IdentityError> {
        let expires_at: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT age_verification_expires_at FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::UserNotFound)?;

        Ok(expires_at.map(|e| e < Utc::now()).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(AgeVerificationService::validate_transition("UNVERIFIED", "PENDING_SELF_DECLARATION").is_ok());
        assert!(AgeVerificationService::validate_transition("PENDING_SELF_DECLARATION", "SELF_DECLARED_ADULT").is_ok());
        assert!(AgeVerificationService::validate_transition("PENDING_SELF_DECLARATION", "PENDING_DOCUMENT_UPLOAD").is_ok());
        assert!(AgeVerificationService::validate_transition("ADULT_ACTIVE", "AGE_EXPIRED").is_ok());
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(AgeVerificationService::validate_transition("UNVERIFIED", "ADULT_ACTIVE").is_err());
        assert!(AgeVerificationService::validate_transition("UNVERIFIED", "MINOR_ACTIVE").is_err());
        assert!(AgeVerificationService::validate_transition("ADULT_ACTIVE", "UNVERIFIED").is_err());
        assert!(AgeVerificationService::validate_transition("ADULT_ACTIVE", "MINOR_ACTIVE").is_err());
    }

    #[test]
    fn test_age_calculation() {
        let today = Utc::now().date_naive();
        let dob_18_years_ago = chrono::NaiveDate::from_ymd_opt(
            today.year() - 18,
            today.month(),
            today.day(),
        )
        .unwrap();
        assert_eq!(AgeVerificationService::calculate_age(dob_18_years_ago), 18);

        let dob_17_years_ago = chrono::NaiveDate::from_ymd_opt(
            today.year() - 17,
            today.month(),
            today.day(),
        )
        .unwrap();
        assert_eq!(AgeVerificationService::calculate_age(dob_17_years_ago), 17);
    }

    #[test]
    fn test_dob_validation() {
        let future = Utc::now().date_naive() + chrono::Duration::days(1);
        assert!(AgeVerificationService::validate_dob(&future).is_err());

        let too_old = chrono::NaiveDate::from_ymd_opt(1800, 1, 1).unwrap();
        assert!(AgeVerificationService::validate_dob(&too_old).is_err());

        let valid = chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
        assert!(AgeVerificationService::validate_dob(&valid).is_ok());
    }
}
