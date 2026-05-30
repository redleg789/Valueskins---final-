//! Cleanup Worker — periodic maintenance tasks.
//!
//! Runs as a background tokio task. Handles:
//!   - Expired soft holds → status='expired'
//!   - Expired offer rounds → auto-reject
//!   - Expired gating cache entries → DELETE
//!   - Expired reputation worker claims → DELETE
//!   - Stale rate limit windows → DELETE

use sqlx::PgPool;
use std::time::Duration;
use tokio::time;

pub async fn start(pool: PgPool, interval: Duration) {
    tracing::info!("Cleanup worker started (interval={:?})", interval);

    let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string());
    let mut tick = time::interval(interval);
    let mut cycle: i64 = 0;

    loop {
        tick.tick().await;
        cycle += 1;

        // Each cleanup is independent — one failure doesn't block others
        if let Err(e) = expire_soft_holds(&pool).await {
            tracing::error!(error = %e, "Soft hold cleanup failed");
        }

        if let Err(e) = expire_offer_rounds(&pool).await {
            tracing::error!(error = %e, "Offer round cleanup failed");
        }

        if let Err(e) = cleanup_gating_cache(&pool).await {
            tracing::error!(error = %e, "Gating cache cleanup failed");
        }

        if let Err(e) = cleanup_worker_claims(&pool).await {
            tracing::error!(error = %e, "Worker claims cleanup failed");
        }

        if let Err(e) = cleanup_rate_limit_windows(&pool).await {
            tracing::error!(error = %e, "Rate limit cleanup failed");
        }

        // Data retention enforcement (runs every cycle but batched internally)
        if let Err(e) = crate::data_retention::enforce_all(&pool).await {
            tracing::error!(error = %e, "Data retention cleanup failed");
        }

        // Refresh materialized views (leaderboard, platform stats)
        if let Err(e) = refresh_materialized_views(&pool).await {
            tracing::error!(error = %e, "Materialized view refresh failed");
        }

        // Expire idempotency keys older than 2 days
        if let Err(e) = cleanup_idempotency_keys(&pool).await {
            tracing::error!(error = %e, "Idempotency key cleanup failed");
        }

        // Heartbeat
        let _ = sqlx::query(
            "INSERT INTO worker_heartbeats (worker_name, last_seen_at, cycle_count, last_items_processed, pod_hostname)
             VALUES ('cleanup_worker', NOW(), $1, 0, $2)
             ON CONFLICT (worker_name) DO UPDATE SET
               last_seen_at = NOW(), cycle_count = $1, pod_hostname = $2"
        )
        .bind(cycle)
        .bind(&hostname)
        .execute(&pool)
        .await;
    }
}

async fn expire_soft_holds(pool: &PgPool) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "UPDATE soft_holds SET status = 'expired'
         WHERE status = 'active' AND expires_at <= NOW()"
    )
    .execute(pool)
    .await?;

    let n = result.rows_affected();
    if n > 0 {
        tracing::info!(count = n, "Expired soft holds");
    }
    Ok(())
}

async fn expire_offer_rounds(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Auto-reject offers not responded to within the deadline.
    // Use subquery form — LIMIT on UPDATE is non-standard and unsupported in PostgreSQL.
    sqlx::query(
        "UPDATE offer_rounds SET response = 'rejected', responded_at = NOW(), silent_decline = TRUE
         WHERE id IN (
            SELECT id FROM offer_rounds
            WHERE responded_at IS NULL AND response_due_at <= NOW()
            LIMIT 1000
         )"
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn cleanup_gating_cache(pool: &PgPool) -> Result<(), sqlx::Error> {
    let result = sqlx::query("DELETE FROM gating_decision_cache WHERE expires_at < NOW()")
        .execute(pool)
        .await?;

    let n = result.rows_affected();
    if n > 0 {
        tracing::info!(count = n, "Cleaned gating cache entries");
    }
    Ok(())
}

async fn cleanup_worker_claims(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM reputation_worker_claims WHERE expires_at < NOW()")
        .execute(pool)
        .await?;
    Ok(())
}

async fn cleanup_rate_limit_windows(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Remove rate limit entries older than 2 days (only today's matters)
    sqlx::query(
        "DELETE FROM application_rate_limits
         WHERE window_start < DATE_TRUNC('day', NOW()) - INTERVAL '1 day'"
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn refresh_materialized_views(pool: &PgPool) -> Result<(), sqlx::Error> {
    let start = std::time::Instant::now();

    // CONCURRENTLY allows reads during refresh (requires unique index, which we have)
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY creator_leaderboard")
        .execute(pool)
        .await?;

    let leaderboard_ms = start.elapsed().as_millis() as i32;

    sqlx::query("REFRESH MATERIALIZED VIEW platform_stats")
        .execute(pool)
        .await?;

    // Log refresh timing for monitoring
    let _ = sqlx::query(
        "INSERT INTO matview_refresh_log (view_name, last_refreshed, duration_ms)
         VALUES ('creator_leaderboard', NOW(), $1), ('platform_stats', NOW(), NULL)
         ON CONFLICT (view_name) DO UPDATE SET last_refreshed = NOW(), duration_ms = EXCLUDED.duration_ms"
    )
    .bind(leaderboard_ms)
    .execute(pool)
    .await;

    Ok(())
}

async fn cleanup_idempotency_keys(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '2 days'")
        .execute(pool)
        .await?;
    Ok(())
}
