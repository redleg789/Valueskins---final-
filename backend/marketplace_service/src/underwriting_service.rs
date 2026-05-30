use chrono::Utc;
use sqlx::PgPool;

#[derive(Clone, Debug)]
pub struct UnderwritingResult {
    pub creator_user_id: i64,
    pub risk_tier: String,
    pub risk_score: f64,
    pub max_deal_size_usd: f64,
}

#[derive(Clone, Debug)]
pub enum UnderwritingError {
    NotFound,
    Database(String),
}

impl From<sqlx::Error> for UnderwritingError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => UnderwritingError::NotFound,
            _ => UnderwritingError::Database(err.to_string()),
        }
    }
}

pub struct UnderwritingService {
    pool: PgPool,
}

impl UnderwritingService {
    pub fn new(pool: PgPool) -> Self {
        UnderwritingService { pool }
    }

    /// Calculate risk score and tier
    /// Risk formula:
    /// risk = (ghosting_events * 10) + (revision_abuse_flag * 15) + (fraud_signals_count * 20) - on_time_rate_pct
    /// Clamped to 0-100
    ///
    /// Tiers:
    /// A: risk < 20 → max $5,000
    /// B: risk 20-40 → max $2,000
    /// C: risk 40-60 → max $500
    /// D: risk >= 60 → max $100
    pub async fn evaluate_creator(
        &self,
        creator_user_id: i64,
    ) -> Result<UnderwritingResult, UnderwritingError> {
        // Get ghosting events count
        let ghosting_events: i64 = sqlx::query_scalar(
            "SELECT COALESCE(ghosting_events, 0) FROM trust_scores
             WHERE persona_id IN (SELECT id FROM personas WHERE user_id = $1 LIMIT 1)"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(UnderwritingError::from)?
        .flatten()
        .unwrap_or(0);

        // Get revision abuse flag
        let revision_abuse: bool = sqlx::query_scalar(
            "SELECT COALESCE(revision_abuse_flag, FALSE) FROM trust_scores
             WHERE persona_id IN (SELECT id FROM personas WHERE user_id = $1 LIMIT 1)"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(UnderwritingError::from)?
        .flatten()
        .unwrap_or(false);

        // Count active fraud signals
        let fraud_signal_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM reputation_fraud_signals
             WHERE creator_user_id = $1 AND resolved_at IS NULL"
        )
        .bind(creator_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(UnderwritingError::from)?;

        // Get on_time_rate from reputation metrics
        let on_time_rate: f64 = sqlx::query_scalar(
            "SELECT COALESCE(on_time_rate, 0) FROM creator_reputation_metrics
             WHERE creator_user_id = $1"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(UnderwritingError::from)?
        .flatten()
        .unwrap_or(0.0);

        // Calculate risk score
        let mut risk_score = (ghosting_events as f64 * 10.0)
            + (if revision_abuse { 15.0 } else { 0.0 })
            + (fraud_signal_count as f64 * 20.0)
            - (on_time_rate * 100.0);

        risk_score = risk_score.min(100.0).max(0.0);

        // Determine tier and max deal size
        let (risk_tier, max_deal_size_usd) = match risk_score {
            s if s < 20.0 => ("A", 5000.0),
            s if s < 40.0 => ("B", 2000.0),
            s if s < 60.0 => ("C", 500.0),
            _ => ("D", 100.0),
        };

        let now = Utc::now();

        // UPSERT into creator_underwriting
        sqlx::query(
            "INSERT INTO creator_underwriting
             (creator_user_id, risk_tier, risk_score, max_deal_size_usd, last_evaluated_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (creator_user_id) DO UPDATE SET
               risk_tier = EXCLUDED.risk_tier,
               risk_score = EXCLUDED.risk_score,
               max_deal_size_usd = EXCLUDED.max_deal_size_usd,
               last_evaluated_at = EXCLUDED.last_evaluated_at,
               updated_at = EXCLUDED.updated_at"
        )
        .bind(creator_user_id)
        .bind(risk_tier)
        .bind(risk_score)
        .bind(max_deal_size_usd)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(UnderwritingError::from)?;

        Ok(UnderwritingResult {
            creator_user_id,
            risk_tier: risk_tier.to_string(),
            risk_score,
            max_deal_size_usd,
        })
    }

    /// Batch evaluate all creators — paginated to prevent OOM at scale.
    pub async fn batch_evaluate_all(&self) -> Result<usize, UnderwritingError> {
        let batch_size: i64 = 1000;
        let mut offset: i64 = 0;
        let mut count = 0;

        loop {
            let creator_ids: Vec<i64> = sqlx::query_scalar(
                "SELECT DISTINCT creator_user_id FROM completed_deals \
                 ORDER BY creator_user_id LIMIT $1 OFFSET $2"
            )
            .bind(batch_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(UnderwritingError::from)?;

            if creator_ids.is_empty() {
                break;
            }

            for creator_id in &creator_ids {
                if self.evaluate_creator(*creator_id).await.is_ok() {
                    count += 1;
                }
            }

            offset += batch_size;
        }

        Ok(count)
    }

    /// Get underwriting for a creator
    pub async fn get_underwriting(
        &self,
        creator_user_id: i64,
    ) -> Result<UnderwritingResult, UnderwritingError> {
        let row: (i64, String, f64, f64) = sqlx::query_as(
            "SELECT creator_user_id, risk_tier, risk_score, max_deal_size_usd
             FROM creator_underwriting WHERE creator_user_id = $1"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(UnderwritingError::from)?
        .ok_or(UnderwritingError::NotFound)?;

        Ok(UnderwritingResult {
            creator_user_id: row.0,
            risk_tier: row.1,
            risk_score: row.2,
            max_deal_size_usd: row.3,
        })
    }
}
