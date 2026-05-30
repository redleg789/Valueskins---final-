-- Migration 012: Dispute resolution outcomes
CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL,
  arbitrator_user_id INT NOT NULL,
  ruling TEXT NOT NULL,
  payout_adjustment INT,
  remediation TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
  FOREIGN KEY (arbitrator_user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_dispute_resolutions_dispute ON dispute_resolutions(dispute_id);
CREATE INDEX idx_dispute_resolutions_arbitrator ON dispute_resolutions(arbitrator_user_id);
