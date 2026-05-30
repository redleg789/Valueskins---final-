-- Notification queue for async event processing.
-- Background workers poll, dispatch, and mark delivered.
-- Uses SELECT FOR UPDATE SKIP LOCKED for safe multi-instance consumption.

CREATE TABLE IF NOT EXISTS notification_queue (
    id                  BIGSERIAL PRIMARY KEY,
    recipient_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL DEFAULT 'in_app'
                           CHECK (channel IN ('email','push','in_app','sms')),
    event_type          TEXT NOT NULL,
    message             TEXT NOT NULL,
    metadata            JSONB,
    retry_count         INT NOT NULL DEFAULT 0,
    max_retries         INT NOT NULL DEFAULT 3,
    delivered_at        TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    last_error          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Undelivered notifications ordered by creation (worker poll query)
CREATE INDEX IF NOT EXISTS idx_notif_queue_pending
    ON notification_queue(created_at)
    WHERE delivered_at IS NULL AND retry_count < max_retries;

-- Per-recipient lookup
CREATE INDEX IF NOT EXISTS idx_notif_queue_recipient
    ON notification_queue(recipient_user_id, created_at DESC);

-- Scheduled notifications that are due
CREATE INDEX IF NOT EXISTS idx_notif_queue_scheduled
    ON notification_queue(scheduled_at)
    WHERE delivered_at IS NULL AND scheduled_at IS NOT NULL;
