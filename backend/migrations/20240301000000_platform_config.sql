-- Platform configuration table
-- Stores admin-configurable settings that affect the entire platform.
-- Single row (id=1), updated in-place via admin panel.
-- Append-only audit log preserves all historical values.

CREATE TABLE IF NOT EXISTS platform_config (
    id                              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Enforces single row
    platform_name                   VARCHAR(100)  NOT NULL DEFAULT 'ValueSkins',
    platform_fee_percentage         NUMERIC(5,2)  NOT NULL DEFAULT 5.00 CHECK (platform_fee_percentage BETWEEN 0 AND 100),
    min_payout_amount               NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    max_payout_amount               NUMERIC(10,2) NOT NULL DEFAULT 50000.00,
    payout_currency                 VARCHAR(3)    NOT NULL DEFAULT 'USD',
    notification_email_from         VARCHAR(255)  NOT NULL DEFAULT 'noreply@valueskins.app',
    support_contact_email           VARCHAR(255)  NOT NULL DEFAULT 'support@valueskins.app',
    terms_of_service_url            VARCHAR(500)  NOT NULL DEFAULT 'https://valueskins.app/tos',
    privacy_policy_url              VARCHAR(500)  NOT NULL DEFAULT 'https://valueskins.app/privacy',
    max_creator_applications_per_day INTEGER      NOT NULL DEFAULT 50 CHECK (max_creator_applications_per_day > 0),
    max_brand_opportunities_per_day  INTEGER      NOT NULL DEFAULT 10 CHECK (max_brand_opportunities_per_day > 0),
    gdpr_compliance_days            INTEGER       NOT NULL DEFAULT 30,
    enable_kyc                      BOOLEAN       NOT NULL DEFAULT FALSE,
    kyc_provider                    VARCHAR(20)   NOT NULL DEFAULT 'none' CHECK (kyc_provider IN ('none','stripe','plaid','sumsub')),
    enable_csuite_advantage         BOOLEAN       NOT NULL DEFAULT TRUE,
    csuite_enforcement_type         VARCHAR(20)   NOT NULL DEFAULT 'level_boost' CHECK (csuite_enforcement_type IN ('level_boost','price_multiplier','both','none')),
    enable_campaign_gating          BOOLEAN       NOT NULL DEFAULT TRUE,
    enable_communities              BOOLEAN       NOT NULL DEFAULT TRUE,
    enable_dispute_resolution       BOOLEAN       NOT NULL DEFAULT TRUE,
    enable_brand_verification       BOOLEAN       NOT NULL DEFAULT TRUE,
    maintenance_mode_enabled        BOOLEAN       NOT NULL DEFAULT FALSE,
    maintenance_mode_message        TEXT          NOT NULL DEFAULT '',
    updated_by                      BIGINT        REFERENCES users(id),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed default row — runs once, ignored on re-run
INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Audit log: every change to platform_config is recorded here
CREATE TABLE IF NOT EXISTS platform_config_audit (
    id          BIGSERIAL   PRIMARY KEY,
    changed_by  BIGINT      REFERENCES users(id),
    field_name  VARCHAR(100) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_config_audit_field ON platform_config_audit(field_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_config_audit_user  ON platform_config_audit(changed_by, changed_at DESC);

-- Trigger: auto-populate audit log on every UPDATE
CREATE OR REPLACE FUNCTION audit_platform_config_changes()
RETURNS TRIGGER AS $$
DECLARE
    col_name TEXT;
    old_val  TEXT;
    new_val  TEXT;
BEGIN
    FOREACH col_name IN ARRAY ARRAY[
        'platform_name','platform_fee_percentage','min_payout_amount','max_payout_amount',
        'payout_currency','notification_email_from','support_contact_email',
        'terms_of_service_url','privacy_policy_url',
        'max_creator_applications_per_day','max_brand_opportunities_per_day',
        'gdpr_compliance_days','enable_kyc','kyc_provider',
        'enable_csuite_advantage','csuite_enforcement_type',
        'enable_campaign_gating','enable_communities',
        'enable_dispute_resolution','enable_brand_verification',
        'maintenance_mode_enabled','maintenance_mode_message'
    ]
    LOOP
        EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
        EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;
        IF old_val IS DISTINCT FROM new_val THEN
            INSERT INTO platform_config_audit (changed_by, field_name, old_value, new_value)
            VALUES (NEW.updated_by, col_name, old_val, new_val);
        END IF;
    END LOOP;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_audit_platform_config
BEFORE UPDATE ON platform_config
FOR EACH ROW EXECUTE FUNCTION audit_platform_config_changes();
