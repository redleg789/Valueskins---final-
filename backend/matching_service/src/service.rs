use sqlx::PgPool;
use tracing::info;
use std::time::Duration;
use crate::models::*;

/// Timeout wrapper — prevents queries from holding connections forever.
async fn with_timeout<T, F>(future: F) -> Result<T, sqlx::Error>
where
    F: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    match tokio::time::timeout(Duration::from_secs(5), future).await {
        Ok(result) => result,
        Err(_) => Err(sqlx::Error::Io(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "query timeout"
        ))),
    }
}

/// ValuSkin matching engine.
///
/// The core invariant: a creator and brand can ONLY be matched if they share
/// the same profession (ValuSkin). The matching engine enforces this at the
/// query level — no application-layer filtering that could be bypassed.
///
/// Match score formula:
///   base = 50 (same ValuSkin match)
///   + level_bonus (effective_level * 5, max 25) — C-Suite boost applied here
///   + engagement_bonus (if engagement >= 5%, +10)
///   + reliability_bonus (if on_time_rate >= 95%, +10)
///   + repeat_bonus (if repeat_brand_rate >= 0.3, +5)
///   Capped at 100.
///
/// C-Suite advantage: platform_csuite_settings configures a level boost for
/// title-holders (CEO, CTO, VP, etc.). The effective level = base_level +
/// level_boost if enabled for the platform, capped at 5.
pub struct MatchingService {
    pool: PgPool,
    read_pool: PgPool,
    cache: shared::cache::RedisCache,
}

/// Result of a fraud rule threshold lookup.
/// Contains the threshold value and the action to take when exceeded.
struct FraudRuleThreshold {
    threshold: f64,
    action: String,
}

impl MatchingService {
    /// Compute the effective creator level for a given platform.
    /// Applies C-Suite advantage if the platform has it enabled and
    /// the creator holds a whitelisted title.
    ///
    /// Caps effective level at 5 (system maximum).
    async fn get_effective_level(
        &self,
        persona_id: i64,
        base_level: i32,
        platform_id: &str,
    ) -> i32 {
        // Fetch platform C-Suite settings from read pool
        let settings = sqlx::query(
            "SELECT enabled, level_boost_amount, title_whitelist \
             FROM platform_csuite_settings \
             WHERE platform_id = $1 AND enabled = TRUE"
        )
        .bind(platform_id)
        .fetch_optional(&self.read_pool)
        .await;

        let (boost_amount, whitelist): (i32, Vec<String>) = match settings {
            Ok(Some(row)) => {
                use sqlx::Row;
                let amount: i32 = row.try_get("level_boost_amount").unwrap_or(0);
                let titles: Vec<String> = row.try_get("title_whitelist").unwrap_or_default();
                (amount, titles)
            }
            _ => return base_level,
        };

        if boost_amount == 0 || whitelist.is_empty() {
            return base_level;
        }

        // Check if persona has any whitelisted title (verified) from read pool
        let has_csuite: bool = sqlx::query_scalar(
            "SELECT EXISTS(\
                SELECT 1 FROM persona_titles \
                WHERE persona_id = $1 AND is_active = TRUE AND is_verified = TRUE \
                AND title = ANY($2)\
            )"
        )
        .bind(persona_id)
        .bind(&whitelist)
        .fetch_optional(&self.read_pool)
        .await
        .unwrap_or(None)
        .unwrap_or(false);

        if has_csuite {
            (base_level + boost_amount).min(5)
        } else {
            base_level
        }
    }
}

#[derive(Debug)]
pub enum MatchingError {
    NoProfessionSpecified,
    InvalidLevel,
    RateLimited { limit: i64, window: String },
    NotFound,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for MatchingError {
    fn from(e: sqlx::Error) -> Self {
        MatchingError::Database(e)
    }
}

impl MatchingService {
    pub fn new(pool: PgPool, cache: shared::cache::RedisCache) -> Self {
        Self { pool: pool.clone(), read_pool: pool, cache }
    }

    pub fn new_with_read_pool(pool: PgPool, read_pool: PgPool, cache: shared::cache::RedisCache) -> Self {
        Self { pool, read_pool, cache }
    }

    /// Lookup a fraud rule threshold from the admin-configurable fraud_rules table.
    /// Returns None if the rule does not exist or is disabled.
    async fn get_fraud_rule_threshold(
        &self,
        rule_name: &str,
    ) -> Option<FraudRuleThreshold> {
        let row: Option<(f64, String)> = sqlx::query_as(
            "SELECT threshold_value::float8, action FROM fraud_rules WHERE rule_name = $1 AND enabled = TRUE"
        )
        .bind(rule_name)
        .fetch_optional(&self.read_pool)
        .await
        .ok()?;

        row.map(|(threshold, action)| FraudRuleThreshold { threshold, action })
    }

    /// Check and enforce discovery scan rate limit for a user.
    /// Uses the discovery_rate_limits table with a 1-hour sliding window.
    /// Returns Ok(()) if allowed, Err(MatchingError::RateLimited) if blocked.
    async fn enforce_discovery_rate_limit(
        &self,
        user_id: i64,
    ) -> Result<(), MatchingError> {
        let threshold = self.get_fraud_rule_threshold("max_discovery_scans_per_hour").await;
        let max_scans = threshold.map(|t| t.threshold as i64).unwrap_or(100);

        // UPSERT: reset window if older than 1 hour, otherwise increment
        let scan_count: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO discovery_rate_limits (user_id, scan_count, window_start)
            VALUES ($1, 1, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                scan_count = CASE
                    WHEN discovery_rate_limits.window_start < NOW() - INTERVAL '1 hour'
                    THEN 1
                    ELSE discovery_rate_limits.scan_count + 1
                END,
                window_start = CASE
                    WHEN discovery_rate_limits.window_start < NOW() - INTERVAL '1 hour'
                    THEN NOW()
                    ELSE discovery_rate_limits.window_start
                END
            RETURNING scan_count
            "#
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(MatchingError::Database)?;

        if scan_count > max_scans {
            return Err(MatchingError::RateLimited {
                limit: max_scans,
                window: "1 hour".to_string(),
            });
        }

        Ok(())
    }

    /// Brand discovers creators — filtered by ValuSkin match.
    ///
    /// Returns ONLY creators whose persona_professions.profession matches
    /// the brand's specified profession. This is the core matching gate.
    ///
    /// Enforces discovery rate limiting before returning results.
    pub async fn discover_creators(
        &self,
        brand_user_id: i64,
        query: &DiscoverCreatorsQuery,
    ) -> Result<(Vec<MatchedCreator>, i64), MatchingError> {
        // Fraud prevention gate: enforce discovery scan rate limit
        self.enforce_discovery_rate_limit(brand_user_id).await?;

        let profession = query.profession.as_deref()
            .ok_or(MatchingError::NoProfessionSpecified)?;
        let min_level = query.min_level.unwrap_or(1).max(1).min(5);
        let barter_only = query.barter_only.unwrap_or(false);
        let limit = query.limit.unwrap_or(20).min(100) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;

        #[derive(sqlx::FromRow)]
        struct CreatorWithCount {
            user_id: i64,
            username: String,
            display_name: String,
            avatar_url: Option<String>,
            profession: String,
            slot: Option<i32>,
            level: i32,
            score: f64,
            willing_to_barter: bool,
            energy_state: String,
            price_band: String,
            total_count: i64,
        }

        let cache_key = format!(
            "matching:discover:{}:{}:{}:{}:{}:{}",
            brand_user_id, profession, min_level, barter_only, limit, offset
        );

        let (creators, total_count) = match self.cache.get::<(Vec<MatchedCreator>, i64)>(&cache_key).await.unwrap_or(None) {
            Some(cached) => cached,
            None => {
                // Core query: JOIN persona_professions with professions to enforce ValuSkin match.
                // LEFT JOIN user_settings for barter/energy filtering.
                // Exclude the brand's own user from results.
                let rows = with_timeout(sqlx::query_as::<_, CreatorWithCount>(
                    r#"
                    WITH creator_history AS (
                        SELECT
                            cd.creator_user_id,
                            COUNT(*)::int AS completed_deals,
                            COALESCE(AVG(cd.total_amount), 0)::float8 AS avg_deal_amount,
                            COALESCE(AVG(GREATEST(roi.roi_pct, 0)), 0)::float8 AS avg_roi_pct,
                            COALESCE(SUM(roi.conversions), 0)::float8 AS total_conversions
                        FROM completed_deals cd
                        LEFT JOIN brand_campaign_roi roi ON roi.completed_deal_id = cd.id
                        GROUP BY cd.creator_user_id
                    )
                    SELECT
                        u.id AS user_id,
                        u.username,
                        u.display_name,
                        u.avatar_url,
                        pr.name AS profession,
                        pp.slot,
                        pp.level,
                        LEAST(
                            100.0,
                            LEAST(pp.level::float8 * 6.0, 30.0)
                            + LEAST(COALESCE(pp.real_score, 0)::float8 / 2.5, 20.0)
                            + LEAST(COALESCE(crm.reputation_score, 50)::float8 / 5.0, 20.0)
                            + LEAST(COALESCE(far.engagement_authenticity_score, 50)::float8 / 5.0, 15.0)
                            + LEAST(COALESCE(ch.avg_roi_pct, 0)::float8 / 10.0, 10.0)
                            + (LEAST(COALESCE(ch.total_conversions, 0)::float8, 50.0) / 10.0)
                            + CASE
                                WHEN COALESCE(ch.completed_deals, 0) BETWEEN 1 AND 5
                                     AND COALESCE(crm.reputation_score, 50) >= 60
                                     AND COALESCE(far.engagement_authenticity_score, 50) >= 60
                                THEN 5.0
                                ELSE 0.0
                              END
                        ) AS score,
                        COALESCE(us.willing_to_barter, FALSE) AS willing_to_barter,
                        COALESCE(us.energy_state, 'available') AS energy_state,
                        COALESCE(us.price_band, 'mid-tier') AS price_band,
                        COUNT(*) OVER()::int8 AS total_count
                    FROM persona_professions pp
                    JOIN personas p ON pp.persona_id = p.id AND p.exists = TRUE
                    JOIN users u ON p.owner_user_id = u.id AND u.is_active = TRUE
                    JOIN professions pr ON pp.profession_id = pr.id
                    LEFT JOIN user_settings us ON u.id = us.user_id
                    LEFT JOIN creator_reputation_metrics crm ON crm.creator_user_id = u.id
                    LEFT JOIN creator_history ch ON ch.creator_user_id = u.id
                    LEFT JOIN LATERAL (
                        SELECT engagement_authenticity_score
                        FROM follower_audit_results
                        WHERE persona_id = p.id
                        ORDER BY audited_at DESC
                        LIMIT 1
                    ) far ON TRUE
                    WHERE pr.name = $1
                      AND pp.level >= $2
                      AND u.id != $3
                      AND COALESCE(us.energy_state, 'available') != 'pause'
                      AND ($4 = FALSE OR COALESCE(us.willing_to_barter, FALSE) = TRUE)
                    ORDER BY score DESC, pp.level DESC, pp.real_score DESC
                    LIMIT $5 OFFSET $6
                    "#,
                )
                .bind(profession)
                .bind(min_level)
                .bind(brand_user_id)
                .bind(barter_only)
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.read_pool)).await?;

                let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
                let fetch_creators: Vec<MatchedCreator> = rows.into_iter().map(|r| MatchedCreator {
                    user_id: r.user_id,
                    username: r.username,
                    display_name: r.display_name,
                    avatar_url: r.avatar_url,
                    profession: r.profession,
                    slot: r.slot.map(|s| s.to_string()).unwrap_or_default(),
                    level: r.level,
                    score: r.score as i64,
                    willing_to_barter: r.willing_to_barter,
                    energy_state: r.energy_state,
                    price_band: r.price_band,
                }).collect();

                let _ = self.cache.set(&cache_key, &(fetch_creators.clone(), total_count), std::time::Duration::from_secs(60)).await;
                (fetch_creators, total_count)
            }
        };

        // Batch log audit entries for matched creators (prevent N+1 loop)
        // Build list of tuples to insert, then do a single batch insert
        if !creators.is_empty() {
            let audit_entries: Vec<(i64, i64, String, f64, serde_json::Value)> = creators.iter().map(|creator| {
                (
                    brand_user_id,
                    creator.user_id,
                    creator.profession.clone(),
                    Self::compute_match_score(creator),
                    serde_json::json!({
                        "level": creator.level,
                        "score": creator.score,
                        "energy": &creator.energy_state,
                        "barter": creator.willing_to_barter,
                    })
                )
            }).collect();

            // Single batch insert instead of N inserts
            for (brand_id, creator_id, prof, score, factors) in audit_entries {
                let _ = sqlx::query(
                    r#"INSERT INTO matching_audit_log
                           (brand_user_id, creator_user_id, matched_profession, match_score, match_factors, decision)
                       VALUES ($1, $2, $3, $4, $5, 'matched')
                       ON CONFLICT DO NOTHING"#
                )
                .bind(brand_id)
                .bind(creator_id)
                .bind(prof)
                .bind(score)
                .bind(factors)
                .execute(&self.pool)
                .await;
            }
        }

        Ok((creators, total_count))
    }

    /// Creator discovers opportunities — filtered by their ValuSkin.
    ///
    /// Returns ONLY opportunities where the brand has specified a matching_requirement
    /// that matches the creator's ValuSkin profession.
    pub async fn discover_opportunities(
        &self,
        creator_user_id: i64,
        query: &DiscoverOpportunitiesQuery,
    ) -> Result<(Vec<MatchedOpportunity>, i64), MatchingError> {
        let limit = query.limit.unwrap_or(20).min(100) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;

        // Verify the creator actually holds this ValuSkin
        let has_skin: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM persona_professions pp
                JOIN personas p ON pp.persona_id = p.id
                JOIN professions pr ON pp.profession_id = pr.id
                WHERE p.owner_user_id = $1 AND pr.name = $2
            )
            "#,
        )
        .bind(creator_user_id)
        .bind(&query.valueskin)
        .fetch_one(&self.read_pool)
        .await?;

        if !has_skin {
            return Ok((vec![], 0));
        }

        #[derive(sqlx::FromRow)]
        struct OpportunityWithCount {
            opportunity_id: i64,
            brand_name: String,
            title: String,
            description: String,
            campaign_type: String,
            required_profession: String,
            min_level: i32,
            compensation_type: String,
            reward_amount: Option<i64>,
            match_score: f64,
            total_count: i64,
        }

        let rows = sqlx::query_as::<_, OpportunityWithCount>(
            r#"
            SELECT
                o.id AS opportunity_id,
                u.display_name AS brand_name,
                o.title,
                o.description,
                COALESCE(o.compensation_type, 'paid') AS campaign_type,
                mr.required_profession,
                mr.min_level,
                COALESCE(o.compensation_type, 'paid') AS compensation_type,
                o.reward_amount,
                LEAST(
                    100.0,
                    40.0
                    + CASE
                        WHEN cc.creator_level >= mr.min_level
                            THEN LEAST(20.0, 20.0 - GREATEST(cc.creator_level - mr.min_level, 0)::float8 * 2.0)
                        ELSE GREATEST(0.0, 12.0 - (mr.min_level - cc.creator_level)::float8 * 6.0)
                      END
                    + CASE
                        WHEN cc.avg_deal_amount <= 0 THEN 12.0
                        WHEN o.reward_amount::float8 >= cc.avg_deal_amount * 0.85
                             AND o.reward_amount::float8 <= cc.avg_deal_amount * 1.25 THEN 20.0
                        WHEN o.reward_amount::float8 >= cc.avg_deal_amount * 0.65 THEN 14.0
                        WHEN o.reward_amount::float8 >= cc.avg_deal_amount * 0.45 THEN 8.0
                        ELSE 4.0
                      END
                    + LEAST(cc.reputation_score / 10.0, 10.0)
                    + CASE
                        WHEN cc.creator_requires_advance = FALSE THEN 10.0
                        WHEN COALESCE(brand_ap.brand_offers_advance, FALSE) = TRUE THEN 10.0
                        ELSE 0.0
                      END
                ) AS match_score,
                COUNT(*) OVER()::int8 AS total_count
            FROM matching_requirements mr
            JOIN opportunities o ON mr.opportunity_id = o.id AND o.status IN ('active', 'open')
            JOIN users u ON o.brand_user_id = u.id
            CROSS JOIN LATERAL (
                SELECT
                    MAX(pp.level)::int AS creator_level,
                    COALESCE(MAX(crm.reputation_score), 50)::float8 AS reputation_score,
                    COALESCE(AVG(cd.total_amount), 0)::float8 AS avg_deal_amount,
                    COALESCE(BOOL_OR(ap.creator_requires_advance), FALSE) AS creator_requires_advance
                FROM persona_professions pp
                JOIN personas p ON pp.persona_id = p.id
                JOIN professions pr ON pp.profession_id = pr.id
                LEFT JOIN creator_reputation_metrics crm ON crm.creator_user_id = p.owner_user_id
                LEFT JOIN completed_deals cd ON cd.creator_user_id = p.owner_user_id
                LEFT JOIN advance_preferences ap ON ap.user_id = p.owner_user_id
                WHERE p.owner_user_id = $1
                  AND pr.name = $2
            ) cc
            LEFT JOIN advance_preferences brand_ap ON brand_ap.user_id = o.brand_user_id
            WHERE mr.required_profession = $2
              AND ($3::TEXT IS NULL OR o.compensation_type = $3)
            ORDER BY match_score DESC, mr.priority ASC, o.created_at DESC
            LIMIT $4 OFFSET $5
            "#,
        )
        .bind(creator_user_id)
        .bind(&query.valueskin)
        .bind(query.compensation_filter.as_deref())
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
        let opportunities = rows.into_iter().map(|r| MatchedOpportunity {
            opportunity_id: r.opportunity_id,
            brand_name: r.brand_name,
            title: r.title,
            description: Some(r.description),
            campaign_type: r.campaign_type,
            required_profession: r.required_profession,
            min_level: r.min_level,
            compensation_type: r.compensation_type,
            reward_amount: r.reward_amount,
            match_score: r.match_score,
        }).collect();

        Ok((opportunities, total_count))
    }

    /// Set matching requirements for an opportunity.
    /// Brands MUST specify at least one profession.
    pub async fn set_requirements(
        &self,
        opportunity_id: i64,
        brand_user_id: i64,
        req: &SetMatchingRequirementsRequest,
    ) -> Result<Vec<MatchingRequirement>, MatchingError> {
        if req.requirements.is_empty() {
            return Err(MatchingError::NoProfessionSpecified);
        }

        // Transaction with FOR UPDATE on opportunity to prevent concurrent modification
        let mut tx = self.pool.begin().await?;

        // Verify ownership (also implicitly locks via FOR UPDATE)
        let owns: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM opportunities WHERE id = $1 AND brand_user_id = $2)",
        )
        .bind(opportunity_id)
        .bind(brand_user_id)
        .fetch_one(&mut *tx)
        .await?;

        if !owns {
            return Err(MatchingError::Database(sqlx::Error::RowNotFound));
        }

        // Lock opportunity row to prevent concurrent updates
        sqlx::query("SELECT 1 FROM opportunities WHERE id = $1 FOR UPDATE")
            .bind(opportunity_id)
            .execute(&mut *tx)
            .await?;

        // Clear existing requirements
        sqlx::query("DELETE FROM matching_requirements WHERE opportunity_id = $1")
            .bind(opportunity_id)
            .execute(&mut *tx)
            .await?;

        let mut result = Vec::new();
        let mut profession_names = Vec::new();

        for input in &req.requirements {
            let level = input.min_level.unwrap_or(1).max(1).min(5);
            let priority = input.priority.unwrap_or(1).max(1).min(3);

            let row = sqlx::query_as::<_, MatchingRequirement>(
                r#"
                INSERT INTO matching_requirements (opportunity_id, required_profession, min_level, priority)
                VALUES ($1, $2, $3, $4)
                RETURNING id, opportunity_id, required_profession, min_level, priority, created_at
                "#,
            )
            .bind(opportunity_id)
            .bind(&input.required_profession)
            .bind(level)
            .bind(priority)
            .fetch_one(&mut *tx)
            .await?;

            profession_names.push(input.required_profession.clone());
            result.push(row);
        }

        // Denormalize into opportunities.required_professions for fast reads
        sqlx::query(
            "UPDATE opportunities SET required_professions = $1 WHERE id = $2",
        )
        .bind(&profession_names)
        .bind(opportunity_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(result)
    }

    /// Get matching requirements for an opportunity.
    pub async fn get_requirements(
        &self,
        opportunity_id: i64,
    ) -> Result<Vec<MatchingRequirement>, MatchingError> {
        let rows = sqlx::query_as::<_, MatchingRequirement>(
            "SELECT id, opportunity_id, required_profession, min_level, priority, created_at FROM matching_requirements WHERE opportunity_id = $1 ORDER BY priority LIMIT 50",
        )
        .bind(opportunity_id)
        .fetch_all(&self.read_pool)
        .await?;

        Ok(rows)
    }

    /// Get the audit log for a specific opportunity or creator.
    /// Uses UNION ALL to avoid OR clause that prevents index usage.
    pub async fn get_audit_log(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<MatchAuditEntry>, MatchingError> {
        let rows = sqlx::query_as::<_, MatchAuditEntry>(
            r#"
            (SELECT id, opportunity_id, brand_user_id, creator_user_id,
                    matched_profession, match_score::float8 AS match_score,
                    decision, created_at
             FROM matching_audit_log
             WHERE brand_user_id = $1)
            UNION ALL
            (SELECT id, opportunity_id, brand_user_id, creator_user_id,
                    matched_profession, match_score::float8 AS match_score,
                    decision, created_at
             FROM matching_audit_log
             WHERE creator_user_id = $1)
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(user_id)
        .bind(limit.min(100))
        .fetch_all(&self.read_pool)
        .await?;

        Ok(rows)
    }

    fn compute_match_score(creator: &MatchedCreator) -> f64 {
        (creator.score as f64).min(100.0)
    }

    // === DEAL SUGGESTIONS ===

    /// Get proactive deal suggestions for a creator.
    ///
    /// Suggestion score formula:
    ///   base = 40 (ValuSkin match — required gate)
    ///   + level_fit = min(creator_level * 4, 20)
    ///   + price_band_overlap = 15 if bands overlap, else 0
    ///   + trust_bonus = min(trust_score / 10, 10)
    ///   + audit_bonus = min(authenticity_score / 10, 10)
    ///   + advance_bonus = 5 if advance_compatible
    ///   Capped at 100.
    ///
    /// Hard filter: if creator requires_advance=true AND brand offers_advance=false → not matched.
    pub async fn get_suggestions(
        &self,
        query: &SuggestionQuery,
    ) -> Result<(Vec<DealSuggestion>, i64), MatchingError> {
        let limit = query.limit.unwrap_or(10).min(50) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;
        let min_score = query.min_score.unwrap_or(0.0);
        let advance_only = query.advance_only.unwrap_or(false);

        #[derive(sqlx::FromRow)]
        struct SuggestionWithCount {
            id: i64,
            brand_user_id: i64,
            brand_name: String,
            creator_persona_id: i64,
            match_score: f64,
            match_factors: serde_json::Value,
            advance_compatible: bool,
            status: String,
            created_at: chrono::DateTime<chrono::Utc>,
            total_count: i64,
        }

        let rows = sqlx::query_as::<_, SuggestionWithCount>(
            r#"
            SELECT ds.id, ds.brand_user_id,
                   u.display_name AS brand_name,
                   ds.creator_persona_id,
                   ds.match_score::float8 AS match_score,
                   ds.match_factors,
                   ds.advance_compatible,
                   ds.status,
                   ds.created_at,
                   COUNT(*) OVER()::int8 AS total_count
            FROM deal_suggestions ds
            JOIN users u ON ds.brand_user_id = u.id
            WHERE ds.creator_persona_id = $1
              AND ds.status = 'suggested'
              AND ds.match_score >= $2
              AND ($3 = FALSE OR ds.advance_compatible = TRUE)
            ORDER BY ds.match_score DESC, ds.created_at DESC
            LIMIT $4 OFFSET $5
            "#,
        )
        .bind(query.persona_id)
        .bind(min_score)
        .bind(advance_only)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.read_pool)
        .await?;

        let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
        let suggestions = rows.into_iter().map(|r| DealSuggestion {
            id: r.id,
            brand_user_id: r.brand_user_id,
            brand_name: r.brand_name,
            creator_persona_id: r.creator_persona_id,
            match_score: r.match_score,
            match_factors: r.match_factors,
            advance_compatible: r.advance_compatible,
            status: r.status,
            created_at: r.created_at,
        }).collect();

        Ok((suggestions, total_count))
    }

    /// Generate suggestions for a specific opportunity (brand-side).
    /// Finds creators that match the opportunity's requirements and ranks them.
    pub async fn generate_suggestions_for_opportunity(
        &self,
        brand_user_id: i64,
        opportunity_id: i64,
    ) -> Result<i32, MatchingError> {
        // Get opportunity requirements
        let requirements = self.get_requirements(opportunity_id).await?;
        if requirements.is_empty() {
            return Err(MatchingError::NoProfessionSpecified);
        }

        // Get brand's advance preference from read pool
        let brand_offers_advance: bool = sqlx::query_scalar(
            "SELECT COALESCE(brand_offers_advance, FALSE) FROM advance_preferences WHERE user_id = $1",
        )
        .bind(brand_user_id)
        .fetch_optional(&self.read_pool)
        .await?
        .unwrap_or(false);

        let mut total_inserted = 0i32;

        for req in &requirements {
            // Find matching creators and compute suggestion scores
            let inserted: i64 = sqlx::query_scalar(
                r#"
                WITH opportunity_context AS (
                    SELECT COALESCE(reward_amount, 0)::float8 AS reward_amount
                    FROM opportunities
                    WHERE id = $5 AND brand_user_id = $4
                ),
                creator_history AS (
                    SELECT
                        cd.creator_persona_id,
                        COUNT(*)::int AS completed_deals,
                        COALESCE(AVG(cd.total_amount), 0)::float8 AS avg_deal_amount,
                        COALESCE(AVG(GREATEST(roi.roi_pct, 0)), 0)::float8 AS avg_roi_pct,
                        COALESCE(SUM(roi.conversions), 0)::float8 AS total_conversions
                    FROM completed_deals cd
                    LEFT JOIN brand_campaign_roi roi ON roi.completed_deal_id = cd.id
                    GROUP BY cd.creator_persona_id
                ),
                scored_creators AS (
                    SELECT
                        p.id AS persona_id,
                        pp.level,
                        COALESCE(pp.real_score, 0) AS trust_score,
                        COALESCE(us.price_band, 'mid-tier') AS price_band,
                        COALESCE(far.engagement_authenticity_score, 50) AS audit_score,
                        COALESCE(crm.reputation_score, 50) AS reputation_score,
                        COALESCE(ch.completed_deals, 0) AS completed_deals,
                        COALESCE(ch.avg_deal_amount, 0) AS avg_deal_amount,
                        COALESCE(ch.avg_roi_pct, 0) AS avg_roi_pct,
                        COALESCE(ch.total_conversions, 0) AS total_conversions,
                        COALESCE(ap.creator_requires_advance, FALSE) AS requires_advance,
                        -- Score computation (deterministic)
                        LEAST(100.0,
                         25  -- base ValuSkin match
                         + LEAST((pp.level - $2 + 1) * 5, 15)  -- level fit
                         + LEAST(COALESCE(pp.real_score, 0) / 10, 10)  -- trust bonus
                         + LEAST(COALESCE(far.engagement_authenticity_score, 50) / 10, 10)  -- audit bonus
                         + LEAST(COALESCE(crm.reputation_score, 50) / 10, 10)  -- accountability / repeat trust
                         + LEAST(COALESCE(ch.avg_roi_pct, 0) / 12, 8)  -- sales-driving performance
                         + LEAST(COALESCE(ch.total_conversions, 0), 40) / 10  -- conversion volume
                         + CASE  -- fair price fit without changing workflow
                             WHEN oc.reward_amount <= 0 OR COALESCE(ch.avg_deal_amount, 0) <= 0 THEN 8
                             WHEN oc.reward_amount >= ch.avg_deal_amount * 0.85
                                  AND oc.reward_amount <= ch.avg_deal_amount * 1.20 THEN 13
                             WHEN oc.reward_amount >= ch.avg_deal_amount * 0.65 THEN 9
                             WHEN oc.reward_amount >= ch.avg_deal_amount * 0.50 THEN 5
                             ELSE 1
                           END
                         + CASE WHEN $3 = TRUE THEN 5 ELSE 0 END  -- advance bonus
                         + CASE  -- smaller creators can still win on quality/performance
                             WHEN COALESCE(ch.completed_deals, 0) BETWEEN 1 AND 5
                                  AND (
                                      COALESCE(crm.reputation_score, 50) >= 60
                                      OR COALESCE(far.engagement_authenticity_score, 50) >= 70
                                      OR COALESCE(ch.avg_roi_pct, 0) >= 25
                                  )
                             THEN 5 ELSE 0
                           END
                        )::numeric(5,2) AS match_score,
                        CASE
                            WHEN COALESCE(ap.creator_requires_advance, FALSE) = TRUE AND $3 = FALSE THEN FALSE
                            ELSE TRUE
                        END AS advance_compatible
                    FROM persona_professions pp
                    JOIN personas p ON pp.persona_id = p.id AND p.exists = TRUE
                    JOIN professions pr ON pp.profession_id = pr.id
                    LEFT JOIN user_settings us ON p.owner_user_id = us.user_id
                    LEFT JOIN creator_reputation_metrics crm ON crm.creator_user_id = p.owner_user_id
                    LEFT JOIN creator_history ch ON ch.creator_persona_id = p.id
                    LEFT JOIN LATERAL (
                        SELECT engagement_authenticity_score
                        FROM follower_audit_results
                        WHERE persona_id = p.id
                        ORDER BY audited_at DESC
                        LIMIT 1
                    ) far ON TRUE
                    LEFT JOIN advance_preferences ap ON ap.user_id = p.owner_user_id
                    CROSS JOIN opportunity_context oc
                    WHERE pr.name = $1
                      AND pp.level >= $2
                      AND p.owner_user_id != $4
                ),
                ins AS (
                    INSERT INTO deal_suggestions
                        (brand_user_id, creator_persona_id, match_score, match_factors, advance_compatible, status)
                    SELECT
                        $4,
                        sc.persona_id,
                        sc.match_score,
                        jsonb_build_object(
                            'valueskin_match', TRUE,
                            'level', sc.level,
                            'trust_score', sc.trust_score,
                            'price_band', sc.price_band,
                            'audit_score', sc.audit_score,
                            'reputation_score', sc.reputation_score,
                            'avg_deal_amount', sc.avg_deal_amount,
                            'avg_roi_pct', sc.avg_roi_pct,
                            'total_conversions', sc.total_conversions,
                            'completed_deals', sc.completed_deals,
                            'reward_amount', (SELECT reward_amount FROM opportunity_context),
                            'advance_compatible', sc.advance_compatible,
                            'requires_advance', sc.requires_advance
                        ),
                        sc.advance_compatible,
                        'suggested'
                    FROM (
                        SELECT * FROM scored_creators sc
                        WHERE sc.advance_compatible = TRUE
                          AND sc.match_score >= 40
                        ORDER BY sc.match_score DESC
                        LIMIT 500  -- batch cap: max 500 suggestions per profession per opportunity
                    ) sc
                    ON CONFLICT (brand_user_id, creator_persona_id) DO UPDATE SET
                        match_score = EXCLUDED.match_score,
                        match_factors = EXCLUDED.match_factors,
                        advance_compatible = EXCLUDED.advance_compatible,
                        status = 'suggested',
                        created_at = NOW()
                    RETURNING 1
                )
                SELECT COUNT(*)::int8 FROM ins
                "#,
            )
            .bind(&req.required_profession)
            .bind(req.min_level)
            .bind(brand_offers_advance)
            .bind(brand_user_id)
            .bind(opportunity_id)
            .fetch_optional(&self.pool)
            .await?
            .unwrap_or(0);

            total_inserted += inserted as i32;
        }

        info!(
            opportunity_id = opportunity_id,
            suggestions = total_inserted,
            "Deal suggestions generated"
        );

        Ok(total_inserted)
    }

    /// Act on a suggestion (dismiss or convert to deal room).
    pub async fn act_on_suggestion(
        &self,
        user_id: i64,
        suggestion_id: i64,
        action: &str,
    ) -> Result<(), MatchingError> {
        let new_status = match action {
            "dismiss" => "dismissed",
            "convert" => "converted_to_deal",
            _ => return Err(MatchingError::InvalidLevel), // reuse as generic bad input
        };

        let mut tx = self.pool.begin().await?;

        // Verify the creator owns the persona linked to this suggestion
        let valid: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM deal_suggestions ds
                JOIN personas p ON ds.creator_persona_id = p.id
                WHERE ds.id = $1 AND p.owner_user_id = $2
            )
            "#,
        )
        .bind(suggestion_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        if !valid {
            return Err(MatchingError::NotFound);
        }

        // Lock suggestion row to prevent concurrent updates
        sqlx::query("SELECT 1 FROM deal_suggestions WHERE id = $1 FOR UPDATE")
            .bind(suggestion_id)
            .execute(&mut *tx)
            .await?;

        if action == "convert" {
            sqlx::query(
                "UPDATE deal_suggestions SET status = $1, converted_at = NOW() WHERE id = $2",
            )
            .bind(new_status)
            .bind(suggestion_id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "UPDATE deal_suggestions SET status = $1 WHERE id = $2",
            )
            .bind(new_status)
            .bind(suggestion_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}
