-- Deal Room Payment Preferences
-- Stores advance % and performance clause settings per deal room.
-- Server enforces: advance_pct between 70 and 100 (max 30% performance clause).

CREATE TABLE IF NOT EXISTS deal_room_payment_preferences (
    deal_room_id                BIGINT PRIMARY KEY REFERENCES deal_rooms(id) ON DELETE CASCADE,
    advance_pct                 SMALLINT NOT NULL DEFAULT 100
                                   CHECK (advance_pct >= 70 AND advance_pct <= 100),
    performance_clause_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id          BIGINT NOT NULL REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce: if performance clause disabled, advance must be 100%
ALTER TABLE deal_room_payment_preferences
    ADD CONSTRAINT chk_perf_clause_consistency
    CHECK (performance_clause_enabled = TRUE OR advance_pct = 100);
