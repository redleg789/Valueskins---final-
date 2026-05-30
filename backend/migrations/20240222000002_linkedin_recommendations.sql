-- LinkedIn Recommendations: Verified endorsements tied to a specific profession.
-- recommender must hold the same profession ValueSkin (enforced at service layer).
-- rating is 1.0–5.0 with one decimal precision.

CREATE TABLE IF NOT EXISTS linkedin_recommendations (
    id                      BIGSERIAL PRIMARY KEY,
    recommender_user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profession              VARCHAR(255) NOT NULL,
    rating                  NUMERIC(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    testimonial             TEXT,
    verified_at             TIMESTAMPTZ,
    is_public               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (recommender_user_id <> recipient_user_id),
    UNIQUE (recommender_user_id, recipient_user_id, profession)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_rec_recipient
    ON linkedin_recommendations(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_rec_profession
    ON linkedin_recommendations(profession);
CREATE INDEX IF NOT EXISTS idx_linkedin_rec_verified
    ON linkedin_recommendations(verified_at, is_public) WHERE verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_linkedin_rec_composite
    ON linkedin_recommendations(recipient_user_id, profession, verified_at DESC);

CREATE TRIGGER trg_linkedin_recommendations_updated_at
    BEFORE UPDATE ON linkedin_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
