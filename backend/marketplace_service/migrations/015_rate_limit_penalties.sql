-- Migration 015: Rate limit penalties and cooldowns
CREATE TABLE IF NOT EXISTS rate_limit_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL,
  endpoint VARCHAR NOT NULL,
  penalty_type VARCHAR NOT NULL,
  penalty_until TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_rate_limit_penalties_user ON rate_limit_penalties(user_id);
CREATE INDEX idx_rate_limit_penalties_endpoint ON rate_limit_penalties(endpoint);
CREATE INDEX idx_rate_limit_penalties_until ON rate_limit_penalties(penalty_until);
