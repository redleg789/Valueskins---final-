-- Add image_uri to professions table for dynamic ValueSkin display
-- Allows admin to update sticker images without deploying code

ALTER TABLE professions
ADD COLUMN IF NOT EXISTS image_uri TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for frequently accessed images
CREATE INDEX IF NOT EXISTS idx_prof_image ON professions(is_active) WHERE is_active = TRUE;

-- Seed default images for existing professions
-- In production, these can be updated via admin API without code changes
UPDATE professions SET image_uri = '/badges/camera-badge.svg' WHERE name = 'Content Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/palette-badge.svg' WHERE name = 'Art Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/scales-badge.svg' WHERE name = 'Law Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/caduceus-badge.svg' WHERE name = 'Medical Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/controller-badge.svg' WHERE name = 'Gaming Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/circuit-badge.svg' WHERE name = 'Tech Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/briefcase-badge.svg' WHERE name = 'Finance Creator' AND image_uri IS NULL;
UPDATE professions SET image_uri = '/badges/dumbbell-badge.svg' WHERE name = 'Fitness Creator' AND image_uri IS NULL;
