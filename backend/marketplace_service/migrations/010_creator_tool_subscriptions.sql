-- Migration 010: Creator tools monetization
CREATE TABLE IF NOT EXISTS creator_tool_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL,
  tool_type VARCHAR NOT NULL,
  cost_per_month INT NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_creator_tool_subscriptions_user ON creator_tool_subscriptions(user_id);
CREATE INDEX idx_creator_tool_subscriptions_tool ON creator_tool_subscriptions(tool_type);
CREATE INDEX idx_creator_tool_subscriptions_active ON creator_tool_subscriptions(ended_at);
