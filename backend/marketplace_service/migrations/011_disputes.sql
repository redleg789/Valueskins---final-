-- Migration 011: Dispute resolution system
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id INT NOT NULL,
  initiated_by_user_id INT NOT NULL,
  respondent_user_id INT NOT NULL,
  dispute_type VARCHAR NOT NULL CHECK (dispute_type IN ('non_delivery', 'quality_issue', 'payment_dispute', 'contract_violation')),
  claim_description TEXT NOT NULL,
  evidence_urls JSONB,
  status VARCHAR NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'arbitrator_assigned', 'resolved')),
  arbitrator_user_id INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (deal_room_id) REFERENCES deal_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (initiated_by_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (respondent_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (arbitrator_user_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_disputes_deal_room ON disputes(deal_room_id);
CREATE INDEX idx_disputes_initiator ON disputes(initiated_by_user_id);
CREATE INDEX idx_disputes_status ON disputes(status);
