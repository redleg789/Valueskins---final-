-- Migration 001: Contact leak attempts tracking
CREATE TABLE IF NOT EXISTS contact_leak_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id INT NOT NULL,
  detected_patterns JSONB NOT NULL,
  original_message_hash VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (deal_room_id) REFERENCES deal_rooms(id) ON DELETE CASCADE
);

CREATE INDEX idx_contact_leaks_deal_room ON contact_leak_attempts(deal_room_id);
CREATE INDEX idx_contact_leaks_timestamp ON contact_leak_attempts(timestamp);
