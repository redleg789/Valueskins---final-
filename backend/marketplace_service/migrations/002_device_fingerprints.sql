-- Migration 002: Device fingerprinting for identity verification
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL,
  user_agent VARCHAR NOT NULL,
  ip_address VARCHAR NOT NULL,
  canvas_fingerprint VARCHAR,
  webgl_fingerprint VARCHAR,
  timezone VARCHAR,
  language VARCHAR,
  screen_resolution VARCHAR,
  device_memory INT,
  processor_count INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_ip ON device_fingerprints(ip_address);
CREATE INDEX idx_device_fingerprints_canvas ON device_fingerprints(canvas_fingerprint);
