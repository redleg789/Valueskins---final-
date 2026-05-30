-- Production-readiness migration: indexes for hot query paths + version column
-- for optimistic concurrency on payment preferences.
--
-- Each index is justified below with the query it supports and why it matters at scale.

-- ── Rate limiting index ────────────────────────────────────────────────────────
-- Supports: SELECT COUNT(*) FROM deal_room_messages
--             WHERE sender_user_id = $1 AND server_timestamp > NOW() - INTERVAL '1 minute'
-- Without this index, every message send does a sequential scan of all messages
-- from this sender. At 1M+ messages this is a full-table scan per POST request.
CREATE INDEX IF NOT EXISTS idx_drm_sender_recent
    ON deal_room_messages(sender_user_id, server_timestamp DESC);

-- ── Payment preferences indexes ───────────────────────────────────────────────
-- Supports audit queries: "which preferences did user X change recently?"
-- Used by admin tooling and dispute resolution workflows.
CREATE INDEX IF NOT EXISTS idx_drpp_updated_by_user
    ON deal_room_payment_preferences(updated_by_user_id, updated_at DESC);

-- Partial index: only rows where performance clause is active.
-- Supports analytics queries filtering by performance_clause_enabled = TRUE.
-- Partial index keeps it small — most deals likely don't use performance clauses.
CREATE INDEX IF NOT EXISTS idx_drpp_perf_enabled
    ON deal_room_payment_preferences(performance_clause_enabled, created_at DESC)
    WHERE performance_clause_enabled = TRUE;

-- ── Optimistic concurrency: version column ─────────────────────────────────────
-- Added to deal_room_payment_preferences to detect concurrent writes.
-- Default 1 so existing rows get a valid starting version (not 0, which is
-- the sentinel used by GET to signal "no preferences saved yet").
ALTER TABLE deal_room_payment_preferences
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- ── Notification queue: cascade delete performance ────────────────────────────
-- Supports: DELETE FROM notification_queue WHERE recipient_user_id = $1
-- and: SELECT ... WHERE recipient_user_id = $1 ORDER BY created_at DESC
-- Without this, user data deletion scans the entire notification_queue table.
CREATE INDEX IF NOT EXISTS idx_notif_queue_recipient
    ON notification_queue(recipient_user_id);

-- ── Deal room messages: ID-based cursor pagination ────────────────────────────
-- Supports: SELECT ... FROM deal_room_messages
--             WHERE deal_room_id = $1 AND id > $2
--             ORDER BY id ASC LIMIT $3
-- The composite (deal_room_id, id ASC) index enables index-only scans for
-- the corrected cursor pagination query in messages.rs. Without this,
-- PostgreSQL falls back to a seq scan + sort per page fetch.
CREATE INDEX IF NOT EXISTS idx_drm_deal_room_id_asc
    ON deal_room_messages(deal_room_id, id ASC);
