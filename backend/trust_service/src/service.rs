use crate::badge_engine::BadgeEngine;
use crate::calculator::TrustCalculator;
use crate::models::*;
use sqlx::PgPool;

pub struct TrustService {
    pool: PgPool,
    calculator: TrustCalculator,
    badge_engine: BadgeEngine,
}

impl TrustService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            calculator: TrustCalculator::new(pool.clone()),
            badge_engine: BadgeEngine::new(pool.clone()),
            pool,
        }
    }

    /// Get full trust score for a user
    pub async fn get_trust_score(&self, user_id: i64) -> Result<TrustScoreResponse, TrustError> {
        self.calculator.calculate(user_id).await
    }

    /// Record a trust-affecting event and recalculate
    pub async fn record_event(
        &self,
        user_id: i64,
        req: &RecordEventRequest,
    ) -> Result<TrustScoreResponse, TrustError> {
        let result = self.calculator.record_event(user_id, req).await?;

        // Re-evaluate badges after score change
        self.badge_engine.evaluate_all(user_id).await.map_err(TrustError::from)?;

        Ok(result)
    }

    /// Get trust tier info
    pub fn get_tier_info(score: i32) -> &'static TrustTierInfo {
        TRUST_TIERS
            .iter()
            .rev()
            .find(|t| score >= t.score_range.0)
            .unwrap_or(&TRUST_TIERS[0])
    }

    /// Get all tier definitions
    pub fn get_all_tiers() -> Vec<TrustTierInfo> {
        TRUST_TIERS.to_vec()
    }
}
