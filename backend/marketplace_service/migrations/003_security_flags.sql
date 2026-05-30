-- Migration 003: Security flags for fraud detection
CREATE TABLE IF NOT EXISTS security_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL,
  flag_type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_security_flags_user ON security_flags(user_id);
CREATE INDEX idx_security_flags_severity ON security_flags(severity);
CREATE INDEX idx_security_flags_type ON security_flags(flag_type);
