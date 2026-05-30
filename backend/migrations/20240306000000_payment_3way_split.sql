-- Payment Plan: 3-Way Split (Advance / After Submission / Performance)
-- Replaces the old 2-way advance/performance model.
-- All three percentages must sum to exactly 100.

-- Drop old constraints that enforced 2-way model
ALTER TABLE deal_room_payment_preferences
    DROP CONSTRAINT IF EXISTS chk_perf_clause_consistency;

ALTER TABLE deal_room_payment_preferences
    DROP CONSTRAINT IF EXISTS deal_room_payment_preferences_advance_pct_check;

-- Change default and range for advance_pct (now 0-100 instead of 70-100)
ALTER TABLE deal_room_payment_preferences
    ALTER COLUMN advance_pct SET DEFAULT 30;

ALTER TABLE deal_room_payment_preferences
    ADD CONSTRAINT chk_advance_pct_range CHECK (advance_pct >= 0 AND advance_pct <= 100);

-- Add new columns
ALTER TABLE deal_room_payment_preferences
    ADD COLUMN IF NOT EXISTS after_submission_pct SMALLINT NOT NULL DEFAULT 50
        CHECK (after_submission_pct >= 0 AND after_submission_pct <= 100);

ALTER TABLE deal_room_payment_preferences
    ADD COLUMN IF NOT EXISTS performance_pct SMALLINT NOT NULL DEFAULT 20
        CHECK (performance_pct >= 0 AND performance_pct <= 100);

-- Enforce: all three must sum to exactly 100
ALTER TABLE deal_room_payment_preferences
    ADD CONSTRAINT chk_payment_split_sum
    CHECK (advance_pct + after_submission_pct + performance_pct = 100);

-- Index for quick lookups by deal room
-- (Primary key already indexes deal_room_id, but explicit for clarity)
