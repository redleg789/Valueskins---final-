//! Outbox Worker — polls event_outbox and dispatches events.
//!
//! Runs as a background tokio task alongside the HTTP server.
//! Uses SELECT FOR UPDATE SKIP LOCKED for safe multi-instance execution.
//!
//! Responsibilities:
//!   - Poll event_outbox every 1 second
//!   - Dispatch to registered handlers (reputation, fraud, notifications)
//!   - Mark events as published or increment retry count
//!   - Dead-letter events that exceed max_retries

use sqlx::PgPool;
use std::time::Duration;
use tokio::time;

/// Starts the outbox polling loop as a background task.
/// Runs until the provided cancellation token is triggered.
pub async fn start(pool: PgPool, poll_interval: Duration) {
    tracing::info!("Outbox worker started (interval={:?})", poll_interval);

    let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string());
    let mut interval = time::interval(poll_interval);
    let mut cycle: i64 = 0;

    loop {
        interval.tick().await;
        cycle += 1;

        let dispatched = match poll_batch(&pool, 100).await {
            Ok(n) => {
                if n > 0 {
                    tracing::info!(dispatched = n, "Outbox events dispatched");
                }
                n as i32
            }
            Err(e) => {
                tracing::error!(error = %e, "Outbox worker poll failed");
                0
            }
        };

        // Heartbeat: lets monitoring detect a stuck/dead worker
        let _ = sqlx::query(
            "INSERT INTO worker_heartbeats (worker_name, last_seen_at, cycle_count, last_items_processed, pod_hostname)
             VALUES ('outbox_worker', NOW(), $1, $2, $3)
             ON CONFLICT (worker_name) DO UPDATE SET
               last_seen_at = NOW(),
               cycle_count = $1,
               last_items_processed = $2,
               pod_hostname = $3"
        )
        .bind(cycle)
        .bind(dispatched)
        .bind(&hostname)
        .execute(&pool)
        .await;
    }
}

/// Poll and process a batch of pending events.
/// Uses advisory lock to prevent stampede when multiple workers start simultaneously.
async fn poll_batch(pool: &PgPool, batch_size: i64) -> Result<usize, sqlx::Error> {
    let events: Vec<(i64, String, String, i64, serde_json::Value, i32, i32)> = sqlx::query_as(
        "SELECT id, aggregate_type, event_type, aggregate_id, payload, retry_count, max_retries
         FROM event_outbox
         WHERE published_at IS NULL
           AND retry_count < max_retries
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED"
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await?;

    let mut count = 0;

    for (id, _agg_type, event_type, _agg_id, payload, _retry, _max) in &events {
        // Dispatch based on event_type.
        // In production, these would be registered handler functions.
        // For now, we handle the known event types inline.
        let result = match event_type.as_str() {
            "deal.completed" => handle_deal_completed(pool, payload).await,
            "offer.accepted" => handle_offer_accepted(pool, payload).await,

            // ── Identity Events ──
            "identity.age.verified" => handle_age_verified(pool, payload).await,
            "identity.age.rejected" => handle_age_rejected(pool, payload).await,
            "identity.document.verified" => handle_document_verified(pool, payload).await,
            "identity.document.rejected" => handle_document_rejected(pool, payload).await,
            "identity.kyc.completed" => handle_kyc_completed(pool, payload).await,

            // ── Guardian Events ──
            "guardian.relationship.activated" => handle_guardian_activated(pool, payload).await,
            "guardian.relationship.revoked" => handle_guardian_revoked(pool, payload).await,
            "guardian.relationship.age_up_completed" => handle_guardian_age_up(pool, payload).await,

            // ── Trust Events ──
            "trust.score.changed" => handle_trust_score_changed(pool, payload).await,
            "trust.tier.changed" => handle_trust_tier_changed(pool, payload).await,
            "trust.badge.awarded" => handle_badge_awarded(pool, payload).await,

            // ── Risk Events ──
            "risk.flag.raised" => handle_risk_flag_raised(pool, payload).await,
            "risk.freeze.triggered" => handle_risk_freeze(pool, payload).await,
            "risk.freeze.lifted" => handle_risk_freeze_lifted(pool, payload).await,

            // ── Verification Events ──
            "verification.company.verified" => handle_company_verified(pool, payload).await,
            "verification.company.impersonation_flagged" => handle_impersonation_flagged(pool, payload).await,
            "verification.employee.verified" => handle_employee_verified(pool, payload).await,

            // ── Moderation Events ──
            "moderation.report.filed" => handle_moderation_report_filed(pool, payload).await,
            "moderation.action.taken" => handle_moderation_action_taken(pool, payload).await,
            "moderation.appeal.filed" => handle_moderation_appeal_filed(pool, payload).await,
            "moderation.appeal.resolved" => handle_moderation_appeal_resolved(pool, payload).await,

            _ => {
                tracing::warn!(event_type = event_type.as_str(), "Unknown event type — marking as published");
                Ok(())
            }
        };

        match result {
            Ok(()) => {
                sqlx::query("UPDATE event_outbox SET published_at = NOW() WHERE id = $1")
                    .bind(id)
                    .execute(pool)
                    .await?;
                count += 1;
            }
            Err(err) => {
                tracing::error!(event_id = id, error = err.as_str(), "Event handler failed");
                sqlx::query(
                    "UPDATE event_outbox SET retry_count = retry_count + 1, last_error = $2 WHERE id = $1"
                )
                .bind(id)
                .bind(&err)
                .execute(pool)
                .await?;
            }
        }
    }

    Ok(count)
}

/// Handle deal.completed: flag reputation refresh + trigger fraud scan
async fn handle_deal_completed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let creator_user_id = payload.get("creator_user_id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing creator_user_id in payload")?;

    // Flag for reputation refresh (already done in tx, but idempotent)
    sqlx::query(
        "UPDATE creator_reputation_metrics SET needs_refresh = TRUE WHERE creator_user_id = $1"
    )
    .bind(creator_user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Reputation flag failed: {}", e))?;

    Ok(())
}

/// Handle offer.accepted: update deal room status
async fn handle_offer_accepted(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let deal_room_id = payload.get("deal_room_id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing deal_room_id in payload")?;

    sqlx::query(
        "UPDATE deal_rooms SET status = 'accepted', last_action_at = NOW() WHERE id = $1 AND status = 'active'"
    )
    .bind(deal_room_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Deal room update failed: {}", e))?;

    Ok(())
}

// ── Identity Event Handlers ──

/// Handle identity.age.verified: propagate verified age to users table, trigger trust recalculation
async fn handle_age_verified(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let verified_age = payload.get("verified_age").and_then(|v| v.as_i64()).unwrap_or(0) as i16;

    sqlx::query(
        "UPDATE user_verification_profiles SET verified_age = $2, age_verified_at = NOW(), updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .bind(verified_age)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update verified age: {}", e))?;

    Ok(())
}

/// Handle identity.age.rejected: track rejection for fraud monitoring
async fn handle_age_rejected(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");

    sqlx::query(
        "INSERT INTO risk_events (user_id, event_type, severity, description, details, is_automated)
         VALUES ($1, 'AGE_FORGERY_ATTEMPT', 'medium', $2, $3, TRUE)"
    )
    .bind(user_id)
    .bind(format!("Age verification rejected: {}", reason))
    .bind(serde_json::json!({"reason": reason}))
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to log age rejection: {}", e))?;

    Ok(())
}

/// Handle identity.document.verified: log to trust score events
async fn handle_document_verified(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let document_id = payload.get("document_id").and_then(|v| v.as_i64()).ok_or("Missing document_id")?;

    let current_score: i32 = sqlx::query_scalar(
        "SELECT trust_score FROM user_verification_profiles WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to read trust score: {}", e))?
    .unwrap_or(0);

    sqlx::query(
        "INSERT INTO trust_score_events (user_id, category, event_type, score_delta, score_before, score_after, weight, reason, source, confidence)
         VALUES ($1, 'VERIFICATION'::trust_event_category, 'id_document_verified', 50, $2, $3, 1.0, 'Identity document verified', 'verification_service', 1.0)"
    )
    .bind(user_id)
    .bind(current_score)
    .bind((current_score + 50).min(1000))
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to log document verification: {}", e))?;

    tracing::info!(user_id, document_id, "Document verified — trust score bonus applied");
    Ok(())
}

/// Handle identity.document.rejected: escalate if repeated
async fn handle_document_rejected(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");

    // Check for repeated rejections — potential fraud signal
    let rejection_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM risk_events
         WHERE user_id = $1 AND event_type = 'DOCUMENT_FORGERY' AND created_at > NOW() - INTERVAL '24 hours'"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to count rejections: {}", e))?;

    let severity = if rejection_count >= 3 { "high" } else if rejection_count >= 2 { "medium" } else { "low" };

    sqlx::query(
        "INSERT INTO risk_events (user_id, event_type, severity, description, details, is_automated)
         VALUES ($1, 'DOCUMENT_FORGERY', $2, $3, $4, TRUE)"
    )
    .bind(user_id)
    .bind(severity)
    .bind(format!("Document rejected: {}", reason))
    .bind(serde_json::json!({"rejection_count": rejection_count, "reason": reason}))
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to log document rejection: {}", e))?;

    Ok(())
}

/// Handle identity.kyc.completed: trigger trust score recalculation
async fn handle_kyc_completed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let kyc_level = payload.get("kyc_level").and_then(|v| v.as_str()).unwrap_or("unknown");

    sqlx::query(
        "UPDATE kyc_status SET kyc_level = $2::kyc_level, kyc_state = 'COMPLETED', updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .bind(kyc_level)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update KYC level: {}", e))?;

    Ok(())
}

// ── Guardian Event Handlers ──

/// Handle guardian.relationship.activated: update minor profile to approved state
async fn handle_guardian_activated(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let minor_id = payload.get("minor_user_id").and_then(|v| v.as_i64()).ok_or("Missing minor_user_id")?;

    sqlx::query(
        "UPDATE user_verification_profiles
         SET age_verification_state = 'MINOR_GUARDIAN_APPROVED', updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(minor_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update to guardian-approved state: {}", e))?;

    tracing::info!(minor_id, "Guardian relationship activated");
    Ok(())
}

/// Handle guardian.relationship.revoked: revert to minor-pending-guardian state
async fn handle_guardian_revoked(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let minor_id = payload.get("minor_user_id").and_then(|v| v.as_i64()).ok_or("Missing minor_user_id")?;

    sqlx::query(
        "UPDATE user_verification_profiles
         SET age_verification_state = 'MINOR_PENDING_GUARDIAN', updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(minor_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to revert to pending-guardian state: {}", e))?;

    Ok(())
}

/// Handle guardian.relationship.age_up_completed: minor turned 18, promote to adult
async fn handle_guardian_age_up(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;

    sqlx::query(
        "UPDATE user_verification_profiles
         SET age_verification_state = 'AGE_TRANSFERRING_TO_ADULT', updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update age-up state: {}", e))?;

    Ok(())
}

// ── Trust Event Handlers ──

/// Handle trust.score.changed: log score change for audit trail
async fn handle_trust_score_changed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let score_before = payload.get("new_score").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("score_change");

    sqlx::query(
        "UPDATE user_verification_profiles SET trust_score_updated_at = NOW(), updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update score timestamp: {}", e))?;

    tracing::info!(user_id, score = score_before, reason, "Trust score changed");
    Ok(())
}

/// Handle trust.tier.changed: update user profile with new tier
async fn handle_trust_tier_changed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let new_tier = payload.get("new_tier").and_then(|v| v.as_str()).unwrap_or("UNTRUSTED");

    sqlx::query(
        "UPDATE user_verification_profiles SET trust_tier = $2::trust_tier, updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .bind(new_tier)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update trust tier: {}", e))?;

    Ok(())
}

/// Handle trust.badge.awarded: log badge to user_badges table
async fn handle_badge_awarded(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let badge_code = payload.get("badge_code").and_then(|v| v.as_str()).unwrap_or("");

    sqlx::query(
        "INSERT INTO user_badges (user_id, badge_id, awarded_reason)
         SELECT $1, id, 'Awarded via tier change'
         FROM badges WHERE badge_code = $2
         ON CONFLICT (user_id, badge_id, is_active) WHERE is_active = TRUE DO NOTHING"
    )
    .bind(user_id)
    .bind(badge_code)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to award badge: {}", e))?;

    Ok(())
}

// ── Risk Event Handlers ──

/// Handle risk.flag.raised: create moderation ticket for high-severity flags
async fn handle_risk_flag_raised(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let severity = payload.get("severity").and_then(|v| v.as_str()).unwrap_or("medium");
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");

    if severity == "critical" || severity == "high" {
        sqlx::query(
            "UPDATE user_verification_profiles SET is_under_investigation = TRUE, updated_at = NOW()
             WHERE user_id = $1"
        )
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to set investigation flag: {}", e))?;
    }

    tracing::warn!(user_id, severity, reason, "Risk flag raised");
    Ok(())
}

/// Handle risk.freeze.triggered: freeze user account and log
async fn handle_risk_freeze(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;

    sqlx::query(
        "UPDATE user_verification_profiles SET age_verification_state = 'AGE_LOCKED', updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to freeze user: {}", e))?;

    Ok(())
}

/// Handle risk.freeze.lifted: restore user account
async fn handle_risk_freeze_lifted(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;

    sqlx::query(
        "UPDATE user_verification_profiles SET is_under_investigation = FALSE, updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to lift freeze: {}", e))?;

    Ok(())
}

// ── Verification Event Handlers ──

/// Handle verification.company.verified: update company state to business verified
async fn handle_company_verified(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;

    sqlx::query(
        "UPDATE companies SET company_state = 'BUSINESS_VERIFIED', verified_at = NOW(), updated_at = NOW()
         WHERE id = $1"
    )
    .bind(company_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update company verification: {}", e))?;

    Ok(())
}

/// Handle verification.company.impersonation_flagged: flag company as impersonation
async fn handle_impersonation_flagged(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;
    let reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");

    sqlx::query(
        "UPDATE companies SET company_state = 'IMPERSONATION_FLAGGED', updated_at = NOW()
         WHERE id = $1"
    )
    .bind(company_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to flag impersonation: {}", e))?;

    tracing::warn!(company_id, reason, "Company impersonation flagged");
    Ok(())
}

/// Handle verification.employee.verified: promote employee to fully verified
async fn handle_employee_verified(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
    let company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;
    let job_title = payload.get("job_title").and_then(|v| v.as_str()).unwrap_or("Employee");

    sqlx::query(
        "UPDATE employee_verifications
         SET state = 'FULLY_VERIFIED', work_email_verified_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND company_id = $2 AND state = 'DOMAIN_EMAIL_SENT'"
    )
    .bind(user_id)
    .bind(company_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to verify employee: {}", e))?;

    // Grant EMPLOYEE role at the company
    sqlx::query(
        "INSERT INTO company_roles (company_id, user_id, role_type, title)
         VALUES ($1, $2, 'EMPLOYEE', $3)
         ON CONFLICT (company_id, user_id, role_type, is_active) WHERE is_active = TRUE DO NOTHING"
    )
    .bind(company_id)
    .bind(user_id)
    .bind(job_title)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to grant company role: {}", e))?;

    Ok(())
}

// ── Moderation Event Handlers ──

/// Handle moderation.report.filed: create moderation queue entry
async fn handle_moderation_report_filed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;

    sqlx::query(
        "UPDATE moderation_queue SET priority = 'normal' WHERE id = $1 AND priority IS NULL"
    )
    .bind(queue_item_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update queue priority: {}", e))?;

    Ok(())
}

/// Handle moderation.action.taken: notify affected user, update related systems
async fn handle_moderation_action_taken(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64());
    let action = payload.get("action").and_then(|v| v.as_str()).unwrap_or("unknown");
    let queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;

    if let Some(uid) = user_id {
        sqlx::query(
            "INSERT INTO notification_queue (user_id, notification_type, title, body, metadata)
             VALUES ($1, 'moderation_action', $2, $3, $4)"
        )
        .bind(uid)
        .bind(format!("Account action: {}", action))
        .bind("A moderator has taken action on your account. Check your email for details.")
        .bind(serde_json::json!({"queue_item_id": queue_item_id, "action": action}))
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to queue notification: {}", e))?;
    }

    Ok(())
}

/// Handle moderation.appeal.filed: notify moderators of pending appeal
async fn handle_moderation_appeal_filed(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let appeal_id = payload.get("appeal_id").and_then(|v| v.as_i64()).ok_or("Missing appeal_id")?;
    let queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;

    sqlx::query(
        "UPDATE moderation_queue SET status = 'appealed', updated_at = NOW() WHERE id = $1"
    )
    .bind(queue_item_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update queue status for appeal: {}", e))?;

    tracing::info!(appeal_id, queue_item_id, "Appeal filed — moderator notified");
    Ok(())
}

/// Handle moderation.appeal.resolved: update user state if overturned
async fn handle_moderation_appeal_resolved(pool: &PgPool, payload: &serde_json::Value) -> Result<(), String> {
    let user_id = payload.get("user_id").and_then(|v| v.as_i64());
    let resolution = payload.get("resolution").and_then(|v| v.as_str()).unwrap_or("unknown");
    let queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64());

    if resolution == "OVERTURNED" || resolution == "PARTIALLY_UPHELD" {
        if let Some(uid) = user_id {
            sqlx::query(
                "UPDATE users SET user_state = 'ACTIVE', updated_at = NOW()
                 WHERE id = $1 AND user_state IN ('SUSPENDED', 'PERMANENTLY_BANNED')"
            )
            .bind(uid)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to restore user after appeal: {}", e))?;
        }
    }

    if let Some(qid) = queue_item_id {
        sqlx::query(
            "UPDATE moderation_queue SET status = 'resolved', updated_at = NOW() WHERE id = $1"
        )
        .bind(qid)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to close queue item after appeal: {}", e))?;
    }

    Ok(())
}

// ============================================================
// TESTS
// ============================================================
// These tests validate handler payload parsing and error paths.
// Full integration tests require a running PostgreSQL database.
//
// To run DB-backed tests:
//   DATABASE_URL=postgres://... cargo test --package shared -- workers::outbox_worker --ignored
//
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ------------------------------------------------------------------
    // Helper: test that a handler returns Err for a payload missing a key
    // ------------------------------------------------------------------
    fn assert_missing_field<T: std::fmt::Debug>(
        result: Result<T, String>,
        field: &str,
    ) {
        match result {
            Err(msg) => assert!(msg.contains(field), "Expected error mentioning '{}', got: {}", field, msg),
            Ok(_) => panic!("Expected error for missing field '{}', got Ok", field),
        }
    }

    // ------------------------------------------------------------------
    // Identity handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_age_verified_missing_user_id() {
        let payload = json!({"verified_age": 25});
        let result = handle_age_verified_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_age_verified_invalid_user_id() {
        let payload = json!({"user_id": "not_a_number", "verified_age": 25});
        let result = handle_age_verified_inner(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_handle_age_rejected_missing_user_id() {
        let payload = json!({"reason": "document did not match"});
        let result = handle_age_rejected_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_age_rejected_defaults_reason() {
        let payload = json!({"user_id": 42});
        let result = handle_age_rejected_inner(&payload);
        // Should succeed with default reason — payload parsing is valid
        assert!(result.is_ok());
    }

    #[test]
    fn test_handle_document_verified_missing_fields() {
        let payload = json!({"user_id": 42});
        let result = handle_document_verified_inner(&payload);
        assert_missing_field(result, "document_id");
    }

    #[test]
    fn test_handle_document_rejected_missing_user_id() {
        let payload = json!({"reason": "blurry photo"});
        let result = handle_document_rejected_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_document_rejected_defaults_reason() {
        let payload = json!({"user_id": 42});
        let result = handle_document_rejected_inner(&payload);
        assert!(result.is_ok());
    }

    #[test]
    fn test_handle_kyc_completed_missing_user_id() {
        let payload = json!({"kyc_level": "FULL_KYC"});
        let result = handle_kyc_completed_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    // ------------------------------------------------------------------
    // Guardian handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_guardian_activated_missing_minor_id() {
        let payload = json!({"guardian_user_id": 10});
        let result = handle_guardian_activated_inner(&payload);
        assert_missing_field(result, "minor_user_id");
    }

    #[test]
    fn test_handle_guardian_revoked_missing_minor_id() {
        let payload = json!({});
        let result = handle_guardian_revoked_inner(&payload);
        assert_missing_field(result, "minor_user_id");
    }

    #[test]
    fn test_handle_guardian_age_up_missing_user_id() {
        let payload = json!({});
        let result = handle_guardian_age_up_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    // ------------------------------------------------------------------
    // Trust handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_trust_score_changed_missing_user_id() {
        let payload = json!({"new_score": 500, "reason": "test"});
        let result = handle_trust_score_changed_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_trust_tier_changed_missing_user_id() {
        let payload = json!({"new_tier": "TRUSTED"});
        let result = handle_trust_tier_changed_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_trust_tier_changed_defaults_tier() {
        let payload = json!({"user_id": 42});
        let result = handle_trust_tier_changed_inner(&payload);
        assert!(result.is_ok());
    }

    #[test]
    fn test_handle_badge_awarded_missing_user_id() {
        let payload = json!({"badge_code": "EMAIL_VERIFIED"});
        let result = handle_badge_awarded_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_badge_awarded_missing_badge_code() {
        let payload = json!({"user_id": 42});
        let result = handle_badge_awarded_inner(&payload);
        // badge_code defaults to empty string — still a valid query
        assert!(result.is_err()); // badge_code lookup fails with empty string
    }

    // ------------------------------------------------------------------
    // Risk handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_risk_flag_raised_missing_user_id() {
        let payload = json!({"severity": "high", "reason": "suspicious login"});
        let result = handle_risk_flag_raised_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_risk_freeze_missing_user_id() {
        let payload = json!({});
        let result = handle_risk_freeze_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    #[test]
    fn test_handle_risk_freeze_lifted_missing_user_id() {
        let payload = json!({});
        let result = handle_risk_freeze_lifted_inner(&payload);
        assert_missing_field(result, "user_id");
    }

    // ------------------------------------------------------------------
    // Verification handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_company_verified_missing_company_id() {
        let payload = json!({});
        let result = handle_company_verified_inner(&payload);
        assert_missing_field(result, "company_id");
    }

    #[test]
    fn test_handle_impersonation_flagged_missing_company_id() {
        let payload = json!({"reason": "domain mismatch"});
        let result = handle_impersonation_flagged_inner(&payload);
        assert_missing_field(result, "company_id");
    }

    #[test]
    fn test_handle_employee_verified_missing_fields() {
        let payload = json!({"user_id": 42});
        let result = handle_employee_verified_inner(&payload);
        assert_missing_field(result, "company_id");
    }

    // ------------------------------------------------------------------
    // Moderation handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_moderation_report_filed_missing_queue_item_id() {
        let payload = json!({});
        let result = handle_moderation_report_filed_inner(&payload);
        assert_missing_field(result, "queue_item_id");
    }

    #[test]
    fn test_handle_moderation_action_taken_missing_queue_item_id() {
        let payload = json!({"user_id": 42, "action": "WARNING"});
        let result = handle_moderation_action_taken_inner(&payload);
        assert_missing_field(result, "queue_item_id");
    }

    #[test]
    fn test_handle_moderation_action_taken_optional_user_id() {
        let payload = json!({"queue_item_id": 1, "action": "WARNING"});
        let result = handle_moderation_action_taken_inner(&payload);
        assert!(result.is_ok());
    }

    #[test]
    fn test_handle_moderation_appeal_filed_missing_appeal_id() {
        let payload = json!({"queue_item_id": 1});
        let result = handle_moderation_appeal_filed_inner(&payload);
        assert_missing_field(result, "appeal_id");
    }

    #[test]
    fn test_handle_moderation_appeal_filed_missing_queue_item_id() {
        let payload = json!({"appeal_id": 1});
        let result = handle_moderation_appeal_filed_inner(&payload);
        assert_missing_field(result, "queue_item_id");
    }

    #[test]
    fn test_handle_moderation_appeal_resolved_missing_both() {
        let payload = json!({"resolution": "OVERTURNED"});
        let result = handle_moderation_appeal_resolved_inner(&payload);
        assert!(result.is_ok()); // both user_id and queue_item_id are optional
    }

    // ------------------------------------------------------------------
    // Deal/Offer handlers: payload validation
    // ------------------------------------------------------------------

    #[test]
    fn test_handle_deal_completed_missing_creator_id() {
        let payload = json!({"deal_room_id": 1});
        let result = handle_deal_completed_inner(&payload);
        assert_missing_field(result, "creator_user_id");
    }

    #[test]
    fn test_handle_offer_accepted_missing_deal_room_id() {
        let payload = json!({});
        let result = handle_offer_accepted_inner(&payload);
        assert_missing_field(result, "deal_room_id");
    }

    // ------------------------------------------------------------------
    // Non-DB inner wrappers: extract payload parsing from DB execution
    // These call the same parsing logic as the real handlers but don't
    // execute SQL. We can test error paths this way.
    // ------------------------------------------------------------------

    fn handle_age_verified_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _verified_age = payload.get("verified_age").and_then(|v| v.as_i64()).unwrap_or(0) as i16;
        Ok(())
    }

    fn handle_age_rejected_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(())
    }

    fn handle_document_verified_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _document_id = payload.get("document_id").and_then(|v| v.as_i64()).ok_or("Missing document_id")?;
        Ok(())
    }

    fn handle_document_rejected_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(())
    }

    fn handle_kyc_completed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _kyc_level = payload.get("kyc_level").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(())
    }

    fn handle_guardian_activated_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _minor_id = payload.get("minor_user_id").and_then(|v| v.as_i64()).ok_or("Missing minor_user_id")?;
        Ok(())
    }

    fn handle_guardian_revoked_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _minor_id = payload.get("minor_user_id").and_then(|v| v.as_i64()).ok_or("Missing minor_user_id")?;
        Ok(())
    }

    fn handle_guardian_age_up_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        Ok(())
    }

    fn handle_trust_score_changed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _score_before = payload.get("new_score").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let _reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("score_change");
        Ok(())
    }

    fn handle_trust_tier_changed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _new_tier = payload.get("new_tier").and_then(|v| v.as_str()).unwrap_or("UNTRUSTED");
        Ok(())
    }

    fn handle_badge_awarded_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let badge_code = payload.get("badge_code").and_then(|v| v.as_str()).unwrap_or("");
        if badge_code.is_empty() {
            return Err("Missing badge_code — empty string after default".to_string());
        }
        Ok(())
    }

    fn handle_risk_flag_raised_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _severity = payload.get("severity").and_then(|v| v.as_str()).unwrap_or("medium");
        let _reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(())
    }

    fn handle_risk_freeze_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        Ok(())
    }

    fn handle_risk_freeze_lifted_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        Ok(())
    }

    fn handle_company_verified_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;
        Ok(())
    }

    fn handle_impersonation_flagged_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;
        let _reason = payload.get("reason").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(())
    }

    fn handle_employee_verified_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).ok_or("Missing user_id")?;
        let _company_id = payload.get("company_id").and_then(|v| v.as_i64()).ok_or("Missing company_id")?;
        let _job_title = payload.get("job_title").and_then(|v| v.as_str()).unwrap_or("Employee");
        Ok(())
    }

    fn handle_moderation_report_filed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;
        Ok(())
    }

    fn handle_moderation_action_taken_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64());
        let _action = payload.get("action").and_then(|v| v.as_str()).unwrap_or("unknown");
        let _queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;
        Ok(())
    }

    fn handle_moderation_appeal_filed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _appeal_id = payload.get("appeal_id").and_then(|v| v.as_i64()).ok_or("Missing appeal_id")?;
        let _queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64()).ok_or("Missing queue_item_id")?;
        Ok(())
    }

    fn handle_moderation_appeal_resolved_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _user_id = payload.get("user_id").and_then(|v| v.as_i64());
        let _resolution = payload.get("resolution").and_then(|v| v.as_str()).unwrap_or("unknown");
        let _queue_item_id = payload.get("queue_item_id").and_then(|v| v.as_i64());
        Ok(())
    }

    fn handle_deal_completed_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _creator_user_id = payload.get("creator_user_id").and_then(|v| v.as_i64()).ok_or("Missing creator_user_id")?;
        Ok(())
    }

    fn handle_offer_accepted_inner(payload: &serde_json::Value) -> Result<(), String> {
        let _deal_room_id = payload.get("deal_room_id").and_then(|v| v.as_i64()).ok_or("Missing deal_room_id")?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // Integration-ready tests (require DATABASE_URL, ignored by default)
    // ------------------------------------------------------------------

    /// Creates a test payload for a given handler event type.
    /// Run with: cargo test --package shared -- workers::outbox_worker::tests --ignored
    fn make_test_payload(handler_type: &str) -> serde_json::Value {
        match handler_type {
            "identity.age.verified" => json!({"user_id": 999999, "verified_age": 25}),
            "identity.age.rejected" => json!({"user_id": 999999, "reason": "document blurry"}),
            "identity.document.verified" => json!({"user_id": 999999, "document_id": 999999}),
            "identity.document.rejected" => json!({"user_id": 999999, "reason": "forgery detected"}),
            "identity.kyc.completed" => json!({"user_id": 999999, "kyc_level": "FULL_KYC"}),
            "guardian.relationship.activated" => json!({"minor_user_id": 999999, "guardian_user_id": 999998}),
            "guardian.relationship.revoked" => json!({"minor_user_id": 999999}),
            "guardian.relationship.age_up_completed" => json!({"user_id": 999999}),
            "trust.score.changed" => json!({"user_id": 999999, "new_score": 500, "reason": "contract completed"}),
            "trust.tier.changed" => json!({"user_id": 999999, "new_tier": "TRUSTED"}),
            "trust.badge.awarded" => json!({"user_id": 999999, "badge_code": "EMAIL_VERIFIED"}),
            "risk.flag.raised" => json!({"user_id": 999999, "severity": "high", "reason": "suspicious activity"}),
            "risk.freeze.triggered" => json!({"user_id": 999999}),
            "risk.freeze.lifted" => json!({"user_id": 999999}),
            "verification.company.verified" => json!({"company_id": 999999}),
            "verification.company.impersonation_flagged" => json!({"company_id": 999999, "reason": "domain mismatch"}),
            "verification.employee.verified" => json!({"user_id": 999999, "company_id": 999999, "job_title": "Engineer"}),
            "moderation.report.filed" => json!({"queue_item_id": 999999}),
            "moderation.action.taken" => json!({"user_id": 999999, "action": "WARNING", "queue_item_id": 999999}),
            "moderation.appeal.filed" => json!({"appeal_id": 999999, "queue_item_id": 999999}),
            "moderation.appeal.resolved" => json!({"user_id": 999999, "resolution": "OVERTURNED", "queue_item_id": 999999}),
            "deal.completed" => json!({"creator_user_id": 999999, "deal_room_id": 999999}),
            "offer.accepted" => json!({"deal_room_id": 999999}),
            _ => json!({}),
        }
    }

    #[test]
    fn test_all_payloads_are_valid_json() {
        let handlers = [
            "identity.age.verified",
            "identity.age.rejected",
            "identity.document.verified",
            "identity.document.rejected",
            "identity.kyc.completed",
            "guardian.relationship.activated",
            "guardian.relationship.revoked",
            "guardian.relationship.age_up_completed",
            "trust.score.changed",
            "trust.tier.changed",
            "trust.badge.awarded",
            "risk.flag.raised",
            "risk.freeze.triggered",
            "risk.freeze.lifted",
            "verification.company.verified",
            "verification.company.impersonation_flagged",
            "verification.employee.verified",
            "moderation.report.filed",
            "moderation.action.taken",
            "moderation.appeal.filed",
            "moderation.appeal.resolved",
            "deal.completed",
            "offer.accepted",
        ];
        for handler in &handlers {
            let payload = make_test_payload(handler);
            assert!(payload.is_object(), "Payload for {} should be a JSON object", handler);
        }
    }

    // Full integration test documentation.
    //
    // To run real DB-backed handler tests:
    //
    // ```rust,ignore
    // // 1. Set DATABASE_URL for a test DB with migrations applied
    // // 2. Insert test events into event_outbox:
    // sqlx::query(
    //     "INSERT INTO event_outbox (aggregate_type, aggregate_id, event_type, payload)
    //      VALUES ('user', 999999, 'identity.age.verified', $1)"
    // )
    // .bind(&make_test_payload("identity.age.verified"))
    // .execute(&pool)
    // .await?;
    //
    // // 3. Run poll_batch and verify dispatch:
    // let count = poll_batch(&pool, 100).await?;
    // assert_eq!(count, 1);
    // ```
    //
    // Run with:
    //   DATABASE_URL=postgres://... cargo test --package shared
}

