-- Migration 005: Mandatory deal structure
CREATE TABLE IF NOT EXISTS deal_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id INT NOT NULL,
  brand_user_id INT NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  total_value_cents INT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'accepted', 'active', 'completed')),
  locked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (creator_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_structures_creator ON deal_structures(creator_user_id);
CREATE INDEX idx_deal_structures_brand ON deal_structures(brand_user_id);
CREATE INDEX idx_deal_structures_status ON deal_structures(status);
