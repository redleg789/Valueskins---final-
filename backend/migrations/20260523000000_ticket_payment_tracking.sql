-- 20260523000000: Track Razorpay-backed ticket payments and platform fees

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_order_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_account_label TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_payment_ref ON tickets(payment_ref);
CREATE INDEX IF NOT EXISTS idx_tickets_payment_order_ref ON tickets(payment_order_ref);
