-- Migration 008: Negotiation attempt tracking for lowball detection
CREATE TABLE IF NOT EXISTS negotiation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL,
  deal_id INT NOT NULL,
  is_lowball BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_negotiation_attempts_user ON negotiation_attempts(user_id);
CREATE INDEX idx_negotiation_attempts_deal ON negotiation_attempts(deal_id);
CREATE INDEX idx_negotiation_attempts_lowball ON negotiation_attempts(is_lowball);
