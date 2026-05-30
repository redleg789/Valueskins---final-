-- LinkedIn Community Invitations: ValueSkin-gated community invites.
-- sender invites recipient to a specific community.
-- UNIQUE constraint prevents duplicate pending invitations.

CREATE TABLE IF NOT EXISTS linkedin_invitations (
    id                  BIGSERIAL PRIMARY KEY,
    sender_user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id        BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    reason              TEXT,
    status              VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
    responded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sender_user_id <> recipient_user_id)
);

-- Prevent duplicate pending invitations for the same user+community pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_inv_unique_pending
    ON linkedin_invitations(sender_user_id, recipient_user_id, community_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_linkedin_inv_recipient
    ON linkedin_invitations(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_inv_community
    ON linkedin_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_inv_pending
    ON linkedin_invitations(status) WHERE status = 'pending';
