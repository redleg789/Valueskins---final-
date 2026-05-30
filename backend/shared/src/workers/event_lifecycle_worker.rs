//! Event Lifecycle Worker
//!
//! Responsibilities:
//! - transition ended events from `active` -> `ended_visible` -> `archived`
//! - remove archived events from search/discovery/feed visibility
//! - snapshot archived events into archive tables
//! - move data hot -> warm -> cold
//! - roll up event analytics into daily aggregates
//! - refresh admin materialized views
//! - schedule weekly/monthly report runs

use sqlx::PgPool;
use std::time::Duration;
use tokio::time;

pub async fn start(pool: PgPool, interval: Duration) {
    tracing::info!("Event lifecycle worker started (interval={:?})", interval);

    let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string());
    let mut tick = time::interval(interval);
    let mut cycle: i64 = 0;

    loop {
        tick.tick().await;
        cycle += 1;

        if let Err(e) = mark_recently_ended_visible(&pool).await {
            tracing::error!(error = %e, "Event ended-visible transition failed");
        }

        if let Err(e) = archive_public_events(&pool).await {
            tracing::error!(error = %e, "Event archival transition failed");
        }

        if let Err(e) = finalize_search_index_cleanup(&pool).await {
            tracing::error!(error = %e, "Search index cleanup finalization failed");
        }

        if let Err(e) = capture_archive_snapshots(&pool).await {
            tracing::error!(error = %e, "Archived event snapshot sync failed");
        }

        if let Err(e) = promote_to_warm_storage(&pool).await {
            tracing::error!(error = %e, "Warm storage promotion failed");
        }

        if let Err(e) = promote_to_cold_storage(&pool).await {
            tracing::error!(error = %e, "Cold storage promotion failed");
        }

        if let Err(e) = rollup_daily_analytics(&pool).await {
            tracing::error!(error = %e, "Daily event analytics rollup failed");
        }

        if let Err(e) = refresh_admin_views(&pool).await {
            tracing::error!(error = %e, "Admin event view refresh failed");
        }

        if let Err(e) = schedule_periodic_reports(&pool).await {
            tracing::error!(error = %e, "Periodic event report scheduling failed");
        }

        if let Err(e) = generate_pending_reports(&pool).await {
            tracing::error!(error = %e, "Periodic event report generation failed");
        }

        let _ = sqlx::query(
            "INSERT INTO worker_heartbeats (worker_name, last_seen_at, cycle_count, last_items_processed, pod_hostname)
             VALUES ('event_lifecycle_worker', NOW(), $1, 0, $2)
             ON CONFLICT (worker_name) DO UPDATE SET
               last_seen_at = NOW(), cycle_count = $1, pod_hostname = $2"
        )
        .bind(cycle)
        .bind(&hostname)
        .execute(&pool)
        .await;
    }
}

async fn mark_recently_ended_visible(pool: &PgPool) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        r#"
        WITH updated AS (
            UPDATE events
            SET visibility_status = 'ended_visible',
                storage_tier = CASE WHEN storage_tier = 'hot' THEN 'warm' ELSE storage_tier END,
                warm_moved_at = COALESCE(warm_moved_at, NOW()),
                updated_at = NOW()
            WHERE visibility_status = 'active'
              AND COALESCE(end_time, start_time) < NOW()
              AND public_expires_at > NOW()
            RETURNING id, visibility_status, storage_tier
        )
        INSERT INTO event_public_lifecycle_audit
            (event_id, previous_visibility_status, next_visibility_status, previous_storage_tier, next_storage_tier, reason)
        SELECT id, 'active', 'ended_visible', 'hot', 'warm', 'event_end_window_started'
        FROM updated
        "#
    )
    .execute(pool)
    .await?;

    if result.rows_affected() > 0 {
        tracing::info!(count = result.rows_affected(), "Marked events as ended-visible");
    }
    Ok(())
}

async fn archive_public_events(pool: &PgPool) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        r#"
        WITH updated AS (
            UPDATE events
            SET visibility_status = 'archived',
                archived_at = COALESCE(archived_at, NOW()),
                is_publicly_listed = FALSE,
                search_visible = FALSE,
                discovery_visible = FALSE,
                recommendation_visible = FALSE,
                profile_visible = FALSE,
                feed_visible = FALSE,
                attendee_list_public = FALSE,
                search_index_status = CASE
                    WHEN search_index_status = 'indexed' THEN 'pending_removal'
                    ELSE search_index_status
                END,
                updated_at = NOW()
            WHERE visibility_status <> 'archived'
              AND public_expires_at <= NOW()
            RETURNING id, storage_tier
        )
        INSERT INTO event_public_lifecycle_audit
            (event_id, previous_visibility_status, next_visibility_status, previous_storage_tier, next_storage_tier, reason)
        SELECT id, 'ended_visible', 'archived', storage_tier, storage_tier, 'public_visibility_expired'
        FROM updated
        "#
    )
    .execute(pool)
    .await?;

    if result.rows_affected() > 0 {
        tracing::info!(count = result.rows_affected(), "Archived public events");
    }
    Ok(())
}

async fn finalize_search_index_cleanup(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE events
         SET search_index_status = 'removed', updated_at = NOW()
         WHERE visibility_status = 'archived'
           AND search_index_status = 'pending_removal'"
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn capture_archive_snapshots(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO archived_events
            (
                event_id, host_user_id, event_type, category, title, description,
                location, start_time, end_time, community_id, attendee_count,
                ticket_price_cents, tags, metadata, archived_at,
                source_visibility_status, source_storage_tier
            )
        SELECT
            e.id, e.host_user_id, e.event_type, e.category, e.title, e.description,
            e.location, e.start_time, e.end_time, e.community_id, e.attendee_count,
            e.ticket_price_cents, e.tags, e.metadata, COALESCE(e.archived_at, NOW()),
            e.visibility_status, e.storage_tier
        FROM events e
        WHERE e.visibility_status = 'archived'
        ON CONFLICT (event_id) DO UPDATE SET
            attendee_count = EXCLUDED.attendee_count,
            archived_at = EXCLUDED.archived_at,
            tags = EXCLUDED.tags,
            metadata = EXCLUDED.metadata,
            source_visibility_status = EXCLUDED.source_visibility_status,
            source_storage_tier = EXCLUDED.source_storage_tier
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn promote_to_warm_storage(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE events
        SET storage_tier = 'warm',
            warm_moved_at = COALESCE(warm_moved_at, NOW()),
            updated_at = NOW()
        WHERE storage_tier = 'hot'
          AND COALESCE(end_time, start_time) < NOW()
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn promote_to_cold_storage(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        WITH moved AS (
            UPDATE events
            SET storage_tier = 'cold',
                cold_moved_at = COALESCE(cold_moved_at, NOW()),
                updated_at = NOW()
            WHERE storage_tier <> 'cold'
              AND COALESCE(archived_at, public_expires_at) <= NOW() - INTERVAL '30 days'
            RETURNING id
        )
        INSERT INTO cold_storage_events (event_id, analytics_snapshot, relationship_snapshot, moved_to_cold_at)
        SELECT id, '{}'::jsonb, '{}'::jsonb, NOW()
        FROM moved
        ON CONFLICT (event_id) DO NOTHING
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn rollup_daily_analytics(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO event_analytics_daily
            (
                event_id, bucket_date, host_user_id, event_type, category, city, tags,
                page_views, unique_viewers, shares, saves, ticket_clicks,
                purchases_started, tickets_sold, attendance_count,
                repeat_attendance_count, dropoff_count, total_time_spent_seconds, conversion_rate
            )
        SELECT
            e.id,
            DATE(ie.created_at) AS bucket_date,
            e.host_user_id,
            e.event_type,
            e.category,
            e.location,
            e.tags,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'view')::INT AS page_views,
            COUNT(DISTINCT ie.actor_user_id) FILTER (WHERE ie.interaction_type = 'view')::INT AS unique_viewers,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'share')::INT AS shares,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'save')::INT AS saves,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'ticket_click')::INT AS ticket_clicks,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'purchase_started')::INT AS purchases_started,
            COALESCE(conv.tickets_sold, 0)::INT AS tickets_sold,
            COALESCE(att.attendance_count, 0)::INT AS attendance_count,
            COALESCE(att.repeat_attendance_count, 0)::INT AS repeat_attendance_count,
            COUNT(*) FILTER (WHERE ie.interaction_type = 'dropoff')::INT AS dropoff_count,
            COALESCE(SUM(ie.time_spent_seconds), 0)::BIGINT AS total_time_spent_seconds,
            CASE
                WHEN COUNT(*) FILTER (WHERE ie.interaction_type = 'view') = 0 THEN 0
                ELSE COALESCE(conv.tickets_sold, 0)::NUMERIC
                     / NULLIF(COUNT(*) FILTER (WHERE ie.interaction_type = 'view'), 0)::NUMERIC
            END AS conversion_rate
        FROM events e
        JOIN event_interaction_events ie ON ie.event_id = e.id
        LEFT JOIN (
            SELECT event_id, DATE(converted_at) AS bucket_date, SUM(ticket_count) AS tickets_sold
            FROM event_conversion_attribution
            GROUP BY event_id, DATE(converted_at)
        ) conv ON conv.event_id = e.id AND conv.bucket_date = DATE(ie.created_at)
        LEFT JOIN (
            SELECT
                event_id,
                DATE(registered_at) AS bucket_date,
                COUNT(*) FILTER (WHERE repeat_event_type_count > 0) AS repeat_attendance_count,
                COUNT(*) AS attendance_count
            FROM event_attendee_intelligence
            GROUP BY event_id, DATE(registered_at)
        ) att ON att.event_id = e.id AND att.bucket_date = DATE(ie.created_at)
        WHERE ie.created_at >= NOW() - INTERVAL '14 days'
        GROUP BY e.id, DATE(ie.created_at), e.host_user_id, e.event_type, e.category, e.location, e.tags, conv.tickets_sold, att.attendance_count, att.repeat_attendance_count
        ON CONFLICT (event_id, bucket_date) DO UPDATE SET
            page_views = EXCLUDED.page_views,
            unique_viewers = EXCLUDED.unique_viewers,
            shares = EXCLUDED.shares,
            saves = EXCLUDED.saves,
            ticket_clicks = EXCLUDED.ticket_clicks,
            purchases_started = EXCLUDED.purchases_started,
            tickets_sold = EXCLUDED.tickets_sold,
            attendance_count = EXCLUDED.attendance_count,
            repeat_attendance_count = EXCLUDED.repeat_attendance_count,
            dropoff_count = EXCLUDED.dropoff_count,
            total_time_spent_seconds = EXCLUDED.total_time_spent_seconds,
            conversion_rate = EXCLUDED.conversion_rate,
            tags = EXCLUDED.tags
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn refresh_admin_views(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("REFRESH MATERIALIZED VIEW admin_event_category_performance")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW admin_event_city_performance")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW admin_event_host_performance")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW admin_event_network_overlap")
        .execute(pool)
        .await?;

    Ok(())
}

async fn schedule_periodic_reports(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO event_report_runs (report_type, period_start, period_end, status)
        VALUES
            (
                'weekly',
                DATE_TRUNC('week', NOW() - INTERVAL '7 days')::date,
                (DATE_TRUNC('week', NOW()) - INTERVAL '1 day')::date,
                'pending'
            ),
            (
                'monthly',
                DATE_TRUNC('month', NOW() - INTERVAL '1 month')::date,
                (DATE_TRUNC('month', NOW()) - INTERVAL '1 day')::date,
                'pending'
            )
        ON CONFLICT (report_type, period_start, period_end) DO NOTHING
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn generate_pending_reports(pool: &PgPool) -> Result<(), sqlx::Error> {
    let runs: Vec<(i64, String, chrono::NaiveDate, chrono::NaiveDate)> = sqlx::query_as(
        "SELECT id, report_type, period_start, period_end
         FROM event_report_runs
         WHERE status = 'pending'
         ORDER BY period_end ASC
         LIMIT 5"
    )
    .fetch_all(pool)
    .await?;

    for (report_id, report_type, period_start, period_end) in runs {
        sqlx::query("UPDATE event_report_runs SET status = 'running' WHERE id = $1")
            .bind(report_id)
            .execute(pool)
            .await?;

        if let Err(e) = build_report(pool, report_id, &report_type, period_start, period_end).await {
            sqlx::query("UPDATE event_report_runs SET status = 'failed' WHERE id = $1")
                .bind(report_id)
                .execute(pool)
                .await?;
            return Err(e);
        }
    }

    Ok(())
}

async fn build_report(
    pool: &PgPool,
    report_id: i64,
    report_type: &str,
    period_start: chrono::NaiveDate,
    period_end: chrono::NaiveDate,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM event_report_insights WHERE report_run_id = $1")
        .bind(report_id)
        .execute(pool)
        .await?;

    let top_type: Option<(String, i64, i64)> = sqlx::query_as(
        "SELECT event_type, SUM(attendance_count)::bigint, SUM(repeat_attendance_count)::bigint
         FROM event_analytics_daily
         WHERE bucket_date BETWEEN $1 AND $2
         GROUP BY event_type
         ORDER BY SUM(attendance_count) DESC
         LIMIT 1"
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_optional(pool)
    .await?;

    let top_city: Option<(String, i64, f64)> = sqlx::query_as(
        "SELECT city, SUM(attendance_count)::bigint, AVG(conversion_rate)::float8
         FROM event_analytics_daily
         WHERE bucket_date BETWEEN $1 AND $2
         GROUP BY city
         ORDER BY SUM(attendance_count) DESC
         LIMIT 1"
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_optional(pool)
    .await?;

    let strongest_conversion: Option<(String, f64)> = sqlx::query_as(
        "SELECT event_type, AVG(conversion_rate)::float8
         FROM event_analytics_daily
         WHERE bucket_date BETWEEN $1 AND $2
         GROUP BY event_type
         ORDER BY AVG(conversion_rate) DESC
         LIMIT 1"
    )
    .bind(period_start)
    .bind(period_end)
    .fetch_optional(pool)
    .await?;

    let summary = serde_json::json!({
        "report_type": report_type,
        "period_start": period_start,
        "period_end": period_end,
        "top_event_type": top_type.as_ref().map(|v| &v.0),
        "top_city": top_city.as_ref().map(|v| &v.0),
        "strongest_conversion_event_type": strongest_conversion.as_ref().map(|v| &v.0),
    });

    if let Some((event_type, attendance_total, repeat_total)) = top_type {
        let headline = format!("{event_type} events produced the strongest attendance in this period.");
        sqlx::query(
            "INSERT INTO event_report_insights
                (report_run_id, insight_type, headline, supporting_data, priority_score)
             VALUES ($1, 'pattern', $2, $3, $4)"
        )
        .bind(report_id)
        .bind(headline)
        .bind(serde_json::json!({
            "event_type": event_type,
            "attendance_total": attendance_total,
            "repeat_attendance_total": repeat_total,
        }))
        .bind(attendance_total as f64)
        .execute(pool)
        .await?;
    }

    if let Some((city, attendance_total, avg_conversion_rate)) = top_city {
        let headline = format!("{city} was the most active event city for {} reporting.", report_type);
        sqlx::query(
            "INSERT INTO event_report_insights
                (report_run_id, insight_type, headline, supporting_data, priority_score)
             VALUES ($1, 'growth_opportunity', $2, $3, $4)"
        )
        .bind(report_id)
        .bind(headline)
        .bind(serde_json::json!({
            "city": city,
            "attendance_total": attendance_total,
            "avg_conversion_rate": avg_conversion_rate,
        }))
        .bind(attendance_total as f64)
        .execute(pool)
        .await?;
    }

    if let Some((event_type, avg_conversion_rate)) = strongest_conversion {
        let headline = format!("Host more {event_type} events: they delivered the best conversion rate.");
        sqlx::query(
            "INSERT INTO event_report_insights
                (report_run_id, insight_type, headline, supporting_data, priority_score)
             VALUES ($1, 'recommendation', $2, $3, $4)"
        )
        .bind(report_id)
        .bind(headline)
        .bind(serde_json::json!({
            "event_type": event_type,
            "avg_conversion_rate": avg_conversion_rate,
        }))
        .bind(avg_conversion_rate * 100.0)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "UPDATE event_report_runs
         SET status = 'completed', generated_at = NOW(), summary = $2
         WHERE id = $1"
    )
    .bind(report_id)
    .bind(summary)
    .execute(pool)
    .await?;

    Ok(())
}
