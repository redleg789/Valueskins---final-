-- Deal Room Messages Schema
-- Append-only immutable audit log for all deal room communications.
-- sender_user_id verified by JWT (server-assigned), no UPDATE/DELETE permitted.
-- server_timestamp assigned by DB (not client-provided).

CREATE TABLE IF NOT EXISTS deal_room_messages (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    sender_user_id      BIGINT NOT NULL REFERENCES users(id),
    message_type        TEXT NOT NULL DEFAULT 'text'
                           CHECK (message_type IN ('text','system','offer_made','offer_accepted','offer_rejected','counter_offer','contract_signed','deliverable_uploaded','escrow_released','deal_completed','deal_cancelled')),
    content             TEXT NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 5000),
    server_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutability: deny UPDATE and DELETE at the rule level
CREATE OR REPLACE RULE deny_update_deal_room_messages AS
    ON UPDATE TO deal_room_messages DO INSTEAD NOTHING;
CREATE OR REPLACE RULE deny_delete_deal_room_messages AS
    ON DELETE TO deal_room_messages DO INSTEAD NOTHING;

-- Index for efficient chronological fetches per room
CREATE INDEX IF NOT EXISTS idx_drm_room_ts ON deal_room_messages(deal_room_id, server_timestamp ASC);

-- Index for cursor-based pagination (id < $before_id)
CREATE INDEX IF NOT EXISTS idx_drm_room_id ON deal_room_messages(deal_room_id, id DESC);

-- Index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_drm_sender ON deal_room_messages(sender_user_id, server_timestamp DESC);
