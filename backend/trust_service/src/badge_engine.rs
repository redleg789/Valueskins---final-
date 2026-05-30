//! Badge Engine
//!
//! Automatically awards and revokes badges based on user state and trust score.
//! Badges are never user-settable — always derived from verified state.

use sqlx::PgPool;

pub struct BadgeEngine {
    pool: PgPool,
}

impl BadgeEngine {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Evaluate and award/revoke all auto badges for a user
    pub async fn evaluate_all(&self, user_id: i64) -> Result<(), sqlx::Error> {
        self.evaluate_identity_badges(user_id).await?;
        self.evaluate_trust_badges(user_id).await?;
        self.evaluate_risk_badges(user_id).await?;
        self.evaluate_verification_badges(user_id).await?;
        Ok(())
    }

    /// Identity badges: Email, Phone, ID, Selfie verified
    async fn evaluate_identity_badges(&self, user_id: i64) -> Result<(), sqlx::Error> {
        let profile: Option<(bool, bool)> = sqlx::query_as(
            "SELECT email_verified, phone_verified FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((email, phone)) = profile {
            if email {
                self.award_badge(user_id, "EMAIL_VERIFIED").await?;
            }
            if phone {
                self.award_badge(user_id, "PHONE_VERIFIED").await?;
            }

            // Check ID verification
            let id_verified: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM identity_documents 
                 WHERE user_id = $1 AND document_status = 'VERIFIED' AND is_active = TRUE)",
            )
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

            if id_verified {
                self.award_badge(user_id, "ID_VERIFIED").await?;
            } else {
                self.revoke_badge(user_id, "ID_VERIFIED").await?;
            }
        }

        Ok(())
    }

    /// Trust badges: based on trust score
    async fn evaluate_trust_badges(&self, user_id: i64) -> Result<(), sqlx::Error> {
        let score: Option<i32> = sqlx::query_scalar(
            "SELECT trust_score FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(score) = score {
            match score {
                0..=200 => {
                    self.revoke_badge(user_id, "TRUSTED_CREATOR").await?;
                    self.award_badge(user_id, "NEW_ACCOUNT").await?;
                }
                201..=400 => {
                    self.revoke_badge(user_id, "NEW_ACCOUNT").await?;
                    self.revoke_badge(user_id, "TRUSTED_CREATOR").await?;
                }
                401..=600 => {
                    self.award_badge(user_id, "TRUSTED_CREATOR").await?;
                }
                601..=800 => {
                    self.award_badge(user_id, "TRUSTED_CREATOR").await?;
                }
                _ => {
                    self.award_badge(user_id, "TRUSTED_CREATOR").await?;
                }
            }
        }

        Ok(())
    }

    /// Risk badges: warning states based on risk level and verification state
    async fn evaluate_risk_badges(&self, user_id: i64) -> Result<(), sqlx::Error> {
        let profile: Option<(String, String, bool)> = sqlx::query_as(
            "SELECT age_verification_state, risk_level, is_under_investigation 
             FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((age_state, risk_level, is_investigation)) = profile {
            // Under Review
            if is_investigation || age_state == "AGE_UNDER_REVIEW" {
                self.award_badge(user_id, "UNDER_REVIEW").await?;
            } else {
                self.revoke_badge(user_id, "UNDER_REVIEW").await?;
            }

            // High Risk
            if risk_level == "HIGH" || risk_level == "CRITICAL" {
                self.award_badge(user_id, "HIGH_RISK").await?;
            } else {
                self.revoke_badge(user_id, "HIGH_RISK").await?;
            }

            // Guardian managed
            if age_state == "MINOR_ACTIVE" || age_state == "MINOR_GUARDIAN_APPROVED" {
                self.award_badge(user_id, "GUARDIAN_CONTROLLED").await.unwrap_or_default();
                self.award_badge(user_id, "MINOR_ACCOUNT").await.unwrap_or_default();
            } else {
                self.revoke_badge(user_id, "GUARDIAN_CONTROLLED").await?;
                self.revoke_badge(user_id, "MINOR_ACCOUNT").await?;
            }
        }

        Ok(())
    }

    /// Verification badges: enterprise, business, public figure
    async fn evaluate_verification_badges(&self, user_id: i64) -> Result<(), sqlx::Error> {
        // Check if user has verified company affiliations
        let has_company: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM employee_verifications 
             WHERE user_id = $1 AND state = 'FULLY_VERIFIED')",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if has_company {
            self.award_badge(user_id, "BUSINESS_VERIFIED").await?;
        } else {
            self.revoke_badge(user_id, "BUSINESS_VERIFIED").await?;
        }

        // Check public figure status
        let is_public_figure: bool = sqlx::query_scalar(
            "SELECT is_public_figure FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or(false);

        if is_public_figure {
            self.award_badge(user_id, "PUBLIC_FIGURE").await?;
        }

        Ok(())
    }

    /// Award a badge to a user (idempotent)
    async fn award_badge(&self, user_id: i64, badge_code: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO user_badges (user_id, badge_id, awarded_reason)
             SELECT $1, id, 'Automatically awarded by trust engine'
             FROM badges WHERE badge_code = $2
             ON CONFLICT (user_id, badge_id, is_active) WHERE is_active = TRUE DO NOTHING",
        )
        .bind(user_id)
        .bind(badge_code)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Revoke a badge from a user (idempotent)
    async fn revoke_badge(&self, user_id: i64, badge_code: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE user_badges 
             SET is_active = FALSE, deactivated_at = NOW(), deactivation_reason = 'Score threshold no longer met'
             WHERE user_id = $1 AND badge_id = (SELECT id FROM badges WHERE badge_code = $2) AND is_active = TRUE",
        )
        .bind(user_id)
        .bind(badge_code)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
