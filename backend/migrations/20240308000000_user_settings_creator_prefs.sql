-- Add creator preference columns to user_settings table.
-- These persist settings page choices: international deals, payment split,
-- posting rules, deal preferences, and advance preferences.

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS allow_international_deals BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS payment_advance_pct SMALLINT NOT NULL DEFAULT 30
        CHECK (payment_advance_pct >= 0 AND payment_advance_pct <= 100);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS payment_after_submission_pct SMALLINT NOT NULL DEFAULT 50
        CHECK (payment_after_submission_pct >= 0 AND payment_after_submission_pct <= 100);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS payment_performance_pct SMALLINT NOT NULL DEFAULT 20
        CHECK (payment_performance_pct >= 0 AND payment_performance_pct <= 100);

ALTER TABLE user_settings
    ADD CONSTRAINT chk_user_payment_split_sum
    CHECK (payment_advance_pct + payment_after_submission_pct + payment_performance_pct = 100);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS payment_plan_negotiable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS creator_requires_advance BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS creator_advance_pct_wanted SMALLINT NOT NULL DEFAULT 30
        CHECK (creator_advance_pct_wanted >= 0 AND creator_advance_pct_wanted <= 100);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS creator_advance_negotiable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS posting_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS exclusivity_available BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS willing_to_sign_nda BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS willing_to_sign_usage_rights BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS min_deal_size_usd TEXT NOT NULL DEFAULT '';

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS response_time_hours TEXT NOT NULL DEFAULT '';

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS product_preference TEXT NOT NULL DEFAULT '';

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS location_country TEXT NOT NULL DEFAULT '';

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS willing_to_travel BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS willing_to_appear_at_events BOOLEAN NOT NULL DEFAULT FALSE;
