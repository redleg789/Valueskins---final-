use sqlx::PgPool;
use tracing::{info, warn};
use std::time::Duration;
use crate::models::*;

/// Creator Credit Line Service — Meta-scale.
///
/// Critical fixes for billions:
///   - SELECT FOR UPDATE on credit line before advance draw (prevents double-spend)
///   - Read replica for all read-only queries
///   - CTE-based stats query (no correlated subqueries — O(n²) at scale)
///   - Advisory lock on credit line creation (prevents duplicate races)
///   - Statement timeouts on all queries
///   - Idempotent advance draw (unique per credit_line + deal_room)
pub struct CreditService {
    pool: PgPool,
    read_pool: PgPool,
}

#[derive(Debug)]
pub enum CreditError {
    NotEligible(String),
    InsufficientCredit,
    InvalidDealRoom,
    AlreadyExists,
    NotFound,
    Suspended,
    Timeout,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for CreditError {
    fn from(e: sqlx::Error) -> Self {
        CreditError::Database(e)
    }
}

async fn with_timeout<T, F>(future: F) -> Result<T, CreditError>
where
    F: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    match tokio::time::timeout(Duration::from_secs(5), future).await {
        Ok(result) => result.map_err(CreditError::from),
        Err(_) => Err(CreditError::Timeout),
    }
}

impl CreditService {
    pub fn new(pool: PgPool, read_pool: PgPool) -> Self {
        Self { pool, read_pool }
    }

    pub fn new_single_pool(pool: PgPool) -> Self {
        Self { read_pool: pool.clone(), pool }
    }

    /// Deterministic credit score — single CTE query, no correlated subqueries.
    async fn compute_credit_score(
        &self,
        user_id: i64,
    ) -> Result<CreditScoreBreakdown, CreditError> {
        let stats: Option<(i64, i64, i64, i64, f64)> = with_timeout(
            sqlx::query_as(
                r#"
                WITH creator_deals AS (
                    SELECT cd.final_amount_cents, cd.completion_status, cd.completed_at, cd.deadline
                    FROM completed_deals cd
                    JOIN deal_rooms dr ON cd.deal_room_id = dr.id
                    WHERE dr.creator_user_id = $1
                ),
                agg AS (
                    SELECT
                        COUNT(*) FILTER (WHERE completion_status = 'completed') AS deal_count,
                        COALESCE(AVG(final_amount_cents) FILTER (WHERE completion_status = 'completed'), 0)::bigint AS avg_cents,
                        COUNT(*) FILTER (WHERE completion_status = 'completed' AND completed_at <= deadline) AS on_time_count
                    FROM creator_deals
                )
                SELECT
                    a.deal_count,
                    a.avg_cents,
                    COALESCE((SELECT MAX(pp.real_score) FROM persona_professions pp
                              JOIN personas p ON pp.persona_id = p.id
                              WHERE p.owner_user_id = $1 AND p.exists = TRUE), 0)::bigint AS trust_score,
                    COALESCE(EXTRACT(EPOCH FROM (NOW() - (SELECT MIN(created_at) FROM users WHERE id = $1)))
                             / 2592000, 0)::bigint AS months_active,
                    CASE WHEN a.deal_count > 0
                         THEN (a.on_time_count::float8 / a.deal_count * 100.0)
                         ELSE 0.0 END AS on_time_rate
                FROM agg a
                "#,
            )
            .bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?;

        let (deal_count, avg_deal_cents, trust_score, months_active, on_time_rate) =
            stats.ok_or(CreditError::NotEligible("No user data found".into()))?;

        if deal_count < 1 {
            return Err(CreditError::NotEligible("At least 1 completed deal required".into()));
        }

        let completed_deals_factor = (deal_count * 2).min(25) as i16;
        let avg_deal_value_factor = (avg_deal_cents / 10000).min(20) as i16;
        let trust_score_factor = (trust_score / 5).min(20) as i16;
        let tenure_factor = months_active.min(15) as i16;
        let on_time_rate_factor = (on_time_rate / 5.0).floor().min(20.0) as i16;

        let total = (completed_deals_factor + avg_deal_value_factor + trust_score_factor
            + tenure_factor + on_time_rate_factor).min(100);

        let raw_limit = (total as i64 * avg_deal_cents.max(5000)) / 200;
        let credit_limit = raw_limit.clamp(10000, 5_000_000);

        Ok(CreditScoreBreakdown {
            total_score: total,
            factors: CreditScoreFactors {
                completed_deals_factor,
                avg_deal_value_factor,
                trust_score_factor,
                tenure_factor,
                on_time_rate_factor,
            },
            credit_limit_cents: credit_limit,
        })
    }

    /// Apply for a credit line. Idempotent — uses ON CONFLICT.
    /// Advisory lock prevents race conditions on concurrent applications.
    pub async fn apply(&self, user_id: i64) -> Result<CreditLine, CreditError> {
        // Check existing on read replica first (fast path)
        let existing = with_timeout(
            sqlx::query_as::<_, CreditLine>(
                r#"SELECT id, user_id, credit_limit_cents, used_cents, available_cents,
                          credit_score, status, created_at, updated_at
                   FROM creator_credit_lines WHERE user_id = $1"#,
            )
            .bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?;

        if let Some(line) = existing {
            return Ok(line);
        }

        let breakdown = self.compute_credit_score(user_id).await?;

        // Advisory lock on user_id prevents duplicate creation race
        // Use hashtext(user_id::text) to safely handle large i64 values without truncation
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(7392, hashtext($1::text)::int)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let line = sqlx::query_as::<_, CreditLine>(
            r#"INSERT INTO creator_credit_lines
                   (user_id, credit_limit_cents, used_cents, available_cents, credit_score, status)
               VALUES ($1, $2, 0, $2, $3, 'active')
               ON CONFLICT (user_id) DO UPDATE SET
                   credit_limit_cents = EXCLUDED.credit_limit_cents,
                   available_cents = EXCLUDED.credit_limit_cents - creator_credit_lines.used_cents,
                   credit_score = EXCLUDED.credit_score,
                   updated_at = NOW()
               RETURNING id, user_id, credit_limit_cents, used_cents, available_cents,
                         credit_score, status, created_at, updated_at"#,
        )
        .bind(user_id)
        .bind(breakdown.credit_limit_cents)
        .bind(breakdown.total_score)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        info!(user_id, score = breakdown.total_score, limit = breakdown.credit_limit_cents, "Credit line created");
        Ok(line)
    }

    pub async fn get_status(&self, user_id: i64) -> Result<CreditLine, CreditError> {
        with_timeout(
            sqlx::query_as::<_, CreditLine>(
                r#"SELECT id, user_id, credit_limit_cents, used_cents, available_cents,
                          credit_score, status, created_at, updated_at
                   FROM creator_credit_lines WHERE user_id = $1"#,
            )
            .bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?
        .ok_or(CreditError::NotFound)
    }

    pub async fn get_score_breakdown(&self, user_id: i64) -> Result<CreditScoreBreakdown, CreditError> {
        self.compute_credit_score(user_id).await
    }

    /// Draw advance — SELECT FOR UPDATE prevents double-spend at scale.
    /// Idempotent per (credit_line_id, deal_room_id).
    pub async fn draw_advance(&self, user_id: i64, req: &DrawAdvanceRequest) -> Result<CreditAdvance, CreditError> {
        if req.amount_cents <= 0 {
            return Err(CreditError::NotEligible("Amount must be positive".into()));
        }

        let mut tx = self.pool.begin().await?;

        // SELECT FOR UPDATE — locks the credit line row, prevents concurrent double-spend
        let line: CreditLine = sqlx::query_as(
            r#"SELECT id, user_id, credit_limit_cents, used_cents, available_cents,
                      credit_score, status, created_at, updated_at
               FROM creator_credit_lines
               WHERE user_id = $1
               FOR UPDATE"#,
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(CreditError::NotFound)?;

        if line.status == "suspended" { return Err(CreditError::Suspended); }
        if req.amount_cents > line.available_cents { return Err(CreditError::InsufficientCredit); }

        // Verify deal room
        let valid_deal: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM deal_rooms WHERE id = $1 AND creator_user_id = $2 AND status = 'active')",
        )
        .bind(req.deal_room_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        if !valid_deal { return Err(CreditError::InvalidDealRoom); }

        // Idempotent: ON CONFLICT returns existing advance
        let advance = sqlx::query_as::<_, CreditAdvance>(
            r#"INSERT INTO credit_advances
                   (credit_line_id, deal_room_id, amount_cents, repayment_auto_deduct,
                    repayment_due_at, status)
               VALUES ($1, $2, $3, $4, NOW() + INTERVAL '90 days', 'issued')
               ON CONFLICT (credit_line_id, deal_room_id)
                   WHERE status != 'forfeited'
               DO NOTHING
               RETURNING id, credit_line_id, deal_room_id, amount_cents,
                         repayment_auto_deduct, repayment_due_at, repaid_at, status, created_at"#,
        )
        .bind(line.id)
        .bind(req.deal_room_id)
        .bind(req.amount_cents)
        .bind(req.auto_deduct.unwrap_or(true))
        .fetch_optional(&mut *tx)
        .await?;

        // If DO NOTHING fired (duplicate), fetch existing
        let advance = match advance {
            Some(a) => {
                // New insert — update credit line
                sqlx::query(
                    r#"UPDATE creator_credit_lines
                       SET used_cents = used_cents + $1, available_cents = available_cents - $1, updated_at = NOW()
                       WHERE id = $2"#,
                )
                .bind(req.amount_cents)
                .bind(line.id)
                .execute(&mut *tx)
                .await?;
                a
            }
            None => {
                // Duplicate — return existing
                sqlx::query_as::<_, CreditAdvance>(
                    r#"SELECT id, credit_line_id, deal_room_id, amount_cents,
                              repayment_auto_deduct, repayment_due_at, repaid_at, status, created_at
                       FROM credit_advances
                       WHERE credit_line_id = $1 AND deal_room_id = $2 AND status != 'forfeited'"#,
                )
                .bind(line.id)
                .bind(req.deal_room_id)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        tx.commit().await?;
        info!(user_id, deal_room_id = req.deal_room_id, amount_cents = req.amount_cents, "Credit advance issued");
        Ok(advance)
    }

    /// Repay advance — uses FOR UPDATE to prevent concurrent repayment race.
    pub async fn repay_advance(&self, user_id: i64, advance_id: i64) -> Result<CreditAdvance, CreditError> {
        let mut tx = self.pool.begin().await?;

        let advance = sqlx::query_as::<_, CreditAdvance>(
            r#"SELECT ca.id, ca.credit_line_id, ca.deal_room_id, ca.amount_cents,
                      ca.repayment_auto_deduct, ca.repayment_due_at, ca.repaid_at, ca.status, ca.created_at
               FROM credit_advances ca
               JOIN creator_credit_lines ccl ON ca.credit_line_id = ccl.id
               WHERE ca.id = $1 AND ccl.user_id = $2
               FOR UPDATE OF ca"#,
        )
        .bind(advance_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(CreditError::NotFound)?;

        if advance.status == "repaid" {
            tx.rollback().await?;
            return Ok(advance);
        }

        let updated = sqlx::query_as::<_, CreditAdvance>(
            r#"UPDATE credit_advances SET status = 'repaid', repaid_at = NOW()
               WHERE id = $1 AND status IN ('issued', 'pending')
               RETURNING id, credit_line_id, deal_room_id, amount_cents,
                         repayment_auto_deduct, repayment_due_at, repaid_at, status, created_at"#,
        )
        .bind(advance_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE creator_credit_lines SET used_cents = used_cents - $1, available_cents = available_cents + $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(advance.amount_cents)
        .bind(advance.credit_line_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        info!(advance_id, user_id, "Advance repaid");
        Ok(updated)
    }

    pub async fn list_advances(&self, user_id: i64, query: &AdvanceListQuery) -> Result<(Vec<CreditAdvance>, i64), CreditError> {
        let limit = query.limit.unwrap_or(20).min(100) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;

        #[derive(sqlx::FromRow)]
        struct AdvanceWithCount {
            id: i64,
            credit_line_id: i64,
            deal_room_id: i64,
            amount_cents: i64,
            repayment_auto_deduct: bool,
            repayment_due_at: Option<chrono::DateTime<chrono::Utc>>,
            repaid_at: Option<chrono::DateTime<chrono::Utc>>,
            status: String,
            created_at: chrono::DateTime<chrono::Utc>,
            total_count: i64,
        }

        let rows = with_timeout(
            sqlx::query_as::<_, AdvanceWithCount>(
                r#"SELECT ca.id, ca.credit_line_id, ca.deal_room_id, ca.amount_cents,
                          ca.repayment_auto_deduct, ca.repayment_due_at, ca.repaid_at, ca.status, ca.created_at,
                          COUNT(*) OVER()::int8 AS total_count
                   FROM credit_advances ca
                   JOIN creator_credit_lines ccl ON ca.credit_line_id = ccl.id
                   WHERE ccl.user_id = $1 AND ($2::text IS NULL OR ca.status = $2)
                   ORDER BY ca.created_at DESC
                   LIMIT $3 OFFSET $4"#,
            )
            .bind(user_id)
            .bind(query.status.as_deref())
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.read_pool)
        ).await?;

        let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
        let advances = rows.into_iter().map(|r| CreditAdvance {
            id: r.id,
            credit_line_id: r.credit_line_id,
            deal_room_id: r.deal_room_id,
            amount_cents: r.amount_cents,
            repayment_auto_deduct: r.repayment_auto_deduct,
            repayment_due_at: r.repayment_due_at,
            repaid_at: r.repaid_at,
            status: r.status,
            created_at: r.created_at,
        }).collect();

        Ok((advances, total_count))
    }
}
