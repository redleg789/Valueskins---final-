-- Migration: Add unique ValueSkin ID to user_stickers
-- Each purchased ValueSkin gets a unique, searchable ID (VS-XXXXXXXX)

ALTER TABLE user_stickers
ADD COLUMN IF NOT EXISTS valueskin_code VARCHAR(20) UNIQUE;

-- Generate valueskin codes for existing records
UPDATE user_stickers
SET valueskin_code = 'VS-' || SUBSTR(id::text, 1, 8) || '-' || SUBSTR(id::text, 10, 4)
WHERE valueskin_code IS NULL;

-- Create index for fast searches
CREATE INDEX IF NOT EXISTS idx_user_stickers_code ON user_stickers(valueskin_code);

-- Function to generate unique valueskin code
CREATE OR REPLACE FUNCTION generate_valueskin_code()
RETURNS VARCHAR AS $$
DECLARE
  code VARCHAR(20);
BEGIN
  -- Generate code in format VS-XXXXXXXX-XXXX
  code := 'VS-' || SUBSTR(MD5(RANDOM()::text || NOW()::text), 1, 8) || '-' || SUBSTR(MD5(RANDOM()::text), 1, 4);

  -- Ensure uniqueness
  WHILE EXISTS(SELECT 1 FROM user_stickers WHERE valueskin_code = code) LOOP
    code := 'VS-' || SUBSTR(MD5(RANDOM()::text || NOW()::text), 1, 8) || '-' || SUBSTR(MD5(RANDOM()::text), 1, 4);
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;
