-- Escrow Dispute Resolution Schema
-- Enables dispute raising and resolution on deal room escrow stages

CREATE TABLE IF NOT EXISTS escrow_disputes (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    escrow_stage_id     BIGINT NOT NULL REFERENCES escrow_stages(id) ON DELETE CASCADE,
    raised_by_user_id   BIGINT NOT NULL REFERENCES users(id),
    against_user_id     BIGINT NOT NULL REFERENCES users(id),
    reason              TEXT NOT NULL,
    evidence_urls       TEXT[] DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'under_review', 'resolved_creator', 'resolved_brand', 'resolved_split', 'dismissed')),
    resolution_notes    TEXT,
    resolved_by_user_id BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    UNIQUE(escrow_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_disputes_deal_room ON escrow_disputes(deal_room_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON escrow_disputes(raised_by_user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_against ON escrow_disputes(against_user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON escrow_disputes(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON escrow_disputes(created_at DESC);
