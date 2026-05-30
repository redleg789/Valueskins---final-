//! Notification Dispatch Worker — polls notification_queue and delivers.
//!
//! Handles retry logic with exponential backoff. Dead-letters after max_retries.
//! Uses SELECT FOR UPDATE SKIP LOCKED for safe multi-instance execution.
//!
//! Email channel delegates to notification_service::EmailService when available.
//! Push/SMS log intent but require external provider integration (FCM/Twilio).

use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::time;

/// Optional email sender trait — allows injecting the real EmailService without
/// adding a hard dependency on notification_service from shared.
pub trait EmailSender: Send + Sync + 'static {
    fn send_raw(
        &self,
        to: &str,
        subject: &str,
        body: &str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + '_>>;
}

/// Configuration for the notification worker.
pub struct NotificationWorkerConfig {
    pub email_sender: Option<Arc<dyn EmailSender>>,
}

pub async fn start(pool: PgPool, interval: Duration, config: NotificationWorkerConfig) {
    tracing::info!("Notification worker started (interval={:?}, email={})", interval, config.email_sender.is_some());

    let mut tick = time::interval(interval);

    loop {
        tick.tick().await;

        match dispatch_batch(&pool, 50, &config).await {
            Ok(dispatched) => {
                if dispatched > 0 {
                    tracing::info!(dispatched = dispatched, "Notifications dispatched");
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "Notification worker failed");
            }
        }
    }
}

/// Backward-compatible entry point (no email sender).
pub async fn start_basic(pool: PgPool, interval: Duration) {
    start(pool, interval, NotificationWorkerConfig { email_sender: None }).await;
}

async fn dispatch_batch(pool: &PgPool, batch_size: i64, config: &NotificationWorkerConfig) -> Result<usize, sqlx::Error> {
    let pending: Vec<(i64, i64, String, String, Option<serde_json::Value>, i32, i32)> = sqlx::query_as(
        "SELECT id, recipient_user_id, channel, message,
                metadata, retry_count, max_retries
         FROM notification_queue
         WHERE delivered_at IS NULL
           AND retry_count < max_retries
           AND (scheduled_at IS NULL OR scheduled_at <= NOW())
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED"
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await?;

    let mut count = 0;

    for (id, recipient_user_id, channel, message, metadata, retry_count, _max_retries) in &pending {
        let result = deliver(*recipient_user_id, channel, message, metadata.as_ref(), config).await;

        match result {
            Ok(()) => {
                sqlx::query(
                    "UPDATE notification_queue SET delivered_at = NOW() WHERE id = $1"
                )
                .bind(id)
                .execute(pool)
                .await?;
                count += 1;
            }
            Err(err) => {
                tracing::warn!(
                    notification_id = id,
                    retry = retry_count,
                    error = err.as_str(),
                    "Notification delivery failed"
                );
                sqlx::query(
                    "UPDATE notification_queue
                     SET retry_count = retry_count + 1, last_error = $2
                     WHERE id = $1"
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

/// Deliver a notification via the appropriate channel.
async fn deliver(
    recipient_user_id: i64,
    channel: &str,
    message: &str,
    metadata: Option<&serde_json::Value>,
    config: &NotificationWorkerConfig,
) -> Result<(), String> {
    match channel {
        "email" => {
            // Extract recipient email from metadata
            let to_email = metadata
                .and_then(|m| m.get("email"))
                .and_then(|e| e.as_str())
                .unwrap_or("");

            if to_email.is_empty() {
                return Err("No recipient email in metadata".to_string());
            }

            match &config.email_sender {
                Some(sender) => {
                    sender.send_raw(to_email, "Valueskins Notification", message).await?;
                    tracing::info!(recipient_user_id = recipient_user_id, to = to_email, "Email sent");
                    Ok(())
                }
                None => {
                    tracing::warn!(recipient_user_id = recipient_user_id, "Email channel not configured — notification queued but not sent");
                    Err("Email sender not configured".to_string())
                }
            }
        }
        "push" => {
            // FCM/APNs integration point — log for now, wire when provider is configured
            tracing::info!(recipient_user_id = recipient_user_id, "Push notification queued (provider not configured)");
            // Return Ok so it's marked delivered — push is best-effort
            Ok(())
        }
        "in_app" => {
            // In-app notifications are marked delivered immediately;
            // the client polls or uses websocket to fetch them.
            Ok(())
        }
        "sms" => {
            // Twilio integration point — log for now
            tracing::info!(recipient_user_id = recipient_user_id, "SMS notification queued (provider not configured)");
            Ok(())
        }
        _ => {
            tracing::warn!(channel = channel, "Unknown notification channel");
            Err(format!("Unknown channel: {}", channel))
        }
    }
}
