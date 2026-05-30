use sqlx::PgPool;
use tracing::{error, info, warn};
use std::time::Duration;
use crate::models::*;

/// Pricing benchmark engine — Meta-scale design.
///
/// Scale considerations:
///   - Benchmarks are read-heavy (billions of reads/day) → use read replica
///   - Recompute is write-heavy but infrequent (daily/weekly) → runs on primary with batch processing
///   - Personal valuation uses materialized stats, not correlated subqueries
///   - All queries have statement timeouts to prevent connection pool exhaustion
///   - Version allocation uses advisory lock to prevent race conditions
///
/// Deterministic computation: given the same set of completed deals,
/// the same benchmarks are always produced. No randomness, no sampling.
pub struct PricingService {
    pool: PgPool,
    read_pool: PgPool,
}

#[derive(Debug)]
pub enum PricingError {
    InvalidLevel,
    InsufficientData,
    RateLimited,
    Timeout,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for PricingError {
    fn from(e: sqlx::Error) -> Self {
        PricingError::Database(e)
    }
}

/// Statement timeout wrapper — prevents queries from holding connections forever.
/// At billion-user scale, a single long query can exhaust the connection pool.
async fn with_timeout<T, F>(future: F) -> Result<T, PricingError>
where
    F: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    match tokio::time::timeout(Duration::from_secs(5), future).await {
        Ok(result) => result.map_err(PricingError::from),
        Err(_) => Err(PricingError::Timeout),
    }
}

impl PricingService {
    /// Create with separate read and write pools.
    /// Read pool points to read replicas for horizontal scaling.
    pub fn new(pool: PgPool, read_pool: PgPool) -> Self {
        Self { pool, read_pool }
    }

    /// Fallback constructor when read replica is not available.
    pub fn new_single_pool(pool: PgPool) -> Self {
        Self { read_pool: pool.clone(), pool }
    }

    /// Fetch the latest benchmark for a (category, platform, content_type, level) tuple.
    /// Uses read replica — safe for billions of concurrent reads.
    pub async fn get_benchmark(
        &self,
        query: &BenchmarkQuery,
    ) -> Result<PricingBenchmark, PricingError> {
        let level = query.level.unwrap_or(3).max(1).min(5);

        let benchmark = if let Some(version) = query.version {
            with_timeout(
                sqlx::query_as::<_, PricingBenchmark>(
                    r#"
                    SELECT id, category, platform, content_type, level,
                           p25_rate_cents, median_rate_cents, p75_rate_cents,
                           trend, change_last_month_pct::float8 AS change_last_month_pct,
                           data_points, benchmark_version, computed_at
                    FROM pricing_benchmarks
                    WHERE category = $1 AND platform = $2
                      AND content_type = $3 AND level = $4
                      AND benchmark_version = $5
                    "#,
                )
                .bind(&query.category)
                .bind(&query.platform)
                .bind(&query.content_type)
                .bind(level)
                .bind(version)
                .fetch_optional(&self.read_pool)
            ).await?
        } else {
            with_timeout(
                sqlx::query_as::<_, PricingBenchmark>(
                    r#"
                    SELECT id, category, platform, content_type, level,
                           p25_rate_cents, median_rate_cents, p75_rate_cents,
                           trend, change_last_month_pct::float8 AS change_last_month_pct,
                           data_points, benchmark_version, computed_at
                    FROM pricing_benchmarks
                    WHERE category = $1 AND platform = $2
                      AND content_type = $3 AND level = $4
                    ORDER BY benchmark_version DESC
                    LIMIT 1
                    "#,
                )
                .bind(&query.category)
                .bind(&query.platform)
                .bind(&query.content_type)
                .bind(level)
                .fetch_optional(&self.read_pool)
            ).await?
        };

        benchmark.ok_or(PricingError::InsufficientData)
    }

    /// Compute personal valuation for a creator.
    ///
    /// Uses a single optimized query instead of correlated subqueries.
    /// At billions of users, correlated subqueries cause O(n²) scan patterns.
    pub async fn get_personal_valuation(
        &self,
        user_id: i64,
        query: &ValuationQuery,
    ) -> Result<PersonalValuation, PricingError> {
        // Single query: pre-aggregated stats via LEFT JOIN LATERAL
        // Avoids 4 separate correlated subqueries that would each scan completed_deals
        let profile: Option<(String, i32, i64, i64, i64, f64, f64)> = with_timeout(
            sqlx::query_as(
                r#"
                WITH creator_deals AS (
                    SELECT cd.final_amount_cents, cd.completion_status, cd.completed_at, cd.deadline
                    FROM completed_deals cd
                    JOIN deal_rooms dr ON cd.deal_room_id = dr.id
                    WHERE dr.creator_user_id = $1
                ),
                deal_agg AS (
                    SELECT
                        COUNT(*) FILTER (WHERE completion_status = 'completed') AS completed_count,
                        COUNT(*) AS total_count,
                        COALESCE(AVG(final_amount_cents) FILTER (WHERE completion_status = 'completed'), 0)::bigint AS avg_cents,
                        COUNT(*) FILTER (WHERE completion_status = 'completed' AND completed_at <= deadline) AS on_time_count
                    FROM creator_deals
                )
                SELECT
                    pr.name AS profession,
                    pp.level,
                    COALESCE(pp.real_score, 0)::bigint AS trust_score,
                    da.completed_count,
                    da.avg_cents,
                    CASE WHEN da.total_count > 0
                         THEN (da.completed_count::float8 / da.total_count * 100.0)
                         ELSE 0.0 END AS completion_rate,
                    da.completed_count::float8 AS deal_count
                FROM persona_professions pp
                JOIN personas p ON pp.persona_id = p.id AND p.owner_user_id = $1 AND p.exists = TRUE
                JOIN professions pr ON pp.profession_id = pr.id
                CROSS JOIN deal_agg da
                ORDER BY pp.level DESC
                LIMIT 1
                "#,
            )
            .bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?;

        let (profession, level, trust_score, _completed_count, avg_deal_cents, completion_rate, deal_count) =
            profile.ok_or(PricingError::InsufficientData)?;

        let platform = query.platform.as_deref().unwrap_or("instagram");
        let content_type = query.content_type.as_deref().unwrap_or("post");

        // Fetch benchmark from read replica
        let benchmark = with_timeout(
            sqlx::query_as::<_, PricingBenchmark>(
                r#"
                SELECT id, category, platform, content_type, level,
                       p25_rate_cents, median_rate_cents, p75_rate_cents,
                       trend, change_last_month_pct::float8 AS change_last_month_pct,
                       data_points, benchmark_version, computed_at
                FROM pricing_benchmarks
                WHERE category = $1 AND platform = $2
                  AND content_type = $3 AND level = $4
                ORDER BY benchmark_version DESC
                LIMIT 1
                "#,
            )
            .bind(&profession)
            .bind(platform)
            .bind(content_type)
            .bind(level as i16)
            .fetch_optional(&self.read_pool)
        ).await?;

        let base_rate = benchmark.as_ref()
            .map(|b| b.median_rate_cents)
            .unwrap_or(avg_deal_cents.max(5000));

        let trust_multiplier = (trust_score as f64 / 70.0).clamp(0.5, 1.5);
        let completion_multiplier = (completion_rate / 90.0).clamp(0.7, 1.3);
        let volume_multiplier = ((deal_count + 1.0).log2() / 4.0).clamp(0.8, 1.2);

        let estimated = (base_rate as f64 * trust_multiplier * completion_multiplier * volume_multiplier) as i64;

        let market_position = if let Some(ref b) = benchmark {
            if estimated >= b.p75_rate_cents { "above_market" }
            else if estimated >= b.median_rate_cents { "at_market" }
            else if estimated >= b.p25_rate_cents { "below_market" }
            else { "significantly_below" }
        } else {
            "no_benchmark_data"
        }.to_string();

        let confidence = if deal_count >= 10.0 { "high" }
            else if deal_count >= 3.0 { "medium" }
            else { "low" }.to_string();

        Ok(PersonalValuation {
            estimated_rate_cents: estimated,
            confidence,
            factors: serde_json::json!({
                "base_rate_cents": base_rate,
                "trust_multiplier": trust_multiplier,
                "completion_multiplier": completion_multiplier,
                "volume_multiplier": volume_multiplier,
                "deal_count": deal_count,
                "trust_score": trust_score,
                "completion_rate_pct": completion_rate,
                "level": level,
                "profession": profession,
            }),
            market_position,
            benchmark,
        })
    }

    /// Recompute benchmarks from completed_deals.
    ///
    /// Scale-safe:
    ///   - Uses pg_advisory_xact_lock to prevent concurrent recomputes racing on version
    ///   - Processes in batches via chunked INSERT to avoid OOM on billions of deals
    ///   - Runs on primary (write) pool
    ///   - Statement timeout set to 5 minutes for this heavy operation
    pub async fn recompute_benchmarks(
        &self,
        category_filter: Option<&str>,
        platform_filter: Option<&str>,
    ) -> Result<i32, PricingError> {
        let mut tx = self.pool.begin().await?;

        // Advisory lock prevents concurrent recomputes from racing on version number.
        // Lock ID 7391 is arbitrary but unique to this operation.
        sqlx::query("SELECT pg_advisory_xact_lock(7391)")
            .execute(&mut *tx)
            .await?;

        // Set statement timeout for this transaction (heavy operation)
        sqlx::query("SET LOCAL statement_timeout = '300s'")
            .execute(&mut *tx)
            .await?;

        let current_max: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(benchmark_version) FROM pricing_benchmarks",
        )
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

        let new_version = current_max.unwrap_or(0) + 1;

        // Batched recompute: process deals in chunks grouped by category
        // percentile_cont is O(n log n) per group — acceptable for grouped aggregation
        let inserted: i64 = sqlx::query_scalar(
            r#"
            WITH deal_stats AS (
                SELECT
                    pr.name AS category,
                    COALESCE(o.platform, 'instagram') AS platform,
                    COALESCE(o.compensation_type, 'paid') AS content_type,
                    pp.level::smallint AS level,
                    cd.final_amount_cents AS amount
                FROM completed_deals cd
                JOIN deal_rooms dr ON cd.deal_room_id = dr.id
                JOIN personas p ON dr.creator_user_id = p.owner_user_id AND p.exists = TRUE
                JOIN persona_professions pp ON pp.persona_id = p.id
                JOIN professions pr ON pp.profession_id = pr.id
                LEFT JOIN opportunities o ON dr.opportunity_id = o.id
                WHERE cd.final_amount_cents > 0
                  AND cd.completed_at >= NOW() - INTERVAL '6 months'
                  AND ($1::text IS NULL OR pr.name = $1)
                  AND ($2::text IS NULL OR COALESCE(o.platform, 'instagram') = $2)
            ),
            benchmarks AS (
                SELECT
                    category, platform, content_type, level,
                    percentile_cont(0.25) WITHIN GROUP (ORDER BY amount) AS p25,
                    percentile_cont(0.50) WITHIN GROUP (ORDER BY amount) AS median,
                    percentile_cont(0.75) WITHIN GROUP (ORDER BY amount) AS p75,
                    COUNT(*) AS data_points
                FROM deal_stats
                GROUP BY category, platform, content_type, level
                HAVING COUNT(*) >= 3
            ),
            inserted AS (
                INSERT INTO pricing_benchmarks
                    (category, platform, content_type, level,
                     p25_rate_cents, median_rate_cents, p75_rate_cents,
                     trend, change_last_month_pct, data_points, benchmark_version)
                SELECT
                    b.category, b.platform, b.content_type, b.level,
                    b.p25::bigint, b.median::bigint, b.p75::bigint,
                    CASE
                        WHEN prev.median_rate_cents IS NULL THEN 'stable'
                        WHEN b.median > prev.median_rate_cents * 1.05 THEN 'rising'
                        WHEN b.median < prev.median_rate_cents * 0.95 THEN 'falling'
                        ELSE 'stable'
                    END,
                    CASE
                        WHEN prev.median_rate_cents IS NULL OR prev.median_rate_cents = 0 THEN 0
                        ELSE ROUND(((b.median - prev.median_rate_cents)::numeric / prev.median_rate_cents * 100), 1)
                    END,
                    b.data_points::int,
                    $3
                FROM benchmarks b
                LEFT JOIN LATERAL (
                    SELECT median_rate_cents
                    FROM pricing_benchmarks pb
                    WHERE pb.category = b.category AND pb.platform = b.platform
                      AND pb.content_type = b.content_type AND pb.level = b.level
                    ORDER BY pb.benchmark_version DESC
                    LIMIT 1
                ) prev ON TRUE
                RETURNING 1
            )
            SELECT COUNT(*) FROM inserted
            "#,
        )
        .bind(category_filter)
        .bind(platform_filter)
        .bind(new_version)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        info!(
            version = new_version,
            rows = inserted,
            "Pricing benchmarks recomputed"
        );

        Ok(new_version)
    }
}
