-- Platform Fee System
-- Provider-agnostic: works with Stripe, Razorpay, or any payment provider
-- Default fee: flat $1.50 per transaction (configurable)

-- Active fee configuration (singleton — one active row at a time)
CREATE TABLE IF NOT EXISTS platform_fee_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type        TEXT NOT NULL CHECK (fee_type IN ('flat', 'percentage', 'hybrid')),
  flat_fee_cents  BIGINT NOT NULL DEFAULT 150,
  percentage_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  min_fee_cents   BIGINT,
  max_fee_cents   BIGINT,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-provider fee overrides (optional — uses platform default if no row)
CREATE TABLE IF NOT EXISTS provider_fee_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay', 'meta_pay', 'custom')),
  fee_type        TEXT CHECK (fee_type IN ('flat', 'percentage', 'hybrid')),
  flat_fee_cents  BIGINT,
  percentage_rate NUMERIC(5,2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider)
);

-- Collected platform fees per transaction
CREATE TABLE IF NOT EXISTS platform_fees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      TEXT NOT NULL,
  provider            TEXT NOT NULL,
  gross_amount_cents  BIGINT NOT NULL,
  fee_cents           BIGINT NOT NULL,
  net_amount_cents    BIGINT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'collected', 'refunded', 'failed')),
  payer_id            TEXT,
  payee_id            TEXT,
  event_id            TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at        TIMESTAMPTZ
);

-- Transaction ledger (agnostic view across all providers)
CREATE TABLE IF NOT EXISTS transaction_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id         TEXT,                              -- provider's transaction ID
  provider            TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('payment', 'payout', 'refund', 'fee')),
  amount_cents        BIGINT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  gross_amount_cents  BIGINT,
  fee_cents           BIGINT,
  net_amount_cents    BIGINT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
  payer_id            TEXT,
  payee_id            TEXT,
  event_id            TEXT,
  idempotency_key     TEXT,
  description         TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default fee config: flat $1.50
INSERT INTO platform_fee_config (fee_type, flat_fee_cents, percentage_rate, description)
VALUES ('flat', 150, 0.00, 'Default platform fee: flat $1.50 per transaction')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_fees_transaction ON platform_fees(transaction_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_status ON platform_fees(status);
CREATE INDEX IF NOT EXISTS idx_platform_fees_event ON platform_fees(event_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_payee ON platform_fees(payee_id);

CREATE INDEX IF NOT EXISTS idx_transaction_ledger_external ON transaction_ledger(external_id);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_status ON transaction_ledger(status);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_event ON transaction_ledger(event_id);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_payee ON transaction_ledger(payee_id);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_idempotency ON transaction_ledger(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_provider_fee_configs_provider ON provider_fee_configs(provider);
