-- Migration 014: API request tracking for rate limiting
CREATE TABLE IF NOT EXISTS api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT,
  endpoint VARCHAR NOT NULL,
  ip_address VARCHAR NOT NULL,
  user_agent VARCHAR,
  parameters JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_requests_user ON api_requests(user_id);
CREATE INDEX idx_api_requests_endpoint ON api_requests(endpoint);
CREATE INDEX idx_api_requests_ip ON api_requests(ip_address);
CREATE INDEX idx_api_requests_timestamp ON api_requests(timestamp);
