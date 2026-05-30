-- Migration 009: User loyalty levels (7-tier system)
CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL UNIQUE,
  current_level INT NOT NULL DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 7),
  current_tier VARCHAR NOT NULL DEFAULT 'Newcomer',
  deal_streak INT DEFAULT 0,
  reputation_score INT DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_levels_user ON user_levels(user_id);
CREATE INDEX idx_user_levels_tier ON user_levels(current_tier);
