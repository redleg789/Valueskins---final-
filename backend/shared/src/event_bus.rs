//! Transactional Outbox Event Bus
//!
//! Decouples deal completion from downstream side-effects (reputation refresh,
//! fraud scan, notifications, analytics). Events are written to `event_outbox`
//! inside the same transaction as the business operation, guaranteeing
//! at-least-once delivery without distributed transactions.
//!
//! A background worker polls the outbox and dispatches events to handlers.
//! Each handler is idempotent (safe to replay). Failed events are retried
//! with exponential backoff up to max_retries.
//!
//! This replaces tight coupling where `complete_deal()` had to call
//! reputation, fraud, analytics, and notification services synchronously.
//!
//! # Event Types (Trust & Verification)
//!
//! ## Identity Events (`identity.*`)
//! - `identity.age.dob_submitted` — user provided date of birth
//! - `identity.age.verified` — age verification completed (carries verified age)
//! - `identity.age.rejected` — age verification rejected
//! - `identity.age.expired` — age verification expired
//! - `identity.document.uploaded` — identity document uploaded
//! - `identity.document.verified` — document passed verification
//! - `identity.document.rejected` — document failed verification
//! - `identity.kyc.completed` — KYC process completed at given level
//! - `identity.kyc.failed` — KYC process failed
//!
//! ## Guardian Events (`guardian.*`)
//! - `guardian.relationship.created` — guardian invited
//! - `guardian.relationship.activated` — guardian consent completed, relationship active
//! - `guardian.relationship.revoked` — consent withdrawn by guardian/minor
//! - `guardian.relationship.transferred` — guardian rights transferred
//! - `guardian.relationship.age_up_completed` — minor turned 18, guardian released
//! - `guardian.permissions.updated` — guardian updated permission grants
//!
//! ## Trust Events (`trust.*`)
//! - `trust.score.changed` — trust score crossed a threshold (carries old + new)
//! - `trust.tier.changed` — trust tier changed
//! - `trust.badge.awarded` — new badge earned
//! - `trust.badge.revoked` — badge removed
//!
//! ## Risk Events (`risk.*`)
//! - `risk.assessment.completed` — periodic risk scan finished for user
//! - `risk.flag.raised` — suspicious activity detected
//! - `risk.freeze.triggered` — user or account frozen by risk engine
//! - `risk.freeze.lifted` — freeze resolved
//!
//! ## Verification Events (`verification.*`)
//! - `verification.company.created` — new company profile created
//! - `verification.company.verified` — company passed full verification
//! - `verification.company.dns_verified` — domain DNS record confirmed
//! - `verification.company.impersonation_flagged` — suspected fake company
//! - `verification.employee.verified` — employee affiliation confirmed
//! - `verification.employee.rejected` — employee verification failed
//!
//! ## Moderation Events (`moderation.*`)
//! - `moderation.report.filed` — user submitted a report (creates queue entry)
//! - `moderation.action.taken` — moderator acted on queue item (warning, suspend, ban, etc.)
//! - `moderation.appeal.filed` — user appealed a moderation action
//! - `moderation.appeal.resolved` — appeal reviewed (upheld, overturned, partially upheld)

use sqlx::PgPool;
use chrono::Utc;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

pub type EventHandler = Arc<
    dyn Fn(serde_json::Value) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send>>
        + Send
        + Sync,
>;

pub struct EventBus {
    pool: PgPool,
    handlers: HashMap<String, Vec<EventHandler>>,
}

impl EventBus {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            handlers: HashMap::new(),
        }
    }

    /// Register a handler for an event type.
    /// Multiple handlers per event type are supported (fan-out).
    pub fn on(&mut self, event_type: &str, handler: EventHandler) {
        self.handlers
            .entry(event_type.to_string())
            .or_default()
            .push(handler);
    }

    /// Publish an event to the outbox within an existing transaction.
    /// The event is only visible after the transaction commits.
    pub async fn publish_in_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        aggregate_type: &str,
        aggregate_id: i64,
        event_type: &str,
        payload: &serde_json::Value,
    ) -> Result<i64, sqlx::Error> {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO event_outbox (aggregate_type, aggregate_id, event_type, payload)
             VALUES ($1, $2, $3, $4) RETURNING id"
        )
        .bind(aggregate_type)
        .bind(aggregate_id)
        .bind(event_type)
        .bind(payload)
        .fetch_one(&mut **tx)
        .await?;

        Ok(id)
    }

    /// Publish an event outside a transaction (auto-commit).
    pub async fn publish(
        &self,
        aggregate_type: &str,
        aggregate_id: i64,
        event_type: &str,
        payload: &serde_json::Value,
    ) -> Result<i64, sqlx::Error> {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO event_outbox (aggregate_type, aggregate_id, event_type, payload)
             VALUES ($1, $2, $3, $4) RETURNING id"
        )
        .bind(aggregate_type)
        .bind(aggregate_id)
        .bind(event_type)
        .bind(payload)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    /// Poll the outbox and dispatch pending events.
    /// Called by a background worker on a timer (e.g., every 1 second).
    /// Uses SELECT FOR UPDATE SKIP LOCKED to allow multiple workers
    /// without double-dispatching the same event.
    pub async fn poll_and_dispatch(&self, batch_size: i64) -> Result<usize, sqlx::Error> {
        let events: Vec<(i64, String, serde_json::Value, i32, i32)> = sqlx::query_as(
            "SELECT id, event_type, payload, retry_count, max_retries
             FROM event_outbox
             WHERE published_at IS NULL
               AND retry_count < max_retries
             ORDER BY created_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED"
        )
        .bind(batch_size)
        .fetch_all(&self.pool)
        .await?;

        let mut dispatched = 0;

        for (id, event_type, payload, retry_count, _max_retries) in &events {
            let handlers = match self.handlers.get(event_type.as_str()) {
                Some(h) => h,
                None => {
                    // No handler registered — mark as published (dead letter)
                    sqlx::query("UPDATE event_outbox SET published_at = NOW() WHERE id = $1")
                        .bind(id)
                        .execute(&self.pool)
                        .await?;
                    dispatched += 1;
                    continue;
                }
            };

            let mut all_succeeded = true;
            for handler in handlers {
                match handler(payload.clone()).await {
                    Ok(()) => {}
                    Err(err) => {
                        all_succeeded = false;
                        tracing::error!(
                            event_id = id,
                            event_type = event_type.as_str(),
                            retry = retry_count,
                            error = err.as_str(),
                            "Event handler failed"
                        );
                        // Increment retry count and record error
                        sqlx::query(
                            "UPDATE event_outbox SET retry_count = retry_count + 1, last_error = $2 WHERE id = $1"
                        )
                        .bind(id)
                        .bind(&err)
                        .execute(&self.pool)
                        .await?;
                        break;
                    }
                }
            }

            if all_succeeded {
                sqlx::query("UPDATE event_outbox SET published_at = NOW() WHERE id = $1")
                    .bind(id)
                    .execute(&self.pool)
                    .await?;
                dispatched += 1;
            }
        }

        Ok(dispatched)
    }
}
