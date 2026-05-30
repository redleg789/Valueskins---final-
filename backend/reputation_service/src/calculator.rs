//! Real reputation score calculation from deal history
//! Replaces hardcoded MOCK_REPUTATION values

use sqlx::PgPool;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReputationScore {
    pub score: i32,                    // 0-100
    pub risk_tier: String,             // A, B, C, D
    pub on_time_rate: f32,             // 0-1.0
    pub avg_rating: f32,               // 0-5.0
    pub response_score: f32,           // 0-1.0
    pub revision_efficiency: f32,      // 0-1.0
    pub repeat_brand_rate: f32,        // 0-1.0
    pub max_deal_size: i32,            // USD
    pub completed_deals: i32,
    pub dispute_count: i32,
    pub calculated_at: DateTime<Utc>,
}

pub struct ReputationCalculator {
    pool: PgPool,
}

impl ReputationCalculator {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Calculate real reputation score from deal history
    pub async fn calculate(&self, creator_id: &str) -> Result<ReputationScore, sqlx::Error> {
        // Get completed deals summary
        let summary: (Option<i64>, Option<f64>, Option<i64>, Option<i64>) = sqlx::query_as(
            "SELECT COUNT(*), AVG(final_rating), MAX(deal_amount), COUNT(CASE WHEN dispute_status IS NOT NULL THEN 1 END) FROM deals WHERE creator_id = $1 AND status = 'completed'"
        )
        .bind(creator_id)
        .fetch_one(&self.pool)
        .await?;

        let (total_opt, avg_rating_opt, max_amount_opt, dispute_opt) = summary;
        let total_deals = total_opt.unwrap_or(0) as i32;
        let disputed = dispute_opt.unwrap_or(0) as i32;

        if total_deals == 0 {
            return Ok(ReputationScore {
                score: 50,
                risk_tier: "C".to_string(),
                on_time_rate: 0.5,
                avg_rating: 2.5,
                response_score: 0.5,
                revision_efficiency: 0.5,
                repeat_brand_rate: 0.0,
                max_deal_size: 0,
                completed_deals: 0,
                dispute_count: 0,
                calculated_at: Utc::now(),
            });
        }

        // On-time rate: completed on or before deadline
        let on_time: (Option<i64>,) = sqlx::query_as(
            "SELECT COUNT(*) FROM deals WHERE creator_id = $1 AND status = 'completed' AND completed_at <= deadline_at"
        )
        .bind(creator_id)
        .fetch_one(&self.pool)
        .await?;
        let on_time_rate = if total_deals > 0 {
            on_time.0.unwrap_or(0) as f32 / total_deals as f32
        } else {
            0.5
        };

        // Average rating (convert 0-100 to 0-5)
        let avg_rating = avg_rating_opt
            .map(|r| (r as f32 / 100.0) * 5.0)
            .unwrap_or(2.5)
            .min(5.0)
            .max(0.0);

        // Response score
        let response_score = if disputed > 0 {
            ((total_deals - disputed) as f32) / (total_deals as f32)
        } else {
            1.0
        };

        // Revision efficiency (simplified)
        let revision_efficiency = 0.8;

        // Repeat brand rate (how many deals with same brand)
        let brand_deals: (Option<i64>,) = sqlx::query_as(
            "SELECT MAX(brand_deal_count) FROM (SELECT COUNT(*) as brand_deal_count FROM deals WHERE creator_id = $1 AND status = 'completed' GROUP BY brand_id) t"
        )
        .bind(creator_id)
        .fetch_one(&self.pool)
        .await?;
        let repeat_brand_rate = if let Some(cnt) = brand_deals.0 {
            if total_deals > 0 {
                ((cnt as f32 / 2.0) / (total_deals as f32)).min(1.0)
            } else {
                0.0
            }
        } else {
            0.0
        };

        // Max deal size
        let max_deal_size = max_amount_opt.unwrap_or(0) as i32;

        // Calculate composite score
        let score = (
            (on_time_rate * 25.0) +
            (avg_rating / 5.0 * 25.0) +
            (response_score * 25.0) +
            (repeat_brand_rate * 25.0)
        ) as i32;

        // Risk tier
        let risk_tier = match (score, disputed) {
            (80..=100, 0) => "A",
            (60..=79, 0..=1) => "B",
            (40..=59, _) => "C",
            _ => "D",
        }
        .to_string();

        Ok(ReputationScore {
            score: score.min(100).max(0),
            risk_tier,
            on_time_rate,
            avg_rating,
            response_score,
            revision_efficiency,
            repeat_brand_rate,
            max_deal_size,
            completed_deals: total_deals,
            dispute_count: disputed,
            calculated_at: Utc::now(),
        })
    }

    /// Get cached reputation or calculate fresh
    pub async fn get_or_calculate(&self, creator_id: &str) -> Result<ReputationScore, sqlx::Error> {
        // Try cached (calculated in last hour)
        let cached: Option<(i32, String, f32, f32, f32, f32, f32, i32, i32, i32)> = sqlx::query_as(
            "SELECT score, risk_tier, on_time_rate, avg_rating, response_score, revision_efficiency, repeat_brand_rate, max_deal_size, completed_deals, dispute_count FROM creator_reputation WHERE creator_id = $1 AND calculated_at > NOW() - INTERVAL '1 hour' LIMIT 1"
        )
        .bind(creator_id)
        .fetch_optional(&self.pool)
        .await?
        .map(|row| row);

        if let Some((score, risk_tier, on_time_rate, avg_rating, response_score, revision_efficiency, repeat_brand_rate, max_deal_size, completed_deals, dispute_count)) = cached {
            return Ok(ReputationScore {
                score,
                risk_tier,
                on_time_rate,
                avg_rating,
                response_score,
                revision_efficiency,
                repeat_brand_rate,
                max_deal_size,
                completed_deals,
                dispute_count,
                calculated_at: Utc::now(),
            });
        }

        // Calculate fresh
        let score = self.calculate(creator_id).await?;

        // Cache it
        let _ = sqlx::query(
            "INSERT INTO creator_reputation (creator_id, score, risk_tier, on_time_rate, avg_rating, response_score, revision_efficiency, repeat_brand_rate, max_deal_size, completed_deals, dispute_count, calculated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (creator_id) DO UPDATE SET score = EXCLUDED.score, risk_tier = EXCLUDED.risk_tier, on_time_rate = EXCLUDED.on_time_rate, avg_rating = EXCLUDED.avg_rating, response_score = EXCLUDED.response_score, revision_efficiency = EXCLUDED.revision_efficiency, repeat_brand_rate = EXCLUDED.repeat_brand_rate, max_deal_size = EXCLUDED.max_deal_size, completed_deals = EXCLUDED.completed_deals, dispute_count = EXCLUDED.dispute_count, calculated_at = EXCLUDED.calculated_at"
        )
        .bind(creator_id)
        .bind(score.score)
        .bind(&score.risk_tier)
        .bind(score.on_time_rate)
        .bind(score.avg_rating)
        .bind(score.response_score)
        .bind(score.revision_efficiency)
        .bind(score.repeat_brand_rate)
        .bind(score.max_deal_size)
        .bind(score.completed_deals)
        .bind(score.dispute_count)
        .bind(score.calculated_at)
        .execute(&self.pool)
        .await?;

        Ok(score)
    }
}
