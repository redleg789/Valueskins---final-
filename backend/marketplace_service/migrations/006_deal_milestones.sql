-- Migration 006: Deal milestones for escrow
CREATE TABLE IF NOT EXISTS deal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_structure_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  percentage INT NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  release_condition VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (deal_structure_id) REFERENCES deal_structures(id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_milestones_deal ON deal_milestones(deal_structure_id);
