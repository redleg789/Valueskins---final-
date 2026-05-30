//! Gating Decision Cache
//!
//! Caches `can_view_opportunity()` PL/pgSQL results to eliminate
//! per-request function calls. At Meta scale: 10M listing loads/sec
//! = 10M PL/pgSQL calls/sec = CPU saturation on primary DB.
//!
//! Strategy: check `gating_decision_cache` table first (15min TTL).
//! On cache miss, call the function and store the result.
//! Background job prunes expired entries every 5 minutes.

use sqlx::PgPool;

#[derive(Debug, Clone)]
pub struct GatingDecision {
    pub can_view: bool,
    pub reason: Option<String>,
    pub visibility_mode: Option<String>,
}

pub struct GatingCache {
    pool: PgPool,
}

impl GatingCache {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Check gating for a persona+opportunity pair.
    /// Returns cached result if fresh, otherwise evaluates and caches.
    pub async fn check_gating(
        &self,
        persona_id: i64,
        opportunity_id: i64,
    ) -> Result<GatingDecision, sqlx::Error> {
        // 1. Check cache
        let cached: Option<(bool, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT can_view, reason, visibility_mode
             FROM gating_decision_cache
             WHERE persona_id = $1 AND opportunity_id = $2 AND expires_at > NOW()"
        )
        .bind(persona_id)
        .bind(opportunity_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((can_view, reason, vis)) = cached {
            return Ok(GatingDecision {
                can_view,
                reason,
                visibility_mode: vis,
            });
        }

        // 2. Cache miss — evaluate via PL/pgSQL function
        let result: Option<serde_json::Value> = sqlx::query_scalar(
            "SELECT can_view_opportunity($1, $2)"
        )
        .bind(persona_id)
        .bind(opportunity_id)
        .fetch_optional(&self.pool)
        .await?;

        let decision = if let Some(val) = result {
            GatingDecision {
                can_view: val.get("can_view").and_then(|v| v.as_bool()).unwrap_or(true),
                reason: val.get("reason").and_then(|v| v.as_str()).map(String::from),
                visibility_mode: val.get("visibility_mode").and_then(|v| v.as_str()).map(String::from),
            }
        } else {
            GatingDecision {
                can_view: true,
                reason: None,
                visibility_mode: None,
            }
        };

        // 3. Store in cache (fire-and-forget — cache miss is acceptable)
        let _ = sqlx::query(
            "INSERT INTO gating_decision_cache (persona_id, opportunity_id, can_view, reason, visibility_mode)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (persona_id, opportunity_id) DO UPDATE SET
               can_view = EXCLUDED.can_view,
               reason = EXCLUDED.reason,
               visibility_mode = EXCLUDED.visibility_mode,
               cached_at = NOW(),
               expires_at = NOW() + INTERVAL '15 minutes'"
        )
        .bind(persona_id)
        .bind(opportunity_id)
        .bind(decision.can_view)
        .bind(&decision.reason)
        .bind(&decision.visibility_mode)
        .execute(&self.pool)
        .await;

        Ok(decision)
    }

    /// Invalidate cache for a specific opportunity (when gating rules change).
    pub async fn invalidate_opportunity(&self, opportunity_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM gating_decision_cache WHERE opportunity_id = $1")
            .bind(opportunity_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Invalidate cache for a specific persona (when profession/level changes).
    pub async fn invalidate_persona(&self, persona_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM gating_decision_cache WHERE persona_id = $1")
            .bind(persona_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Cleanup expired entries. Called by background job.
    pub async fn cleanup_expired(&self) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM gating_decision_cache WHERE expires_at < NOW()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
