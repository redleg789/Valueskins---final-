-- Add is_default column to user_valueskins
ALTER TABLE user_valueskins 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Add is_default column to brand_valueskins
ALTER TABLE brand_valueskins 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Create audit logging table for ValueSkin changes
CREATE TABLE IF NOT EXISTS valueskin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valueskin_id UUID NOT NULL REFERENCES user_valueskins(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'auto_created_on_registration'
  old_values JSONB, -- Store previous values on update
  new_values JSONB, -- Store new values on update
  changed_fields TEXT[], -- Array of field names that changed
  changed_by VARCHAR(255), -- User agent or system identifier
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address INET, -- Optional: IP address of change requester
  
  -- Indexes for fast queries
  CONSTRAINT valueskin_audit_log_user_id_idx UNIQUE (id)
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_valueskin_audit_log_user_id ON valueskin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_valueskin_audit_log_valueskin_id ON valueskin_audit_log(valueskin_id);
CREATE INDEX IF NOT EXISTS idx_valueskin_audit_log_changed_at ON valueskin_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_valueskin_audit_log_action ON valueskin_audit_log(action);

-- Ensure at most one default ValueSkin per user (for creators)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_valueskins_default_unique 
ON user_valueskins(user_id) 
WHERE is_default = TRUE AND is_deleted IS FALSE;

-- Ensure at most one default ValueSkin per user (for brands)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_valueskins_default_unique 
ON brand_valueskins(user_id) 
WHERE is_default = TRUE AND is_deleted IS FALSE;
