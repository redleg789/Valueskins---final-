//! Marketplace Service Core Logic

use sqlx::PgPool;
use chrono::{DateTime, Utc, Duration};
use crate::models::{
    Opportunity, OpportunityResponse, OpportunityFilters,
    CreateOpportunityRequest, ApplyRequest,
    ApplicationResponse, Application, MarketplaceStats,
    DealRoom, OfferRound,
};
use crate::barter_service::BarterService;

const PLATFORM_FEE_PCT: f64 = 5.0;

pub struct MarketplaceService {
    pool: PgPool,
}

impl MarketplaceService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Lists opportunities with filters.
    /// Single multi-join query replaces N+1 enrich_opportunity loop.
    /// At 1B DAU: old approach = 120 queries per page load; new = 3 queries total.
    pub async fn list_opportunities(
        &self,
        filters: OpportunityFilters,
        persona_id: Option<i64>,
    ) -> Result<Vec<OpportunityResponse>, ServiceError> {
        let limit = filters.limit.unwrap_or(20).min(100);
        let offset = filters.offset.unwrap_or(0);

        // Single query: joins brands, professions, application counts, barter prefs
        #[derive(sqlx::FromRow)]
        struct OppRow {
            id: i64,
            brand_id: Option<i64>,
            brand_user_id: i64,
            title: String,
            description: Option<String>,
            category: String,
            required_profession_id: i64,
            required_level: i32,
            reward_amount: String,
            reward_currency: Option<String>,
            deadline: DateTime<Utc>,
            status: String,
            compensation_type: String,
            barter_description: Option<String>,
            created_at: DateTime<Utc>,
            gating_type: Option<String>,
            visibility_for_non_matching: Option<String>,
            access_message_for_blocked: Option<String>,
            brand_name: Option<String>,
            brand_logo_uri: Option<String>,
            brand_is_verified: Option<bool>,
            profession_name: Option<String>,
            application_count: Option<i64>,
            brand_willing_to_barter: Option<bool>,
        }

        let rows: Vec<OppRow> = sqlx::query_as::<_, OppRow>(
            r#"
            SELECT
                o.id, o.brand_id, o.brand_user_id, o.title, o.description, o.category,
                o.required_profession_id, o.required_level, o.reward_amount, o.reward_currency,
                o.deadline, o.status, o.compensation_type, o.barter_description, o.created_at,
                o.gating_type, o.visibility_for_non_matching, o.access_message_for_blocked,
                b.name as brand_name, b.logo_uri as brand_logo_uri, b.is_verified as brand_is_verified,
                pr.name as profession_name,
                ac.cnt as application_count,
                u.willing_to_barter as brand_willing_to_barter
            FROM opportunities o
            LEFT JOIN brands b ON b.id = o.brand_id
            LEFT JOIN professions pr ON pr.id = o.required_profession_id
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS cnt FROM opportunity_applications
                WHERE opportunity_id = o.id
            ) ac ON TRUE
            LEFT JOIN users u ON u.id = o.brand_user_id
            WHERE ($1::bigint IS NULL OR o.required_profession_id = $1)
              AND ($2::int IS NULL OR o.required_level >= $2)
              AND ($3::int IS NULL OR o.required_level <= $3)
              AND ($4::text IS NULL OR o.category = $4)
              AND ($5::text IS NULL OR o.status = $5)
              AND ($6::text IS NULL OR o.compensation_type = $6)
              AND ($7::bool IS NULL OR $7 = FALSE OR o.compensation_type IN ('barter', 'exposure'))
              AND ($8::bool IS NULL OR $8 = FALSE OR o.compensation_type NOT IN ('barter', 'exposure'))
              AND ($11::text IS NULL OR o.gating_type = $11)
              AND o.deadline > NOW()
            ORDER BY o.created_at DESC
            LIMIT $9 OFFSET $10
            "#
        )
        .bind(filters.profession_id)
        .bind(filters.min_level)
        .bind(filters.max_level)
        .bind(&filters.category)
        .bind(&filters.status)
        .bind(&filters.compensation_type)
        .bind(filters.barter_only)
        .bind(filters.exclude_barter)
        .bind(limit)
        .bind(offset)
        .bind(&filters.gating_type)
        .fetch_all(&self.pool)
        .await?;

        // Batch: applied set + user levels (2 queries instead of 2N)
        let mut applied_set = std::collections::HashSet::new();
        let mut user_levels = std::collections::HashMap::new();

        if let Some(pid) = persona_id {
            let opp_ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
            if !opp_ids.is_empty() {
                let applied: Vec<(i64,)> = sqlx::query_as(
                    "SELECT opportunity_id FROM opportunity_applications
                     WHERE persona_id = $1 AND opportunity_id = ANY($2)"
                )
                .bind(pid)
                .bind(&opp_ids)
                .fetch_all(&self.pool)
                .await?;
                for (oid,) in applied {
                    applied_set.insert(oid);
                }
            }

            let levels: Vec<(i64, i32)> = sqlx::query_as(
                "SELECT profession_id, level FROM persona_professions WHERE persona_id = $1"
            )
            .bind(pid)
            .fetch_all(&self.pool)
            .await?;
            for (prof_id, level) in levels {
                user_levels.insert(prof_id, level);
            }
        }

        let mut responses = Vec::new();
        for row in rows {
            let OppRow {
                id, title, description, category,
                required_profession_id, required_level, reward_amount, reward_currency,
                deadline, status, compensation_type, barter_description, created_at,
                gating_type, visibility_for_non_matching, access_message_for_blocked,
                brand_name, brand_logo_uri: brand_logo, brand_is_verified: brand_verified,
                profession_name, application_count: app_count, brand_willing_to_barter: brand_barter,
                ..
            } = row;

            // Inline gating (no per-row DB call)
            let (gating_decision, visibility_mode, access_message, gating_blocked) =
                if gating_type.is_some() {
                    if let Some(_pid) = persona_id {
                        let user_level = user_levels.get(&required_profession_id).copied();
                        let can_view = user_level.map(|l| l >= required_level).unwrap_or(false);
                        let decision = if can_view { "visible" } else { "blocked_no_profession" };
                        (Some(decision.to_string()), visibility_for_non_matching.clone(), access_message_for_blocked.clone(), !can_view)
                    } else {
                        let hidden = visibility_for_non_matching.as_deref() == Some("hidden");
                        (Some("blocked_no_auth".to_string()), visibility_for_non_matching.clone(), access_message_for_blocked.clone(), hidden)
                    }
                } else {
                    (None, None, None, false)
                };

            if visibility_mode.as_deref() == Some("hidden")
                && gating_decision.as_deref() != Some("visible")
            {
                continue;
            }

            let can_apply = if gating_blocked {
                false
            } else if persona_id.is_some() {
                !applied_set.contains(&id)
                    && user_levels.get(&required_profession_id)
                        .map(|l| *l >= required_level)
                        .unwrap_or(false)
            } else {
                false
            };

            responses.push(OpportunityResponse {
                id,
                brand_name,
                brand_logo,
                brand_verified: brand_verified.unwrap_or(false),
                title,
                description: description.unwrap_or_default(),
                category,
                required_profession_id,
                required_profession_name: profession_name.unwrap_or_else(|| "Unknown".to_string()),
                required_level,
                reward_amount,
                reward_currency: reward_currency.unwrap_or_else(|| "USD".to_string()),
                compensation_type,
                barter_description,
                deadline,
                status,
                application_count: app_count.unwrap_or(0) as i32,
                created_at,
                can_apply,
                creator_open_to_barter: brand_barter.unwrap_or(false),
                gating_type,
                visibility_mode,
                access_message,
                gating_decision,
            });
        }

        Ok(responses)
    }

    /// Gets a single opportunity by ID, enforcing campaign gating.
    /// Returns NotFound if the campaign is hidden from the requesting persona.
    pub async fn get_opportunity(
        &self,
        id: i64,
        persona_id: Option<i64>,
    ) -> Result<OpportunityResponse, ServiceError> {
        let opp = sqlx::query_as::<_, Opportunity>(
            "SELECT * FROM opportunities WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let enriched = self.enrich_opportunity(opp, persona_id).await?;

        // Enforce hidden gating: if campaign is 'hidden' and creator is gating_blocked,
        // return NotFound so non-matching creators get a 404 (opaque — they can't infer the campaign exists)
        if enriched.visibility_mode.as_deref() == Some("hidden")
            && enriched.gating_decision.as_deref() != Some("visible")
            && persona_id.is_some()
        {
            return Err(ServiceError::NotFound);
        }

        Ok(enriched)
    }

    async fn enrich_opportunity(
        &self,
        opp: Opportunity,
        persona_id: Option<i64>,
    ) -> Result<OpportunityResponse, ServiceError> {
        // Get brand info
        let brand_info: Option<(String, Option<String>, bool)> = if let Some(brand_id) = opp.brand_id {
            sqlx::query_as(
                "SELECT name, logo_uri, is_verified FROM brands WHERE id = $1"
            )
            .bind(brand_id)
            .fetch_optional(&self.pool)
            .await?
        } else {
            None
        };

        // Get profession name
        let profession_name: String = sqlx::query_scalar(
            "SELECT name FROM professions WHERE id = $1"
        )
        .bind(opp.required_profession_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_else(|| "Unknown".to_string());

        // Get application count
        let app_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = $1"
        )
        .bind(opp.id)
        .fetch_one(&self.pool)
        .await?;

        // ── Campaign Gating ─────────────────────────────────────────────
        // Call the PL/pgSQL function to evaluate gating. Returns JSONB:
        //   { can_view, reason, visibility_mode, gating_type }
        // If gating_type is NULL (no gating configured), defaults to visible.
        let (gating_decision, visibility_mode, access_message, gating_blocked) =
            if let (Some(pid), Some(_gtype)) = (persona_id, opp.gating_type.as_deref()) {
                let result: Option<serde_json::Value> = sqlx::query_scalar(
                    "SELECT can_view_opportunity($1, $2)"
                )
                .bind(pid)
                .bind(opp.id)
                .fetch_optional(&self.pool)
                .await
                .unwrap_or(None);

                if let Some(val) = result {
                    let can_view = val.get("can_view").and_then(|v| v.as_bool()).unwrap_or(true);
                    let reason = val.get("reason").and_then(|v| v.as_str()).map(String::from);
                    let vis = val.get("visibility_mode").and_then(|v| v.as_str()).map(String::from);
                    let decision = val.get("gating_type").and_then(|v| v.as_str()).map(String::from);

                    // Log gating decision for audit
                    let decision_str = if can_view { "visible" } else { "blocked_no_profession" };
                    let _ = sqlx::query(
                        "INSERT INTO campaign_gating_decisions (opportunity_id, persona_id, decision, reason, evaluated_at) \
                         VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING"
                    )
                    .bind(opp.id)
                    .bind(pid)
                    .bind(decision_str)
                    .bind(&reason)
                    .execute(&self.pool)
                    .await;

                    (decision, vis, reason, !can_view)
                } else {
                    (None, None, None, false)
                }
            } else if opp.gating_type.is_some() {
                // Unauthenticated user viewing a gated campaign.
                // Without a persona we cannot evaluate gating, so respect the
                // campaign's visibility_for_non_matching setting. If it's "hidden",
                // block entirely. Otherwise show with a blocked marker so the
                // client displays the access_message.
                let hidden = opp.visibility_for_non_matching.as_deref() == Some("hidden");
                (
                    Some("blocked_no_auth".to_string()),
                    opp.visibility_for_non_matching.clone(),
                    opp.access_message_for_blocked.clone(),
                    hidden, // gating_blocked = true for hidden campaigns
                )
            } else {
                // No gating configured — open to everyone
                (None, None, None, false)
            };

        // Check if user can apply (also gated by campaign gating check)
        let can_apply = if gating_blocked {
            false
        } else if let Some(pid) = persona_id {
            let already_applied: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM opportunity_applications WHERE opportunity_id = $1 AND persona_id = $2)"
            )
            .bind(opp.id)
            .bind(pid)
            .fetch_one(&self.pool)
            .await?;

            if already_applied {
                false
            } else {
                let user_level: Option<i32> = sqlx::query_scalar(
                    "SELECT level FROM persona_professions WHERE persona_id = $1 AND profession_id = $2"
                )
                .bind(pid)
                .bind(opp.required_profession_id)
                .fetch_optional(&self.pool)
                .await?;

                user_level.map(|l| l >= opp.required_level).unwrap_or(false)
            }
        } else {
            false
        };

        // Check if the brand user is open to barter
        let creator_open_to_barter: bool = sqlx::query_scalar(
            "SELECT COALESCE(willing_to_barter, FALSE) FROM users WHERE id = $1"
        )
        .bind(opp.brand_user_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or(false);

        Ok(OpportunityResponse {
            id: opp.id,
            brand_name: brand_info.as_ref().map(|b| b.0.clone()),
            brand_logo: brand_info.as_ref().and_then(|b| b.1.clone()),
            brand_verified: brand_info.as_ref().map(|b| b.2).unwrap_or(false),
            title: opp.title,
            description: opp.description.unwrap_or_default(),
            category: opp.category,
            required_profession_id: opp.required_profession_id,
            required_profession_name: profession_name,
            required_level: opp.required_level,
            reward_amount: opp.reward_amount,
            reward_currency: opp.reward_currency.unwrap_or_else(|| "USD".to_string()),
            compensation_type: opp.compensation_type,
            barter_description: opp.barter_description,
            deadline: opp.deadline,
            status: opp.status,
            application_count: app_count as i32,
            created_at: opp.created_at,
            can_apply,
            creator_open_to_barter,
            gating_type: opp.gating_type,
            visibility_mode,
            access_message,
            gating_decision,
        })
    }

    /// Creates a new opportunity (brand-only)
    pub async fn create_opportunity(
        &self,
        brand_id: Option<i64>,
        brand_user_id: i64,
        req: CreateOpportunityRequest,
    ) -> Result<i64, ServiceError> {
        // ── Brand Verification Gate ───────────────────────────────────────
        // Brands must be verified before posting opportunities.
        // This is non-negotiable: unverified brands burn trust immediately.
        let is_verified: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM brand_verifications WHERE brand_user_id = $1 AND status = 'verified')"
        )
        .bind(brand_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_verified {
            return Err(ServiceError::Database(sqlx::Error::RowNotFound))
                .map_err(|_| ServiceError::BarterViolation(
                    "Brand must be verified before posting opportunities. Submit verification at /brands/verify".to_string()
                ));
        }

        let comp_type = req.compensation_type.as_deref().unwrap_or("paid");

        // Validate compensation type + barter description + reward_amount consistency
        BarterService::validate_compensation(comp_type, &req.barter_description, &req.reward_amount)
            .map_err(|e| ServiceError::BarterViolation(format!("{:?}", e)))?;

        let deadline = Utc::now() + Duration::days(req.duration_days as i64);

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO opportunities
            (brand_id, brand_user_id, title, description, category, required_profession_id,
             required_level, reward_amount, reward_currency, deadline, status,
             compensation_type, barter_description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11, $12)
            RETURNING id
            "#
        )
        .bind(brand_id)
        .bind(brand_user_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&req.category)
        .bind(req.required_profession_id)
        .bind(req.required_level)
        .bind(&req.reward_amount)
        .bind(&req.reward_currency)
        .bind(deadline)
        .bind(comp_type)
        .bind(&req.barter_description)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    /// Applies to an opportunity (creator-only)
    ///
    /// Rate limits:
    ///   - Per user: 50 applications/day (prevents mass spam from bot accounts)
    ///   - Per opportunity: 10,000 total (prevents single opp from drowning DB)
    pub async fn apply(
        &self,
        persona_id: i64,
        applicant_user_id: i64,
        req: ApplyRequest,
    ) -> Result<i64, ServiceError> {
        // ── Per-user daily rate limit ─────────────────────────────────
        let daily_count: i64 = sqlx::query_scalar(
            "SELECT COALESCE(
                (SELECT application_count FROM application_rate_limits
                 WHERE user_id = $1 AND window_start = DATE_TRUNC('day', NOW())),
                0
            )"
        )
        .bind(applicant_user_id)
        .fetch_one(&self.pool)
        .await?;

        if daily_count >= 50 {
            return Err(ServiceError::RateLimited(
                "Maximum 50 applications per day".to_string()
            ));
        }

        let opp = sqlx::query_as::<_, Opportunity>(
            "SELECT * FROM opportunities WHERE id = $1"
        )
        .bind(req.opportunity_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        if opp.status != "open" {
            return Err(ServiceError::OpportunityClosed);
        }

        if opp.deadline < Utc::now() {
            return Err(ServiceError::OpportunityExpired);
        }

        // ── Campaign gating enforcement ─────────────────────────────────
        // Server-side: check can_view_opportunity() before allowing application.
        // This prevents clients from bypassing UI gating.
        if opp.gating_type.is_some() {
            let gating_result: Option<serde_json::Value> = sqlx::query_scalar(
                "SELECT can_view_opportunity($1, $2)"
            )
            .bind(persona_id)
            .bind(opp.id)
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None);

            if let Some(val) = gating_result {
                let can_view = val.get("can_view").and_then(|v| v.as_bool()).unwrap_or(true);
                if !can_view {
                    let reason = val.get("reason")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Campaign gating requirements not met")
                        .to_string();
                    return Err(ServiceError::GatingBlocked(reason));
                }
            }
        }

        // Check user has required profession and level
        let user_level: Option<i32> = sqlx::query_scalar(
            "SELECT level FROM persona_professions WHERE persona_id = $1 AND profession_id = $2"
        )
        .bind(persona_id)
        .bind(opp.required_profession_id)
        .fetch_optional(&self.pool)
        .await?;

        let level = user_level.ok_or(ServiceError::InsufficientLevel)?;
        if level < opp.required_level {
            return Err(ServiceError::InsufficientLevel);
        }

        // If barter/exposure opportunity, creator must have opted in
        let barter_svc = BarterService::new(self.pool.clone());
        barter_svc.check_creator_barter_eligibility(applicant_user_id, &opp.compensation_type)
            .await
            .map_err(|e| ServiceError::BarterViolation(format!("{:?}", e)))?;

        // Check not already applied
        let existing: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM opportunity_applications WHERE opportunity_id = $1 AND persona_id = $2)"
        )
        .bind(req.opportunity_id)
        .bind(persona_id)
        .fetch_one(&self.pool)
        .await?;

        if existing {
            return Err(ServiceError::AlreadyApplied);
        }

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO opportunity_applications
            (opportunity_id, persona_id, applicant_user_id, pitch, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING id
            "#
        )
        .bind(req.opportunity_id)
        .bind(persona_id)
        .bind(applicant_user_id)
        .bind(&req.pitch)
        .fetch_one(&self.pool)
        .await?;

        // ── Increment rate limit counters (fire-and-forget) ───────────
        let _ = sqlx::query(
            "INSERT INTO application_rate_limits (user_id, window_start, application_count)
             VALUES ($1, DATE_TRUNC('day', NOW()), 1)
             ON CONFLICT (user_id, window_start) DO UPDATE SET
               application_count = application_rate_limits.application_count + 1"
        )
        .bind(applicant_user_id)
        .execute(&self.pool)
        .await;

        Ok(id)
    }

    /// Gets applications for an opportunity (for brands)
    pub async fn get_opportunity_applications(
        &self,
        opportunity_id: i64,
    ) -> Result<Vec<ApplicationResponse>, ServiceError> {
        let apps = sqlx::query_as::<_, Application>(
            "SELECT * FROM opportunity_applications WHERE opportunity_id = $1 ORDER BY created_at DESC"
        )
        .bind(opportunity_id)
        .fetch_all(&self.pool)
        .await?;

        let opp_title: String = sqlx::query_scalar(
            "SELECT title FROM opportunities WHERE id = $1"
        )
        .bind(opportunity_id)
        .fetch_one(&self.pool)
        .await?;

        let mut responses = Vec::new();
        for app in apps {
            let (name, level): (String, i32) = sqlx::query_as(
                r#"
                SELECT p.display_name, COALESCE(pp.level, 1)
                FROM personas p
                LEFT JOIN persona_professions pp ON p.id = pp.persona_id
                    AND pp.profession_id = (SELECT required_profession_id FROM opportunities WHERE id = $1)
                WHERE p.id = $2
                "#
            )
            .bind(opportunity_id)
            .bind(app.persona_id)
            .fetch_one(&self.pool)
            .await?;

            responses.push(ApplicationResponse {
                id: app.id,
                opportunity_id: app.opportunity_id,
                opportunity_title: opp_title.clone(),
                persona_id: app.persona_id,
                persona_name: name.clone(),
                username: name,
                persona_level: level,
                pitch: app.pitch.unwrap_or_default(),
                status: app.status,
                created_at: app.created_at,
            });
        }

        Ok(responses)
    }

    /// Accepts an application — atomic transaction with race-condition guard.
    ///
    /// Edge case: two brand employees click "accept" on different applicants
    /// at the same instant. Without the WHERE status = 'open' guard, both
    /// UPDATEs would succeed, leaving the opportunity with two "accepted"
    /// applications and an inconsistent selected_persona_id.
    ///
    /// The fix: only transition open -> filled atomically. If rows_affected == 0,
    /// another request already filled this opportunity.
    pub async fn accept_application(
        &self,
        opportunity_id: i64,
        persona_id: i64,
    ) -> Result<(), ServiceError> {
        let mut tx = self.pool.begin().await?;

        // Atomic guard: only the first concurrent accept wins.
        // SELECT FOR UPDATE locks the row, preventing a second transaction
        // from reading stale status='open' while the first is in-flight.
        let rows = sqlx::query(
            "UPDATE opportunities SET status = 'filled', selected_persona_id = $1, updated_at = NOW() \
             WHERE id = $2 AND status = 'open'"
        )
        .bind(persona_id)
        .bind(opportunity_id)
        .execute(&mut *tx)
        .await?;

        if rows.rows_affected() == 0 {
            tx.rollback().await?;
            return Err(ServiceError::OpportunityClosed);
        }

        sqlx::query(
            "UPDATE opportunity_applications SET status = 'accepted', updated_at = NOW() \
             WHERE opportunity_id = $1 AND persona_id = $2 AND status = 'pending'"
        )
        .bind(opportunity_id)
        .bind(persona_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE opportunity_applications SET status = 'rejected', updated_at = NOW() \
             WHERE opportunity_id = $1 AND persona_id != $2 AND status = 'pending'"
        )
        .bind(opportunity_id)
        .bind(persona_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }

    /// Completes a deal and records revenue — atomic + idempotent
    pub async fn complete_deal(
        &self,
        opportunity_id: i64,
    ) -> Result<(), ServiceError> {
        let opp = sqlx::query_as::<_, Opportunity>(
            "SELECT * FROM opportunities WHERE id = $1"
        )
        .bind(opportunity_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        // Idempotency: already completed is a no-op success
        if opp.status == "completed" {
            return Ok(());
        }

        if opp.status != "filled" {
            return Err(ServiceError::InvalidStatus);
        }

        let creator_persona_id = opp.selected_persona_id.ok_or(ServiceError::NoCreatorSelected)?;

        let creator_user_id: i64 = sqlx::query_scalar(
            "SELECT user_id FROM personas WHERE id = $1"
        )
        .bind(creator_persona_id)
        .fetch_one(&self.pool)
        .await?;

        let total: f64 = opp.reward_amount.parse().unwrap_or(0.0);
        let (creator_payout, platform_fee, effective_pct) =
            BarterService::calculate_platform_fee(&opp.compensation_type, total, PLATFORM_FEE_PCT);

        let mut tx = self.pool.begin().await?;

        // Guard: only transition filled -> completed atomically
        let rows = sqlx::query(
            "UPDATE opportunities SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status = 'filled'"
        )
        .bind(opportunity_id)
        .execute(&mut *tx)
        .await?;

        if rows.rows_affected() == 0 {
            // Another request already completed this deal
            tx.rollback().await?;
            return Ok(());
        }

        sqlx::query(
            r#"
            INSERT INTO completed_deals
            (opportunity_id, brand_id, brand_user_id, creator_persona_id, creator_user_id,
             total_amount, creator_payout, platform_fee, platform_fee_percentage, compensation_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#
        )
        .bind(opportunity_id)
        .bind(opp.brand_id)
        .bind(opp.brand_user_id)
        .bind(creator_persona_id)
        .bind(creator_user_id)
        .bind(total)
        .bind(creator_payout)
        .bind(platform_fee)
        .bind(effective_pct)
        .bind(&opp.compensation_type)
        .execute(&mut *tx)
        .await?;

        // ── Publish event to outbox (inside same transaction) ──────────
        // Downstream handlers (reputation refresh, fraud scan, notifications,
        // analytics) are decoupled via the transactional outbox pattern.
        // A background worker polls event_outbox and dispatches async.
        let event_payload = serde_json::json!({
            "opportunity_id": opportunity_id,
            "brand_user_id": opp.brand_user_id,
            "creator_user_id": creator_user_id,
            "creator_persona_id": creator_persona_id,
            "total_amount": total,
            "creator_payout": creator_payout,
            "platform_fee": platform_fee,
            "compensation_type": opp.compensation_type,
        });

        sqlx::query(
            "INSERT INTO event_outbox (aggregate_type, aggregate_id, event_type, payload)
             VALUES ('deal', $1, 'deal.completed', $2)"
        )
        .bind(opportunity_id)
        .bind(&event_payload)
        .execute(&mut *tx)
        .await?;

        // Flag creator reputation for refresh (picked up by batch worker)
        sqlx::query(
            "UPDATE creator_reputation_metrics SET needs_refresh = TRUE WHERE creator_user_id = $1"
        )
        .bind(creator_user_id)
        .execute(&mut *tx)
        .await
        .ok(); // Non-critical — don't fail the deal

        tx.commit().await?;

        Ok(())
    }

    /// Gets marketplace stats
    pub async fn get_stats(&self) -> Result<MarketplaceStats, ServiceError> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM opportunities")
            .fetch_one(&self.pool)
            .await?;

        let active: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM opportunities WHERE status = 'open' AND deadline > NOW()"
        )
        .fetch_one(&self.pool)
        .await?;

        let completed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM completed_deals")
            .fetch_one(&self.pool)
            .await?;

        let volume: String = sqlx::query_scalar(
            "SELECT COALESCE(SUM(total_amount), 0)::text FROM completed_deals"
        )
        .fetch_one(&self.pool)
        .await?;

        let revenue: String = sqlx::query_scalar(
            "SELECT COALESCE(SUM(platform_fee), 0)::text FROM completed_deals"
        )
        .fetch_one(&self.pool)
        .await?;

        let avg: String = if completed > 0 {
            sqlx::query_scalar(
                "SELECT COALESCE(AVG(total_amount), 0)::text FROM completed_deals"
            )
            .fetch_one(&self.pool)
            .await?
        } else {
            "0".to_string()
        };

        Ok(MarketplaceStats {
            total_opportunities: total,
            active_opportunities: active,
            completed_deals: completed,
            total_volume: volume,
            total_platform_revenue: revenue,
            avg_deal_size: avg,
        })
    }
}

#[derive(Debug)]
pub enum ServiceError {
    NotFound,
    OpportunityClosed,
    OpportunityExpired,
    InsufficientLevel,
    AlreadyApplied,
    InvalidStatus,
    NoCreatorSelected,
    // Campaign gating errors
    GatingBlocked(String),
    // Barter errors
    BarterViolation(String),
    // Deal room errors
    DealRoomClosed,
    CreatorInQuietMode,
    CreatorAlreadyHeld,
    OfferBelowFloor,
    AlreadyResponded,
    /// Per-user or per-resource rate limit exceeded
    RateLimited(String),
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self {
        ServiceError::Database(e)
    }
}

// ══════════════════════════════════════════════════════════════════════
// Deal Room Service
// All negotiation, trust, escrow, and deal-lifecycle business logic.
// ══════════════════════════════════════════════════════════════════════

pub struct DealRoomService {
    pool: PgPool,
}

impl DealRoomService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── Discovery throttle ─────────────────────────────────────────

    /// Returns true if the brand may view this creator's profile.
    /// New brands are limited to 20 scans/week; every scan is logged.
    pub async fn check_and_record_scan(
        &self,
        brand_user_id: i64,
        persona_id: i64,
    ) -> Result<bool, ServiceError> {
        let scans_this_week: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM discovery_scans
            WHERE brand_user_id = $1
              AND scanned_at >= DATE_TRUNC('week', NOW())
            "#
        )
        .bind(brand_user_id)
        .fetch_one(&self.pool)
        .await?;

        let completed_deals: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM completed_deals WHERE brand_user_id = $1"
        )
        .bind(brand_user_id)
        .fetch_one(&self.pool)
        .await?;

        // Unlock deeper quota based on past completed deals
        let weekly_limit: i64 = match completed_deals {
            0 => 20,
            1..=5 => 50,
            _ => 200,
        };

        if scans_this_week >= weekly_limit {
            return Ok(false);
        }

        sqlx::query(
            "INSERT INTO discovery_scans (brand_user_id, persona_id) VALUES ($1, $2)"
        )
        .bind(brand_user_id)
        .bind(persona_id)
        .execute(&self.pool)
        .await?;

        Ok(true)
    }

    // ── Price bands ────────────────────────────────────────────────

    /// Creator sets their public band + exact floor/ceiling (exact is private).
    pub async fn set_price_band(
        &self,
        persona_id: i64,
        req: crate::models::SetPriceBandRequest,
    ) -> Result<(), ServiceError> {
        // Validate band label
        if !["experimental", "mid-tier", "premium", "exclusive"].contains(&req.band_label.as_str()) {
            return Err(ServiceError::BarterViolation(
                "band_label must be 'experimental', 'mid-tier', 'premium', or 'exclusive'".to_string()
            ));
        }

        // Validate floor <= ceiling (inverted range = broken pricing)
        if req.exact_floor_cents > req.exact_ceiling_cents {
            return Err(ServiceError::BarterViolation(
                format!("Floor ({}) cannot exceed ceiling ({})", req.exact_floor_cents, req.exact_ceiling_cents)
            ));
        }

        // Validate non-negative
        if req.exact_floor_cents < 0 {
            return Err(ServiceError::BarterViolation(
                "Floor cents cannot be negative".to_string()
            ));
        }

        let currency = req.currency.unwrap_or_else(|| "USD".to_string());
        sqlx::query(
            r#"
            INSERT INTO creator_price_bands
                (persona_id, profession_id, band_label, exact_floor_cents, exact_ceiling_cents, currency)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (persona_id, profession_id) DO UPDATE SET
                band_label          = EXCLUDED.band_label,
                exact_floor_cents   = EXCLUDED.exact_floor_cents,
                exact_ceiling_cents = EXCLUDED.exact_ceiling_cents,
                currency            = EXCLUDED.currency,
                updated_at          = NOW()
            "#
        )
        .bind(persona_id)
        .bind(req.profession_id)
        .bind(&req.band_label)
        .bind(req.exact_floor_cents)
        .bind(req.exact_ceiling_cents)
        .bind(currency)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Returns only the public band label for a creator's profession — no exact numbers.
    pub async fn get_price_band_public(
        &self,
        persona_id: i64,
        profession_id: i64,
    ) -> Result<Option<crate::models::PriceBandPublic>, ServiceError> {
        let row = sqlx::query_as::<_, crate::models::PriceBandPublic>(
            "SELECT persona_id, profession_id, band_label FROM creator_price_bands WHERE persona_id = $1 AND profession_id = $2"
        )
        .bind(persona_id)
        .bind(profession_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    // ── Deal rooms ─────────────────────────────────────────────────

    /// Brand opens a deal room. Requires a filled campaign brief.
    pub async fn open_deal_room(
        &self,
        brand_user_id: i64,
        req: crate::models::OpenDealRoomRequest,
    ) -> Result<i64, ServiceError> {
        // Validate intent enum at boundary
        if !["explore", "campaign", "long-term"].contains(&req.intent.as_str()) {
            return Err(ServiceError::BarterViolation(
                "intent must be 'explore', 'campaign', or 'long-term'".to_string()
            ));
        }

        // Validate compensation_type at boundary
        let comp_type = req.compensation_type.as_deref().unwrap_or("paid");
        if !crate::models::VALID_COMPENSATION_TYPES.contains(&comp_type) {
            return Err(ServiceError::BarterViolation(
                format!("Invalid compensation_type: {}", comp_type)
            ));
        }

        // Self-dealing prevention: brand cannot open a deal room with their own persona
        let creator_owner: Option<i64> = sqlx::query_scalar(
            "SELECT owner_user_id FROM personas WHERE id = $1"
        )
        .bind(req.creator_persona_id)
        .fetch_optional(&self.pool)
        .await?;

        if creator_owner == Some(brand_user_id) {
            return Err(ServiceError::BarterViolation(
                "Cannot open a deal room with your own persona".to_string()
            ));
        }

        // Check quiet mode: creator cannot be contacted if they're already in an active negotiation
        // and have quiet_mode set in their active room.
        let in_quiet: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM deal_rooms
                WHERE creator_persona_id = $1
                  AND status = 'active'
                  AND quiet_mode = TRUE
            )
            "#
        )
        .bind(req.creator_persona_id)
        .fetch_one(&self.pool)
        .await?;

        if in_quiet {
            return Err(ServiceError::CreatorInQuietMode);
        }

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO deal_rooms
                (opportunity_id, brand_user_id, creator_persona_id, intent,
                 brief_title, brief_description, brief_deliverables,
                 brief_deadline, brief_campaign_type, compensation_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
            "#
        )
        .bind(req.opportunity_id)
        .bind(brand_user_id)
        .bind(req.creator_persona_id)
        .bind(&req.intent)
        .bind(&req.brief_title)
        .bind(&req.brief_description)
        .bind(&req.brief_deliverables)
        .bind(req.brief_deadline)
        .bind(&req.brief_campaign_type)
        .bind(comp_type)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    /// List all deal rooms for a user (creator or brand).
    pub async fn list_deal_rooms(
        &self,
        user_id: i64,
        persona_id: Option<i64>,
    ) -> Result<Vec<crate::models::DealRoomSummary>, ServiceError> {
        let rooms = sqlx::query_as::<_, DealRoom>(
            r#"
            SELECT * FROM deal_rooms
            WHERE brand_user_id = $1 OR creator_persona_id = $2
            ORDER BY last_action_at DESC
            LIMIT 50
            "#
        )
        .bind(user_id)
        .bind(persona_id.unwrap_or(-1))
        .fetch_all(&self.pool)
        .await?;

        let mut summaries = Vec::new();
        for room in rooms {
            let offer_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM offer_rounds WHERE deal_room_id = $1"
            )
            .bind(room.id)
            .fetch_one(&self.pool)
            .await?;

            let latest_amount: Option<i64> = sqlx::query_scalar(
                "SELECT amount_cents FROM offer_rounds WHERE deal_room_id = $1 ORDER BY created_at DESC LIMIT 1"
            )
            .bind(room.id)
            .fetch_optional(&self.pool)
            .await?;

            // Negotiation memory: suggest fair range from past deals between same parties
            let (suggested_floor, suggested_ceiling) = self
                .get_suggested_range(room.brand_user_id, room.creator_persona_id)
                .await
                .unwrap_or((None, None));

            // Public price band for creator (if set)
            let band_label: Option<String> = sqlx::query_scalar(
                "SELECT band_label FROM creator_price_bands WHERE persona_id = $1 LIMIT 1"
            )
            .bind(room.creator_persona_id)
            .fetch_optional(&self.pool)
            .await?;

            // Active soft hold?
            let has_hold: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM soft_holds WHERE deal_room_id = $1 AND status = 'active' AND expires_at > NOW())"
            )
            .bind(room.id)
            .fetch_one(&self.pool)
            .await?;

            // Opportunity title (if linked)
            let opp_title: Option<String> = if let Some(oid) = room.opportunity_id {
                sqlx::query_scalar("SELECT title FROM opportunities WHERE id = $1")
                    .bind(oid)
                    .fetch_optional(&self.pool)
                    .await?
            } else {
                None
            };

            // Creator display name
            let creator_name: String = sqlx::query_scalar(
                "SELECT COALESCE(display_name, username, 'Creator') FROM personas WHERE id = $1"
            )
            .bind(room.creator_persona_id)
            .fetch_optional(&self.pool)
            .await?
            .unwrap_or_else(|| format!("creator_{}", room.creator_persona_id));

            // Brand display name (from brand persona linked to brand_user_id)
            let brand_name: String = sqlx::query_scalar(
                "SELECT COALESCE(display_name, username, 'Brand') FROM personas WHERE owner_user_id = $1 AND role = 'brand' LIMIT 1"
            )
            .bind(room.brand_user_id)
            .fetch_optional(&self.pool)
            .await?
            .unwrap_or_else(|| format!("brand_{}", room.brand_user_id));

            // Brand persona id
            let brand_persona_id: i64 = sqlx::query_scalar(
                "SELECT id FROM personas WHERE owner_user_id = $1 AND role = 'brand' LIMIT 1"
            )
            .bind(room.brand_user_id)
            .fetch_optional(&self.pool)
            .await?
            .unwrap_or(0);

            // Last message in deal room
            let last_msg: Option<(String, DateTime<Utc>)> = sqlx::query_as(
                "SELECT content, server_timestamp FROM deal_room_messages WHERE deal_room_id = $1 ORDER BY server_timestamp DESC LIMIT 1"
            )
            .bind(room.id)
            .fetch_optional(&self.pool)
            .await?;

            let (last_message, last_message_at) = match last_msg {
                Some((msg, ts)) => (Some(msg), Some(ts)),
                None => (None, None),
            };

            // Unread count for current user (messages not from this user since last_action_at)
            let unread_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM deal_room_messages WHERE deal_room_id = $1 AND sender_user_id != $2 AND server_timestamp > $3"
            )
            .bind(room.id)
            .bind(user_id)
            .bind(room.last_action_at)
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

            summaries.push(crate::models::DealRoomSummary {
                id: room.id,
                opportunity_id: room.opportunity_id,
                opportunity_title: opp_title.or(room.brief_title.clone()),
                creator_persona_id: room.creator_persona_id,
                creator_name,
                brand_persona_id,
                brand_name,
                intent: room.intent,
                status: room.status,
                brief_title: room.brief_title,
                brief_campaign_type: room.brief_campaign_type,
                expires_at: room.expires_at,
                last_action_at: room.last_action_at,
                created_at: room.created_at,
                offer_count,
                latest_amount_cents: latest_amount,
                last_message,
                last_message_at,
                unread_count,
                suggested_floor_cents: suggested_floor,
                suggested_ceiling_cents: suggested_ceiling,
                creator_price_band: band_label,
                has_active_soft_hold: has_hold,
            });
        }

        Ok(summaries)
    }

    /// Get suggested price range for a brand×creator pair from negotiation memory.
    async fn get_suggested_range(
        &self,
        brand_user_id: i64,
        creator_persona_id: i64,
    ) -> Result<(Option<i64>, Option<i64>), ServiceError> {
        let row: Option<(i64, i64)> = sqlx::query_as(
            r#"
            SELECT MIN(agreed_amount_cents), MAX(agreed_amount_cents)
            FROM negotiation_memory
            WHERE brand_user_id = $1 AND creator_persona_id = $2
            "#
        )
        .bind(brand_user_id)
        .bind(creator_persona_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((min, max)) if min > 0 => Ok((Some(min), Some(max))),
            _ => Ok((None, None)),
        }
    }

    // ── Offer rounds ───────────────────────────────────────────────

    /// Make an offer inside a deal room (creator or brand).
    pub async fn make_offer(
        &self,
        deal_room_id: i64,
        made_by: &str,     // "brand" | "creator"
        user_id: i64,
        persona_id: Option<i64>,
        req: crate::models::MakeOfferRequest,
    ) -> Result<i64, ServiceError> {
        // Verify room exists and is active
        let room: Option<DealRoom> = sqlx::query_as(
            "SELECT * FROM deal_rooms WHERE id = $1"
        )
        .bind(deal_room_id)
        .fetch_optional(&self.pool)
        .await?;

        let room = room.ok_or(ServiceError::NotFound)?;
        if room.status != "active" {
            return Err(ServiceError::DealRoomClosed);
        }

        // Validate offer amount is positive
        if req.amount_cents <= 0 {
            return Err(ServiceError::BarterViolation(
                "Offer amount must be positive".to_string()
            ));
        }

        // Validate response_hours range (prevent absurd values and SQL injection
        // via string interpolation in the INTERVAL cast)
        let response_hours = req.response_hours.unwrap_or(24);
        if response_hours < 1 || response_hours > 168 {
            return Err(ServiceError::BarterViolation(
                "response_hours must be between 1 and 168 (1 week)".to_string()
            ));
        }

        // Enforce auto-escalation: if brand is offering below creator's floor, block
        if made_by == "brand" {
            let rule: Option<(i64, i32, i32)> = sqlx::query_as(
                r#"
                SELECT floor_cents, lowball_threshold, 0
                FROM auto_escalation_rules
                WHERE creator_persona_id = $1 AND active = TRUE
                  AND (profession_id IS NULL OR profession_id = (
                      SELECT pp.profession_id FROM persona_professions pp
                      JOIN deal_rooms dr ON dr.id = $2
                      WHERE pp.persona_id = dr.creator_persona_id
                      LIMIT 1
                  ))
                LIMIT 1
                "#
            )
            .bind(room.creator_persona_id)
            .bind(deal_room_id)
            .fetch_optional(&self.pool)
            .await?;

            if let Some((floor_cents, threshold, _)) = rule {
                if req.amount_cents < floor_cents {
                    // Increment lowball count; block if threshold exceeded
                    let new_count: i32 = sqlx::query_scalar(
                        r#"
                        INSERT INTO lowball_counts (brand_user_id, creator_persona_id, count)
                        VALUES ($1, $2, 1)
                        ON CONFLICT (brand_user_id, creator_persona_id) DO UPDATE
                        SET count = lowball_counts.count + 1, last_lowball_at = NOW()
                        RETURNING count
                        "#
                    )
                    .bind(user_id)
                    .bind(room.creator_persona_id)
                    .fetch_one(&self.pool)
                    .await?;

                    if new_count >= threshold {
                        return Err(ServiceError::OfferBelowFloor);
                    }
                }
            }
        }

        let currency = req.currency.unwrap_or_else(|| "USD".to_string());

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO offer_rounds
                (deal_room_id, made_by, amount_cents, currency, note, response_due_at)
            VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(hours => $6))
            RETURNING id
            "#
        )
        .bind(deal_room_id)
        .bind(made_by)
        .bind(req.amount_cents)
        .bind(&currency)
        .bind(&req.note)
        .bind(response_hours as i32)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    /// Respond to an offer round: accept, reject, or counter.
    ///
    /// Race condition fix: uses atomic UPDATE WHERE responded_at IS NULL
    /// instead of SELECT-then-UPDATE (TOCTOU). Two simultaneous responses
    /// to the same offer — only the first succeeds.
    ///
    /// Counter-offer role fix: the counter-offer's made_by must be the
    /// responder's role, not the original offerer's role.
    pub async fn respond_to_offer(
        &self,
        offer_round_id: i64,
        responder_role: &str,  // "brand" | "creator"
        req: crate::models::RespondOfferRequest,
    ) -> Result<(), ServiceError> {
        // Validate response value at the boundary
        if !["accepted", "rejected", "countered"].contains(&req.response.as_str()) {
            return Err(ServiceError::BarterViolation(
                "response must be 'accepted', 'rejected', or 'countered'".to_string()
            ));
        }

        // Countered requires a counter amount
        if req.response == "countered" && req.counter_amount_cents.is_none() {
            return Err(ServiceError::BarterViolation(
                "counter_amount_cents required when response is 'countered'".to_string()
            ));
        }

        let silent = req.silent_decline.unwrap_or(false);

        // Atomic: only update if not yet responded (eliminates TOCTOU race)
        let rows = sqlx::query(
            r#"
            UPDATE offer_rounds
            SET responded_at  = NOW(),
                response      = $1,
                silent_decline = $2
            WHERE id = $3 AND responded_at IS NULL
            "#
        )
        .bind(&req.response)
        .bind(silent)
        .bind(offer_round_id)
        .execute(&self.pool)
        .await?;

        if rows.rows_affected() == 0 {
            return Err(ServiceError::AlreadyResponded);
        }

        // Fetch the round for deal_room_id (after we know we won the race)
        let round = sqlx::query_as::<_, OfferRound>(
            "SELECT * FROM offer_rounds WHERE id = $1"
        )
        .bind(offer_round_id)
        .fetch_one(&self.pool)
        .await?;

        // If accepted: close the deal room as accepted (atomic guard)
        if req.response == "accepted" {
            sqlx::query(
                "UPDATE deal_rooms SET status = 'accepted', last_action_at = NOW() \
                 WHERE id = $1 AND status = 'active'"
            )
            .bind(round.deal_room_id)
            .execute(&self.pool)
            .await?;
        }

        // If countered: insert counter as new offer from the RESPONDER
        if req.response == "countered" {
            if let Some(amount) = req.counter_amount_cents {
                sqlx::query(
                    r#"
                    INSERT INTO offer_rounds (deal_room_id, made_by, amount_cents, currency, note)
                    VALUES ($1, $2, $3, $4, $5)
                    "#
                )
                .bind(round.deal_room_id)
                .bind(responder_role)
                .bind(amount)
                .bind(&round.currency)
                .bind(&req.counter_note)
                .execute(&self.pool)
                .await?;
            }
        }

        Ok(())
    }

    // ── Soft holds ─────────────────────────────────────────────────

    pub async fn create_soft_hold(
        &self,
        brand_user_id: i64,
        req: crate::models::CreateSoftHoldRequest,
    ) -> Result<i64, ServiceError> {
        // Validate hold duration
        let hours = req.hold_duration_hours;
        if hours != 24 && hours != 48 && hours != 72 {
            return Err(ServiceError::BarterViolation(
                "hold_duration_hours must be 24, 48, or 72".to_string()
            ));
        }

        let room: DealRoom = sqlx::query_as(
            "SELECT * FROM deal_rooms WHERE id = $1"
        )
        .bind(req.deal_room_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        // Atomic: insert only if no active hold exists for this creator
        let id: Option<i64> = sqlx::query_scalar(
            r#"
            INSERT INTO soft_holds
                (deal_room_id, brand_user_id, creator_persona_id, hold_duration_hours, expires_at)
            SELECT $1, $2, $3, $4, NOW() + ($4 || ' hours')::INTERVAL
            WHERE NOT EXISTS (
                SELECT 1 FROM soft_holds
                WHERE creator_persona_id = $3
                  AND status = 'active'
                  AND expires_at > NOW()
            )
            RETURNING id
            "#
        )
        .bind(req.deal_room_id)
        .bind(brand_user_id)
        .bind(room.creator_persona_id)
        .bind(hours)
        .fetch_optional(&self.pool)
        .await?;

        match id {
            Some(hold_id) => Ok(hold_id),
            None => Err(ServiceError::CreatorAlreadyHeld),
        }
    }

    // ── Auto-escalation rules ──────────────────────────────────────

    pub async fn set_auto_escalation(
        &self,
        creator_persona_id: i64,
        req: crate::models::SetAutoEscalationRequest,
    ) -> Result<(), ServiceError> {
        let currency = req.currency.unwrap_or_else(|| "USD".to_string());
        let threshold = req.lowball_threshold.unwrap_or(2);
        sqlx::query(
            r#"
            INSERT INTO auto_escalation_rules
                (creator_persona_id, profession_id, floor_cents, currency, lowball_threshold)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (creator_persona_id, profession_id) DO UPDATE SET
                floor_cents       = EXCLUDED.floor_cents,
                currency          = EXCLUDED.currency,
                lowball_threshold = EXCLUDED.lowball_threshold,
                active            = TRUE
            "#
        )
        .bind(creator_persona_id)
        .bind(req.profession_id)
        .bind(req.floor_cents)
        .bind(&currency)
        .bind(threshold)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ── Trust score helpers ────────────────────────────────────────

    pub async fn get_trust_score(
        &self,
        persona_id: i64,
    ) -> Result<crate::models::TrustScore, ServiceError> {
        sqlx::query_as(
            "SELECT * FROM trust_scores WHERE persona_id = $1"
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)
    }

    pub async fn set_energy_state(
        &self,
        persona_id: i64,
        req: crate::models::SetEnergyStateRequest,
    ) -> Result<(), ServiceError> {
        if !["available", "limited", "burnout", "pause"].contains(&req.energy_state.as_str()) {
            return Err(ServiceError::BarterViolation(
                "energy_state must be 'available', 'limited', 'burnout', or 'pause'".to_string()
            ));
        }
        sqlx::query(
            r#"
            UPDATE trust_scores
            SET energy_state    = $1,
                energy_updated_at = NOW(),
                updated_at      = NOW()
            WHERE persona_id = $2
            "#
        )
        .bind(&req.energy_state)
        .bind(persona_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ── Deliverables ───────────────────────────────────────────────

    pub async fn upload_deliverable(
        &self,
        creator_persona_id: i64,
        req: crate::models::UploadDeliverableRequest,
    ) -> Result<i64, ServiceError> {
        let hash = format!("{:x}", {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut h = DefaultHasher::new();
            req.content_url.hash(&mut h);
            h.finish()
        });

        let weight = req.payout_weight.unwrap_or(1.0);

        // Validate payout_weight range
        if weight <= 0.0 || weight > 1.0 {
            return Err(ServiceError::BarterViolation(
                "payout_weight must be > 0.0 and <= 1.0".to_string()
            ));
        }

        // Prevent double-spend: sum of all payout_weights for this deal room
        // must not exceed 1.0. A creator submitting 3 deliverables at 0.5 each
        // would claim 150% of the deal value.
        let existing_weight: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(payout_weight), 0.0) FROM campaign_deliverables WHERE deal_room_id = $1"
        )
        .bind(req.deal_room_id)
        .fetch_one(&self.pool)
        .await?;

        if existing_weight + weight > 1.0 + f64::EPSILON {
            return Err(ServiceError::BarterViolation(
                format!("Total payout_weight would be {:.2}, exceeding 1.0. Remaining budget: {:.2}",
                    existing_weight + weight, 1.0 - existing_weight)
            ));
        }

        // Verify creator is party to this deal room
        let is_party: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM deal_rooms WHERE id = $1 AND creator_persona_id = $2)"
        )
        .bind(req.deal_room_id)
        .bind(creator_persona_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_party {
            return Err(ServiceError::BarterViolation(
                "You are not the creator in this deal room".to_string()
            ));
        }

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO campaign_deliverables
                (deal_room_id, creator_persona_id, deliverable_type, content_url,
                 content_hash, campaign_type, payout_weight)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#
        )
        .bind(req.deal_room_id)
        .bind(creator_persona_id)
        .bind(&req.deliverable_type)
        .bind(&req.content_url)
        .bind(&hash)
        .bind(&req.campaign_type)
        .bind(weight)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    // ── Testimonials ───────────────────────────────────────────────

    pub async fn submit_testimonial(
        &self,
        from_user_id: i64,
        req: crate::models::SubmitTestimonialRequest,
    ) -> Result<i64, ServiceError> {
        // Validate rating range
        if req.rating < 1 || req.rating > 5 {
            return Err(ServiceError::BarterViolation(
                "Rating must be between 1 and 5".to_string()
            ));
        }

        // Verify submitter is a party to this deal room
        let room: Option<DealRoom> = sqlx::query_as(
            "SELECT * FROM deal_rooms WHERE id = $1"
        )
        .bind(req.deal_room_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(room) = &room {
            let creator_user_id: Option<i64> = sqlx::query_scalar(
                "SELECT user_id FROM personas WHERE id = $1"
            )
            .bind(room.creator_persona_id)
            .fetch_optional(&self.pool)
            .await?;

            let is_party = from_user_id == room.brand_user_id
                || creator_user_id == Some(from_user_id);
            if !is_party {
                return Err(ServiceError::BarterViolation(
                    "You are not a party to this deal room".to_string()
                ));
            }
        } else {
            return Err(ServiceError::NotFound);
        }

        let is_public = req.is_public.unwrap_or(true);
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO testimonials
                (deal_room_id, from_user_id, for_persona_id, campaign_type, rating, body, is_public)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#
        )
        .bind(req.deal_room_id)
        .bind(from_user_id)
        .bind(req.for_persona_id)
        .bind(&req.campaign_type)
        .bind(req.rating)
        .bind(&req.body)
        .bind(is_public)
        .fetch_one(&self.pool)
        .await?;

        // Update deal completion score on the persona's trust_scores
        sqlx::query(
            r#"
            UPDATE trust_scores
            SET completion_score = LEAST(100,
                (completion_score * 9 + ($1 * 20)) / 10),
                updated_at = NOW()
            WHERE persona_id = $2
            "#
        )
        .bind(req.rating as i32)
        .bind(req.for_persona_id)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    // ── Escrow stages ──────────────────────────────────────────────

    pub async fn create_escrow_stages(
        &self,
        req: crate::models::CreateEscrowStagesRequest,
    ) -> Result<(), ServiceError> {
        if req.stages.is_empty() {
            return Err(ServiceError::BarterViolation(
                "At least one escrow stage required".to_string()
            ));
        }

        // Check if this deal room requires financial escrow
        let comp_type: String = sqlx::query_scalar(
            "SELECT compensation_type FROM deal_rooms WHERE id = $1"
        )
        .bind(req.deal_room_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_else(|| "paid".to_string());

        if !BarterService::requires_financial_escrow(&comp_type) {
            return Err(ServiceError::BarterViolation(
                "Barter/exposure deals do not use financial escrow".to_string()
            ));
        }

        // Validate stage amounts are positive
        for stage in &req.stages {
            if stage.amount_cents <= 0 {
                return Err(ServiceError::BarterViolation(
                    "Escrow stage amount_cents must be positive".to_string()
                ));
            }
        }

        // Validate total escrow does not exceed the accepted offer amount
        let accepted_amount: Option<i64> = sqlx::query_scalar(
            "SELECT amount_cents FROM offer_rounds \
             WHERE deal_room_id = $1 AND response = 'accepted' \
             ORDER BY created_at DESC LIMIT 1"
        )
        .bind(req.deal_room_id)
        .fetch_optional(&self.pool)
        .await?;

        let escrow_total: i64 = req.stages.iter().map(|s| s.amount_cents).sum();

        if let Some(deal_amount) = accepted_amount {
            if escrow_total > deal_amount {
                return Err(ServiceError::BarterViolation(
                    format!("Escrow total ({} cents) exceeds accepted deal amount ({} cents)",
                        escrow_total, deal_amount)
                ));
            }
        }

        // Prevent duplicate escrow stages for the same deal room
        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM escrow_stages WHERE deal_room_id = $1"
        )
        .bind(req.deal_room_id)
        .fetch_one(&self.pool)
        .await?;

        if existing > 0 {
            return Err(ServiceError::BarterViolation(
                "Escrow stages already exist for this deal room".to_string()
            ));
        }

        for (i, stage) in req.stages.iter().enumerate() {
            let denominated = stage.denominated_in.as_deref().unwrap_or("credits");
            // Calculate rush multiplier: brand_asset_due_at < NOW + 3 days → 1.25x
            let rush: f64 = if let Some(due) = stage.brand_asset_due_at {
                let hours_until_due = (due - Utc::now()).num_hours();
                if hours_until_due < 72 { 1.25 } else { 1.0 }
            } else {
                1.0
            };

            sqlx::query(
                r#"
                INSERT INTO escrow_stages
                    (deal_room_id, stage_name, stage_order, amount_cents, currency,
                     denominated_in, brand_asset_due_at, rush_multiplier)
                VALUES ($1, $2, $3, $4, 'USD', $5, $6, $7)
                "#
            )
            .bind(req.deal_room_id)
            .bind(&stage.stage_name)
            .bind(i as i16)
            .bind(stage.amount_cents)
            .bind(denominated)
            .bind(stage.brand_asset_due_at)
            .bind(rush)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    // ── ValueSkin versioning ───────────────────────────────────────

    pub async fn set_skin_state(
        &self,
        persona_id: i64,
        req: crate::models::SetSkinStateRequest,
    ) -> Result<(), ServiceError> {
        if !["active", "dormant", "pivot", "retired"].contains(&req.state.as_str()) {
            return Err(ServiceError::BarterViolation(
                "state must be 'active', 'dormant', 'pivot', or 'retired'".to_string()
            ));
        }
        let version: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM skin_versions WHERE persona_id = $1 AND profession_id = $2"
        )
        .bind(persona_id)
        .bind(req.profession_id)
        .fetch_one(&self.pool)
        .await?;

        let managed = req.managed_by.as_deref().unwrap_or("self");
        let inactive_since = if req.state == "dormant" || req.state == "pivot" {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            INSERT INTO skin_versions
                (persona_id, profession_id, version_number, state, outcome_tags,
                 managed_by, agency_name, inactive_since)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#
        )
        .bind(persona_id)
        .bind(req.profession_id)
        .bind(version)
        .bind(&req.state)
        .bind(&req.outcome_tags)
        .bind(managed)
        .bind(&req.agency_name)
        .bind(inactive_since)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Calendar ───────────────────────────────────────────────────

    pub async fn set_calendar_slot(
        &self,
        persona_id: i64,
        req: crate::models::SetCalendarSlotRequest,
    ) -> Result<(), ServiceError> {
        sqlx::query(
            r#"
            INSERT INTO calendar_slots (persona_id, slot_date, slot_label)
            VALUES ($1, $2, $3)
            ON CONFLICT (persona_id, slot_date) DO UPDATE SET
                slot_label = EXCLUDED.slot_label
            "#
        )
        .bind(persona_id)
        .bind(req.slot_date)
        .bind(&req.slot_label)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ── Repeat collab ──────────────────────────────────────────────

    /// Clone a previous deal room's brief and terms into a new room template.
    pub async fn create_repeat_collab(
        &self,
        brand_user_id: i64,
        req: crate::models::RepeatCollabRequest,
    ) -> Result<i64, ServiceError> {
        let original: DealRoom = sqlx::query_as(
            "SELECT * FROM deal_rooms WHERE id = $1 AND brand_user_id = $2"
        )
        .bind(req.original_room_id)
        .bind(brand_user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        // Re-open a new room with the same brief, creator, and compensation type
        let new_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO deal_rooms
                (brand_user_id, creator_persona_id, intent,
                 brief_title, brief_description, brief_deliverables,
                 brief_deadline, brief_campaign_type, compensation_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            "#
        )
        .bind(original.brand_user_id)
        .bind(original.creator_persona_id)
        .bind(&original.intent)
        .bind(&original.brief_title)
        .bind(&original.brief_description)
        .bind(&original.brief_deliverables)
        .bind(original.brief_deadline)
        .bind(&original.brief_campaign_type)
        .bind(&original.compensation_type)
        .fetch_one(&self.pool)
        .await?;

        // Save template for future one-click use
        sqlx::query(
            r#"
            INSERT INTO collab_templates
                (original_room_id, brand_user_id, creator_persona_id, template_json, last_used_at)
            VALUES ($1, $2, $3, $4::jsonb, NOW())
            "#
        )
        .bind(req.original_room_id)
        .bind(brand_user_id)
        .bind(original.creator_persona_id)
        .bind(serde_json::json!({ "new_room_id": new_id, "cloned_from": req.original_room_id }))
        .execute(&self.pool)
        .await?;

        Ok(new_id)
    }

    // ── Expectation checklist ──────────────────────────────────────

    /// Returns a static checklist both parties must confirm before closing.
    pub fn get_expectation_checklist(
        &self,
        deal_room_id: i64,
    ) -> crate::models::ExpectationChecklist {
        crate::models::ExpectationChecklist {
            deal_room_id,
            brand_completed: false,
            creator_completed: false,
            items: vec![
                crate::models::ChecklistItem { key: "content_format", label: "Content format agreed (posts / reels / stories)", required: true },
                crate::models::ChecklistItem { key: "revision_limit", label: "Maximum revision rounds specified", required: true },
                crate::models::ChecklistItem { key: "usage_rights", label: "Usage rights and exclusivity clarified", required: true },
                crate::models::ChecklistItem { key: "payment_schedule", label: "Payment schedule (advance / milestone / completion)", required: true },
                crate::models::ChecklistItem { key: "deliverable_deadline", label: "Final deliverable deadline confirmed", required: true },
                crate::models::ChecklistItem { key: "approval_process", label: "Content approval process defined", required: false },
                crate::models::ChecklistItem { key: "metrics_reporting", label: "Performance metrics reporting agreed", required: false },
            ],
        }
    }
}

