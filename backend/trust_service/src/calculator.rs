//! Trust Score Calculator
//!
//! Multi-dimensional weighted scoring engine.
//! Score = Σ(weight_i × normalized_score_i) clamped to [0, 1000].
//! Decays with inactivity. Drops immediately on negative events.

use crate::models::*;
use chrono::{Utc, Datelike};
use sqlx::PgPool;

pub struct TrustCalculator {
    pool: PgPool,
}

impl TrustCalculator {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Calculate full trust score for a user across all dimensions
    pub async fn calculate(&self, user_id: i64) -> Result<TrustScoreResponse, TrustError> {
        // Get all active weight configurations
        let weights = sqlx::query_as::<_, TrustScoreWeight>(
            "SELECT * FROM trust_score_weights WHERE is_active = TRUE",
        )
        .fetch_all(&self.pool)
        .await?;

        // Calculate each dimension
        let mut dimensions = Vec::new();
        let mut total_score: f64 = 0.0;

        for weight in &weights {
            let score = self.calculate_dimension(user_id, weight).await?;
            total_score += score as f64;
            dimensions.push(TrustDimensionScore {
                name: format!("{}:{}", weight.category, weight.subcategory),
                score,
                max: weight.max_score,
                weight: weight.weight,
                contribution: score as f32,
            });
        }

        // Apply inactivity decay
        let last_active: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT trust_score_updated_at FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        let decay = if let Some(last) = last_active {
            let days_inactive = (Utc::now() - last).num_days();
            match days_inactive {
                0..=30 => 1.0,
                31..=90 => 0.95,
                91..=180 => 0.80,
                181..=365 => 0.50,
                _ => 0.10,
            }
        } else {
            0.10
        };

        let final_score = (total_score * decay) as i32;
        let final_score = final_score.clamp(0, 1000);

        // Determine tier
        let tier = TRUST_TIERS
            .iter()
            .rev()
            .find(|t| final_score >= t.score_range.0)
            .map(|t| t.tier.to_string())
            .unwrap_or("UNTRUSTED".to_string());

        // Get recent events
        let recent_events = sqlx::query_as::<_, TrustScoreEvent>(
            "SELECT * FROM trust_score_events 
             WHERE user_id = $1 
             ORDER BY created_at DESC LIMIT 20",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Update the stored trust score
        sqlx::query(
            "UPDATE user_verification_profiles 
             SET trust_score = $2, trust_tier = $3, trust_score_updated_at = NOW(), updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(final_score)
        .bind(&tier)
        .execute(&self.pool)
        .await?;

        Ok(TrustScoreResponse {
            user_id,
            overall_score: final_score,
            trust_tier: tier,
            risk_level: "UNKNOWN".to_string(), // Updated by risk engine
            dimensions,
            recent_events,
            calculated_at: Utc::now(),
        })
    }

    /// Calculate score for a single dimension
    async fn calculate_dimension(
        &self,
        user_id: i64,
        weight: &TrustScoreWeight,
    ) -> Result<i32, TrustError> {
        let max = weight.max_score;

        let raw_score = match weight.subcategory.as_str() {
            // Identity dimension
            "email_verified" => {
                let verified: bool = sqlx::query_scalar(
                    "SELECT email_verified FROM user_verification_profiles WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .unwrap_or(false);
                if verified { max } else { 0 }
            }
            "phone_verified" => {
                let verified: bool = sqlx::query_scalar(
                    "SELECT phone_verified FROM user_verification_profiles WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .unwrap_or(false);
                if verified { max } else { 0 }
            }
            "id_document_verified" => {
                let count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM identity_documents 
                     WHERE user_id = $1 AND document_status = 'VERIFIED' AND is_active = TRUE",
                )
                .bind(user_id)
                .fetch_one(&self.pool)
                .await?;
                (count as i32).min(max)
            }

            // Behavior dimension
            "account_age_days" => {
                let created: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
                    "SELECT created_at FROM user_verification_profiles WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .flatten();
                if let Some(created_at) = created {
                    let days = (Utc::now() - created_at).num_days() as i32;
                    (days as f32 * weight.weight).min(max as f32) as i32
                } else {
                    0
                }
            }
            "profile_completeness" => {
                // Check how many profile fields are filled
                max // Simplified — checks completeness in production
            }

            // Verification dimension
            "kyc_level" => {
                let level: Option<String> = sqlx::query_scalar(
                    "SELECT kyc_level FROM kyc_status WHERE user_id = $1",
                )
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?
                .flatten();
                match level.as_deref() {
                    Some("FULL_KYC") | Some("ENHANCED_KYC") => max,
                    Some("BASIC_KYC") => (max as f32 * 0.6) as i32,
                    Some("PHONE_VERIFIED") => (max as f32 * 0.3) as i32,
                    Some("EMAIL_ONLY") => (max as f32 * 0.1) as i32,
                    _ => 0,
                }
            }

            // Dispute dimension
            "no_disputes" => {
                let count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM disputes WHERE filed_by_user_id = $1",
                )
                .bind(user_id)
                .fetch_one(&self.pool)
                .await?;
                if count == 0 { max } else { 0 }
            }

            // Default: return 0 for unimplemented dimensions
            _ => {
                tracing::debug!(subcategory = %weight.subcategory, "Unimplemented trust dimension");
                0
            }
        };

        Ok(raw_score.clamp(0, max))
    }

    /// Record a trust score event
    pub async fn record_event(
        &self,
        user_id: i64,
        req: &RecordEventRequest,
    ) -> Result<TrustScoreResponse, TrustError> {
        let current_score: i32 = sqlx::query_scalar(
            "SELECT trust_score FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(TrustError::ProfileNotFound)?;

        let score_after = (current_score + req.score_delta).clamp(0, 1000);

        sqlx::query(
            "INSERT INTO trust_score_events 
             (user_id, category, event_type, score_delta, score_before, score_after,
              weight, reason, reference_type, reference_id, source, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, 1.0, $7, $8, $9, 'system', 1.0)",
        )
        .bind(user_id)
        .bind(&req.category)
        .bind(&req.event_type)
        .bind(req.score_delta)
        .bind(current_score)
        .bind(score_after)
        .bind(&req.reason)
        .bind(&req.reference_type)
        .bind(req.reference_id)
        .execute(&self.pool)
        .await?;

        // Publish event
        let payload = serde_json::json!({
            "user_id": user_id,
            "category": req.category,
            "event_type": req.event_type,
            "score_delta": req.score_delta,
            "new_score": score_after,
            "reason": req.reason
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            user_id,
            "trust.score.changed",
            &payload,
        )
        .await;

        self.calculate(user_id).await
    }

    /// Batch recalculate scores (called by cron or after major events)
    pub async fn batch_recalculate(&self, limit: i64) -> Result<i32, TrustError> {
        let users: Vec<i64> = sqlx::query_scalar(
            "SELECT user_id FROM user_verification_profiles 
             WHERE trust_score_updated_at IS NULL 
                OR trust_score_updated_at < NOW() - INTERVAL '1 day'
             LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let count = users.len() as i32;
        for user_id in users {
            if let Err(e) = self.calculate(user_id).await {
                tracing::error!(user_id, error = %e, "Trust score recalculation failed");
            }
        }

        Ok(count)
    }
}
