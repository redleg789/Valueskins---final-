-- Migration 004: Payment-gated ratings
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id INT NOT NULL,
  rater_user_id INT NOT NULL,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  review TEXT,
  payment_status_required VARCHAR DEFAULT 'completed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (deal_room_id) REFERENCES deal_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_ratings_deal_room ON ratings(deal_room_id);
CREATE INDEX idx_ratings_rater ON ratings(rater_user_id);
CREATE INDEX idx_ratings_created ON ratings(created_at);
