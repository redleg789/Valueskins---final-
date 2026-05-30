-- Migration 007: Deal negotiation tracking
CREATE TABLE IF NOT EXISTS deal_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_structure_id UUID NOT NULL,
  proposer_user_id INT NOT NULL,
  change_field VARCHAR NOT NULL,
  current_value JSONB,
  proposed_value JSONB,
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (deal_structure_id) REFERENCES deal_structures(id) ON DELETE CASCADE,
  FOREIGN KEY (proposer_user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_negotiations_deal ON deal_negotiations(deal_structure_id);
CREATE INDEX idx_deal_negotiations_proposer ON deal_negotiations(proposer_user_id);
