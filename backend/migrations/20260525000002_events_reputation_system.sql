-- Events Reputation System
-- Links events to creator/brand profiles for history & reputation tracking

-- Events table (if not already exists)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(50) CHECK (event_type IN ('workshop', 'meetup', 'conference', 'concert', 'other')),
    ticket_price DECIMAL(10, 2),
    max_attendees INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);

-- Event Attendees (users who purchased tickets)
CREATE TABLE IF NOT EXISTS event_attendees (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    attendee_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_purchase_id VARCHAR(255), -- Razorpay payment ID
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attended BOOLEAN DEFAULT FALSE, -- Mark if they actually attended
    attended_at TIMESTAMPTZ,
    UNIQUE(event_id, attendee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(attendee_user_id);

-- Event Reviews (attendees rate the event & host)
CREATE TABLE IF NOT EXISTS event_reviews (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    reviewer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    host_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    -- Separate ratings for different aspects
    host_professionalism INT CHECK (host_professionalism >= 1 AND host_professionalism <= 5),
    event_quality INT CHECK (event_quality >= 1 AND event_quality <= 5),
    overall_experience INT CHECK (overall_experience >= 1 AND overall_experience <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, reviewer_user_id) -- One review per attendee per event
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_event ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_host ON event_reviews(host_user_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_reviewer ON event_reviews(reviewer_user_id);

-- Creator/Brand Reputation Aggregates (cached for fast display)
CREATE TABLE IF NOT EXISTS user_reputation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Event-based reputation
    events_hosted INT DEFAULT 0,
    events_attended INT DEFAULT 0,
    -- Ratings (average)
    avg_host_professionalism DECIMAL(3, 2) DEFAULT 0, -- 0-5
    avg_event_quality DECIMAL(3, 2) DEFAULT 0, -- 0-5
    avg_overall_experience DECIMAL(3, 2) DEFAULT 0, -- 0-5
    avg_rating DECIMAL(3, 2) DEFAULT 0, -- Overall average
    total_reviews INT DEFAULT 0,
    -- Other metrics (from marketplace)
    deals_completed INT DEFAULT 0,
    avg_deal_rating DECIMAL(3, 2) DEFAULT 0,
    -- Trust score (0-100)
    trust_score INT DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reputation_user ON user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reputation_score ON user_reputation(trust_score DESC);

-- History Table (audit trail of all activities)
CREATE TABLE IF NOT EXISTS user_activity_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'event_hosted',
        'event_attended',
        'event_reviewed',
        'deal_completed',
        'profile_updated',
        'valueskin_added',
        'review_received'
    )),
    entity_id BIGINT, -- ID of the event, deal, etc.
    entity_type VARCHAR(50), -- 'event', 'deal', 'review'
    description TEXT,
    metadata JSONB, -- Additional context (e.g., rating, amount, etc.)
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON user_activity_history(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_history(activity_type);

-- Function to update reputation when review is added
CREATE OR REPLACE FUNCTION update_user_reputation_on_review()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_reputation SET
        total_reviews = (SELECT COUNT(*) FROM event_reviews WHERE host_user_id = NEW.host_user_id),
        avg_host_professionalism = (SELECT AVG(host_professionalism) FROM event_reviews WHERE host_user_id = NEW.host_user_id AND host_professionalism IS NOT NULL),
        avg_event_quality = (SELECT AVG(event_quality) FROM event_reviews WHERE host_user_id = NEW.host_user_id AND event_quality IS NOT NULL),
        avg_overall_experience = (SELECT AVG(overall_experience) FROM event_reviews WHERE host_user_id = NEW.host_user_id AND overall_experience IS NOT NULL),
        avg_rating = (SELECT AVG(rating) FROM event_reviews WHERE host_user_id = NEW.host_user_id),
        last_updated_at = NOW()
    WHERE user_id = NEW.host_user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reputation_on_review
AFTER INSERT OR UPDATE ON event_reviews
FOR EACH ROW EXECUTE FUNCTION update_user_reputation_on_review();

-- Function to calculate trust score
CREATE OR REPLACE FUNCTION calculate_trust_score(user_id BIGINT)
RETURNS INT AS $$
DECLARE
    score INT := 0;
    avg_rating DECIMAL;
    events_hosted INT;
    total_reviews INT;
BEGIN
    SELECT
        COALESCE(avg_rating, 0),
        COALESCE(events_hosted, 0),
        COALESCE(total_reviews, 0)
    INTO avg_rating, events_hosted, total_reviews
    FROM user_reputation
    WHERE user_id = user_id;

    -- Base score: 0-60 from average rating (5.0 = 60, 3.0 = 36, 1.0 = 12)
    score := LEAST(60, GREATEST(0, (avg_rating * 12)::INT));

    -- Activity score: 0-25 from events hosted
    score := score + LEAST(25, events_hosted * 2);

    -- Review count bonus: 0-15 for having reviews
    IF total_reviews > 0 THEN
        score := score + LEAST(15, (total_reviews / 5)::INT);
    END IF;

    RETURN LEAST(100, score);
END;
$$ LANGUAGE plpgsql;

-- Function to create activity history entry
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id BIGINT,
    p_activity_type VARCHAR,
    p_entity_id BIGINT,
    p_entity_type VARCHAR,
    p_description TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_activity_history (user_id, activity_type, entity_id, entity_type, description, metadata)
    VALUES (p_user_id, p_activity_type, p_entity_id, p_entity_type, p_description, p_metadata);
END;
$$ LANGUAGE plpgsql;

-- Initialize reputation for existing users
INSERT INTO user_reputation (user_id)
SELECT DISTINCT id FROM users
ON CONFLICT (user_id) DO NOTHING;
