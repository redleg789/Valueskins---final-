-- TRUST + VERIFICATION: SEED DATA
-- Country reference data, document requirements per country,
-- region-specific KYC configs, default verification routing rules.
-- Must be applied AFTER 20240401000000_trust_verification_core.sql.
--
-- This migration is idempotent — all INSERTs use ON CONFLICT DO NOTHING.

-- ============================================================
-- TABLE: countries
-- Reference data for all supported countries.
-- Used for KYC routing, document requirements, age-of-majority.
-- ============================================================

CREATE TABLE IF NOT EXISTS countries (
    country_code CHAR(2) PRIMARY KEY,              -- ISO 3166-1 alpha-2
    country_name VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL,                   -- 'north_america', 'europe', 'asia', 'latin_america', 'middle_east', 'africa', 'oceania'
    age_of_majority SMALLINT NOT NULL DEFAULT 18 CHECK (age_of_majority >= 16 AND age_of_majority <= 21),
    default_currency CHAR(3) NOT NULL DEFAULT 'USD',
    default_language VARCHAR(10) NOT NULL DEFAULT 'en',
    supported BOOLEAN NOT NULL DEFAULT TRUE,
    kyc_required BOOLEAN NOT NULL DEFAULT TRUE,
    enhanced_kyc_required BOOLEAN NOT NULL DEFAULT FALSE,  -- for high-risk jurisdictions
    gdpr_applies BOOLEAN NOT NULL DEFAULT FALSE,
    ccpa_applies BOOLEAN NOT NULL DEFAULT FALSE,
    sanctions_risk_level VARCHAR(20) NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    pep_checks_required BOOLEAN NOT NULL DEFAULT FALSE,      -- politically exposed person checks
    verification_days_valid INTEGER NOT NULL DEFAULT 365,    -- default verification validity period
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed all actively supported countries
INSERT INTO countries (country_code, country_name, region, age_of_majority, default_currency, default_language, supported, kyc_required, enhanced_kyc_required, gdpr_applies, ccpa_applies, sanctions_risk_level, pep_checks_required, verification_days_valid) VALUES
    -- North America
    ('US', 'United States', 'north_america', 18, 'USD', 'en', TRUE, TRUE, FALSE, FALSE, TRUE, 'medium', FALSE, 365),
    ('CA', 'Canada', 'north_america', 18, 'CAD', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('MX', 'Mexico', 'north_america', 18, 'MXN', 'es', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),

    -- Europe (GDPR applies to all EU/EEA)
    ('GB', 'United Kingdom', 'europe', 18, 'GBP', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('DE', 'Germany', 'europe', 18, 'EUR', 'de', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('FR', 'France', 'europe', 18, 'EUR', 'fr', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('IT', 'Italy', 'europe', 18, 'EUR', 'it', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('ES', 'Spain', 'europe', 18, 'EUR', 'es', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('NL', 'Netherlands', 'europe', 18, 'EUR', 'nl', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('SE', 'Sweden', 'europe', 18, 'SEK', 'sv', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('DK', 'Denmark', 'europe', 18, 'DKK', 'da', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('NO', 'Norway', 'europe', 18, 'NOK', 'nb', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('CH', 'Switzerland', 'europe', 18, 'CHF', 'de', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('IE', 'Ireland', 'europe', 18, 'EUR', 'en', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('BE', 'Belgium', 'europe', 18, 'EUR', 'nl', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('PT', 'Portugal', 'europe', 18, 'EUR', 'pt', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('PL', 'Poland', 'europe', 18, 'PLN', 'pl', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),
    ('AT', 'Austria', 'europe', 18, 'EUR', 'de', TRUE, TRUE, FALSE, TRUE, FALSE, 'low', FALSE, 365),

    -- Asia Pacific
    ('AU', 'Australia', 'oceania', 18, 'AUD', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('NZ', 'New Zealand', 'oceania', 18, 'NZD', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('JP', 'Japan', 'asia', 20, 'JPY', 'ja', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('KR', 'South Korea', 'asia', 19, 'KRW', 'ko', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('SG', 'Singapore', 'asia', 21, 'SGD', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'low', FALSE, 365),
    ('IN', 'India', 'asia', 18, 'INR', 'hi', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('AE', 'United Arab Emirates', 'middle_east', 18, 'AED', 'ar', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', TRUE, 365),
    ('IL', 'Israel', 'middle_east', 18, 'ILS', 'he', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('ZA', 'South Africa', 'africa', 18, 'ZAR', 'en', TRUE, TRUE, FALSE, FALSE, FALSE, 'high', TRUE, 365),

    -- Latin America
    ('BR', 'Brazil', 'latin_america', 18, 'BRL', 'pt', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('AR', 'Argentina', 'latin_america', 18, 'ARS', 'es', TRUE, TRUE, FALSE, FALSE, FALSE, 'high', FALSE, 365),
    ('CO', 'Colombia', 'latin_america', 18, 'COP', 'es', TRUE, TRUE, FALSE, FALSE, FALSE, 'high', FALSE, 365),

    -- Future / Limited Support
    ('HK', 'Hong Kong', 'asia', 18, 'HKD', 'zh', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('MY', 'Malaysia', 'asia', 18, 'MYR', 'ms', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('TH', 'Thailand', 'asia', 20, 'THB', 'th', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('VN', 'Vietnam', 'asia', 18, 'VND', 'vi', TRUE, TRUE, FALSE, FALSE, FALSE, 'high', FALSE, 365),
    ('PH', 'Philippines', 'asia', 18, 'PHP', 'fil', TRUE, TRUE, FALSE, FALSE, FALSE, 'medium', FALSE, 365),
    ('ID', 'Indonesia', 'asia', 18, 'IDR', 'id', TRUE, TRUE, FALSE, FALSE, FALSE, 'high', FALSE, 365),
    ('TR', 'Turkey', 'europe', 18, 'TRY', 'tr', TRUE, TRUE, TRUE, FALSE, FALSE, 'high', TRUE, 180),
    ('RU', 'Russia', 'europe', 18, 'RUB', 'ru', FALSE, TRUE, TRUE, FALSE, FALSE, 'critical', TRUE, 90),
    ('CN', 'China', 'asia', 18, 'CNY', 'zh', FALSE, TRUE, TRUE, FALSE, FALSE, 'critical', TRUE, 90)
ON CONFLICT (country_code) DO NOTHING;

COMMENT ON TABLE countries IS
  'ISO 3166-1 alpha-2 country reference. Defines age of majority, KYC requirements, sanctions risk, and regulatory applicability per country.';

-- ============================================================
-- TABLE: country_document_requirements
-- Maps which identity document types are accepted per country.
-- ============================================================

CREATE TABLE IF NOT EXISTS country_document_requirements (
    id BIGSERIAL PRIMARY KEY,
    country_code CHAR(2) NOT NULL REFERENCES countries(country_code) ON DELETE CASCADE,
    document_type identity_document_type NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,      -- preferred document for this country
    is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    requires_notarization BOOLEAN NOT NULL DEFAULT FALSE,
    requires_translation BOOLEAN NOT NULL DEFAULT FALSE,
    min_issuance_days INTEGER,                     -- document must be newer than this
    max_expiry_days INTEGER,                       -- document must not be older than this from expiry
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_code, document_type)
);

-- Seed primary documents per country
INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation) VALUES
    -- United States
    ('US', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('US', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('US', 'STATE_ID', TRUE, TRUE, FALSE, FALSE),
    ('US', 'BIRTH_CERTIFICATE', FALSE, TRUE, FALSE, FALSE),
    ('US', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),
    ('US', 'VISA', FALSE, TRUE, FALSE, FALSE),

    -- Canada
    ('CA', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('CA', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('CA', 'NATIONAL_ID', FALSE, FALSE, FALSE, FALSE),
    ('CA', 'BIRTH_CERTIFICATE', FALSE, TRUE, FALSE, FALSE),
    ('CA', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- United Kingdom
    ('GB', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('GB', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('GB', 'NATIONAL_ID', FALSE, FALSE, FALSE, FALSE),
    ('GB', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),
    ('GB', 'VISA', FALSE, TRUE, FALSE, FALSE),

    -- Germany
    ('DE', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('DE', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Personalausweis
    ('DE', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('DE', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- France
    ('FR', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('FR', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Carte d'Identité
    ('FR', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('FR', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Italy
    ('IT', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('IT', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Carta d'Identità
    ('IT', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('IT', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Spain
    ('ES', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('ES', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- DNI
    ('ES', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Netherlands
    ('NL', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('NL', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- ID-kaart
    ('NL', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('NL', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Sweden
    ('SE', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('SE', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Nationellt ID-kort
    ('SE', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),

    -- Denmark
    ('DK', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('DK', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('DK', 'NATIONAL_ID', FALSE, TRUE, FALSE, FALSE),

    -- Norway
    ('NO', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('NO', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('NO', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- BankID-linked

    -- Switzerland
    ('CH', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('CH', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),
    ('CH', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('CH', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Australia
    ('AU', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('AU', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('AU', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),
    ('AU', 'VISA', FALSE, TRUE, FALSE, FALSE),

    -- New Zealand
    ('NZ', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('NZ', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('NZ', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Japan
    ('JP', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('JP', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- My Number Card
    ('JP', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('JP', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- South Korea
    ('KR', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('KR', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Resident Registration Card
    ('KR', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('KR', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Singapore
    ('SG', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('SG', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- NRIC
    ('SG', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- India
    ('IN', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('IN', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Aadhaar
    ('IN', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('IN', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),
    ('IN', 'VISA', FALSE, TRUE, FALSE, FALSE),

    -- UAE
    ('AE', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('AE', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Emirates ID
    ('AE', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('AE', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),
    ('AE', 'VISA', FALSE, TRUE, FALSE, FALSE),

    -- Brazil
    ('BR', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('BR', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- RG / CPF
    ('BR', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('BR', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Mexico
    ('MX', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('MX', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- INE / CURP
    ('MX', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('MX', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Argentina
    ('AR', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('AR', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- DNI
    ('AR', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Colombia
    ('CO', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('CO', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Cédula
    ('CO', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('CO', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Israel
    ('IL', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('IL', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Teudat Zehut
    ('IL', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),

    -- South Africa
    ('ZA', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('ZA', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- SA ID Book
    ('ZA', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('ZA', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Poland
    ('PL', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('PL', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Dowód Osobisty
    ('PL', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('PL', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Austria
    ('AT', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('AT', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Personalausweis
    ('AT', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('AT', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Ireland
    ('IE', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('IE', 'DRIVERS_LICENSE', TRUE, TRUE, FALSE, FALSE),
    ('IE', 'NATIONAL_ID', FALSE, TRUE, FALSE, FALSE),       -- Public Services Card
    ('IE', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Belgium
    ('BE', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('BE', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Carte d'Identité / Identiteitskaart
    ('BE', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('BE', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Portugal
    ('PT', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('PT', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- Cartão de Cidadão
    ('PT', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE),

    -- Turkey
    ('TR', 'PASSPORT', TRUE, TRUE, FALSE, FALSE),
    ('TR', 'NATIONAL_ID', TRUE, TRUE, FALSE, FALSE),        -- TC Kimlik Kartı
    ('TR', 'DRIVERS_LICENSE', FALSE, TRUE, FALSE, FALSE),
    ('TR', 'RESIDENCE_PERMIT', FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (country_code, document_type) DO NOTHING;

-- Guardian-specific documents (accepted globally)
INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'GUARDIAN_CONSENT_FORM', TRUE, TRUE, TRUE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'GUARDIANSHIP_ORDER', FALSE, TRUE, TRUE, TRUE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'COURT_ORDER', FALSE, TRUE, TRUE, TRUE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

-- Company documents (accepted globally)
INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'COMPANY_REGISTRATION', TRUE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'TAX_ID_DOCUMENT', TRUE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'BUSINESS_LICENSE', TRUE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'DUNS_REPORT', FALSE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'INSURANCE_CERTIFICATE', FALSE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

INSERT INTO country_document_requirements (country_code, document_type, is_primary, is_accepted, requires_notarization, requires_translation)
SELECT c.country_code, 'TRADEMARK_REGISTRATION', FALSE, TRUE, FALSE, FALSE
FROM countries c WHERE c.supported = TRUE
ON CONFLICT (country_code, document_type) DO NOTHING;

COMMENT ON TABLE country_document_requirements IS
  'Maps accepted identity document types per country. Defines primary documents, notarization/translation requirements. Ensures KYC routing is country-aware.';

-- ============================================================
-- TABLE: verification_routing_rules
-- Determines how verification requests are routed based on
-- request type, country, risk level, and current volume.
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_routing_rules (
    id BIGSERIAL PRIMARY KEY,
    request_type verification_request_type NOT NULL,
    country_code CHAR(2) REFERENCES countries(country_code),
    risk_level_threshold risk_level NOT NULL DEFAULT 'MEDIUM',  -- requests above this risk level go to manual review
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,               -- can this type be auto-approved?
    auto_approve_max_score INTEGER DEFAULT 0,                  -- minimum trust score for auto-approve
    auto_approve_max_trust_tier trust_tier DEFAULT 'BASIC',     -- minimum trust tier for auto-approve
    requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_timeout_hours INTEGER NOT NULL DEFAULT 48,
    escalation_timeout_hours INTEGER NOT NULL DEFAULT 24,
    max_attempts INTEGER NOT NULL DEFAULT 3,                   -- max verification attempts before lockout
    cooldown_hours INTEGER NOT NULL DEFAULT 168,               -- cooldown after max attempts (7 days)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(request_type, country_code)
);

-- Default routing rules per request type
INSERT INTO verification_routing_rules (request_type, country_code, risk_level_threshold, auto_approve, auto_approve_max_score, auto_approve_max_trust_tier, requires_manual_review, review_timeout_hours, escalation_timeout_hours, max_attempts, cooldown_hours) VALUES
    -- Age verification: auto-approve for trusted users, manual review for edge cases
    ('AGE_VERIFICATION', NULL, 'MEDIUM', TRUE, 200, 'IDENTITY_VERIFIED', FALSE, 24, 12, 3, 168),
    -- Identity document: always requires manual review for first-time, auto for high-trust
    ('IDENTITY_DOCUMENT', NULL, 'HIGH', TRUE, 400, 'TRUSTED', FALSE, 48, 24, 3, 720),
    -- Guardian consent: always requires manual review (high fraud vector)
    ('GUARDIAN_CONSENT', NULL, 'LOW', FALSE, 500, 'TRUSTED', TRUE, 72, 24, 3, 720),
    -- Company domain: auto-approve with DNS verification
    ('COMPANY_DOMAIN', NULL, 'MEDIUM', TRUE, 100, 'BASIC', FALSE, 24, 12, 5, 24),
    -- Company registration: manual review required
    ('COMPANY_REGISTRATION', NULL, 'MEDIUM', FALSE, 300, 'IDENTITY_VERIFIED', TRUE, 72, 48, 3, 720),
    -- Employee verification: auto-approve if domain email verified
    ('EMPLOYEE_VERIFICATION', NULL, 'LOW', TRUE, 100, 'BASIC', FALSE, 24, 12, 3, 168),
    -- Business verification: always manual
    ('BUSINESS_VERIFICATION', NULL, 'LOW', FALSE, 400, 'TRUSTED', TRUE, 120, 48, 3, 720),
    -- Enterprise verification: requires enhanced review, extended timeline
    ('ENTERPRISE_VERIFICATION', NULL, 'LOW', FALSE, 600, 'HIGHLY_TRUSTED', TRUE, 168, 72, 3, 1440),
    -- Public figure: manual review required, high-touch
    ('PUBLIC_FIGURE', NULL, 'LOW', FALSE, 600, 'HIGHLY_TRUSTED', TRUE, 168, 72, 2, 1440),
    -- Strategic partner: requires executive review
    ('STRATEGIC_PARTNER', NULL, 'LOW', FALSE, 800, 'VERIFIED_ENTERPRISE', TRUE, 336, 168, 2, 2160),
    -- Manual review: always manual (obviously)
    ('MANUAL_REVIEW', NULL, 'LOW', FALSE, 0, 'UNTRUSTED', TRUE, 48, 24, 1, 0),
    -- Escalation: urgent handling
    ('ESCALATION', NULL, 'LOW', FALSE, 0, 'UNTRUSTED', TRUE, 4, 2, 1, 0),
    -- Appeal: manual review required
    ('APPEAL', NULL, 'LOW', FALSE, 0, 'UNTRUSTED', TRUE, 168, 72, 1, 2160)
ON CONFLICT (request_type, country_code) DO NOTHING;

COMMENT ON TABLE verification_routing_rules IS
  'Determines auto-approval eligibility, manual review triggers, and SLAs for each verification request type per country. NULL country_code = global default.';

-- ============================================================
-- TABLE: verification_provider_config
-- Maps which verification provider handles each request type.
-- Allows per-country provider routing (e.g., Persona for US, Onfido for EU).
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_provider_config (
    id BIGSERIAL PRIMARY KEY,
    request_type verification_request_type NOT NULL,
    country_code CHAR(2) REFERENCES countries(country_code),
    provider_name VARCHAR(100) NOT NULL,            -- 'persona', 'stripe_identity', 'onfido', 'veriff', 'manual'
    provider_priority INTEGER NOT NULL DEFAULT 1,   -- lower = tried first
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config_json JSONB,                              -- provider-specific config (API keys are in secrets manager)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(request_type, country_code, provider_name, provider_priority)
);

-- Default provider routing
INSERT INTO verification_provider_config (request_type, country_code, provider_name, provider_priority, is_active, config_json) VALUES
    -- Age verification: handled by Persona globally (best age estimation AI)
    ('AGE_VERIFICATION', NULL, 'persona', 1, TRUE, '{"inquiry_template": "age_verification_standard", "supported_countries": ["US","CA","GB","DE","FR","IT","ES","NL","AU","NZ","JP","SG"]}'),
    ('AGE_VERIFICATION', NULL, 'stripe_identity', 2, TRUE, '{"verification_type": "document"}'  ),
    ('AGE_VERIFICATION', NULL, 'manual', 99, TRUE, '{"fallback": true}'),

    -- Identity document: Persona for most countries, Veriff for EU
    ('IDENTITY_DOCUMENT', NULL, 'persona', 1, TRUE, '{"inquiry_template": "identity_standard"}'),
    ('IDENTITY_DOCUMENT', NULL, 'onfido', 2, TRUE, '{"check_type": "standard"}'),
    ('IDENTITY_DOCUMENT', NULL, 'manual', 99, TRUE, '{"fallback": true}'),

    -- Company verification: manual or automated registry checks
    ('COMPANY_REGISTRATION', NULL, 'manual', 1, TRUE, '{"review_type": "document_based"}'),
    ('BUSINESS_VERIFICATION', NULL, 'manual', 1, TRUE, '{"review_type": "enhanced"}'),

    -- Guardian consent: always manual (legal sensitivity)
    ('GUARDIAN_CONSENT', NULL, 'manual', 1, TRUE, '{"review_type": "legal_document", "requires_notarization": true}'),

    -- Employee: handled in-house via domain email
    ('EMPLOYEE_VERIFICATION', NULL, 'manual', 1, TRUE, '{"method": "domain_email"}')
ON CONFLICT (request_type, country_code, provider_name, provider_priority) DO NOTHING;

COMMENT ON TABLE verification_provider_config IS
  'Per-request-type, per-country verification provider routing. Enables A/B testing, regional provider optimization, and fallback chains.';

-- ============================================================
-- TABLE: age_of_majority_exceptions
-- Handles edge cases where age of majority varies within a country
-- (e.g., US states, Canadian provinces, Australian territories).
-- ============================================================

CREATE TABLE IF NOT EXISTS age_of_majority_exceptions (
    id BIGSERIAL PRIMARY KEY,
    country_code CHAR(2) NOT NULL REFERENCES countries(country_code) ON DELETE CASCADE,
    subdivision_code VARCHAR(10) NOT NULL,           -- ISO 3166-2 subdivision code (e.g., US-AL, CA-QC)
    subdivision_name VARCHAR(255) NOT NULL,
    age_of_majority SMALLINT NOT NULL CHECK (age_of_majority >= 16 AND age_of_majority <= 21),
    drinking_age SMALLINT,                           -- different from general majority
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subdivision_code)
);

-- US state-level age of majority variations
INSERT INTO age_of_majority_exceptions (country_code, subdivision_code, subdivision_name, age_of_majority, drinking_age, notes) VALUES
    ('US', 'US-AL', 'Alabama', 19, 21, 'Age of majority is 19 in Alabama'),
    ('US', 'US-NE', 'Nebraska', 19, 21, 'Age of majority is 19 in Nebraska'),
    ('US', 'US-MS', 'Mississippi', 21, 21, 'Age of majority is 21 in Mississippi'),
    ('US', 'US-PR', 'Puerto Rico', 21, 18, 'Age of majority is 21 in Puerto Rico')
ON CONFLICT (subdivision_code) DO NOTHING;

-- Canadian province variations
INSERT INTO age_of_majority_exceptions (country_code, subdivision_code, subdivision_name, age_of_majority, drinking_age, notes) VALUES
    ('CA', 'CA-AB', 'Alberta', 18, 18, NULL),
    ('CA', 'CA-MB', 'Manitoba', 18, 18, NULL),
    ('CA', 'CA-ON', 'Ontario', 18, 19, 'Drinking age is 19 in Ontario'),
    ('CA', 'CA-QC', 'Quebec', 18, 18, NULL),
    ('CA', 'CA-BC', 'British Columbia', 19, 19, 'Age of majority is 19 in BC'),
    ('CA', 'CA-NB', 'New Brunswick', 19, 19, 'Age of majority is 19 in NB'),
    ('CA', 'CA-NL', 'Newfoundland and Labrador', 19, 19, 'Age of majority is 19 in NL'),
    ('CA', 'CA-NS', 'Nova Scotia', 19, 19, 'Age of majority is 19 in NS'),
    ('CA', 'CA-NT', 'Northwest Territories', 19, 19, 'Age of majority is 19 in NT'),
    ('CA', 'CA-NU', 'Nunavut', 19, 19, 'Age of majority is 19 in NU'),
    ('CA', 'CA-PE', 'Prince Edward Island', 18, 19, 'Drinking age is 19 in PEI'),
    ('CA', 'CA-SK', 'Saskatchewan', 18, 19, 'Drinking age is 19 in SK'),
    ('CA', 'CA-YT', 'Yukon', 19, 19, 'Age of majority is 19 in YT')
ON CONFLICT (subdivision_code) DO NOTHING;

-- Australian territory variations
INSERT INTO age_of_majority_exceptions (country_code, subdivision_code, subdivision_name, age_of_majority, drinking_age, notes) VALUES
    ('AU', 'AU-ACT', 'Australian Capital Territory', 18, 18, NULL),
    ('AU', 'AU-NSW', 'New South Wales', 18, 18, NULL),
    ('AU', 'AU-NT',  'Northern Territory', 18, 18, NULL),
    ('AU', 'AU-QLD', 'Queensland', 18, 18, NULL),
    ('AU', 'AU-SA',  'South Australia', 18, 18, NULL),
    ('AU', 'AU-TAS', 'Tasmania', 18, 18, NULL),
    ('AU', 'AU-VIC', 'Victoria', 18, 18, NULL),
    ('AU', 'AU-WA',  'Western Australia', 18, 18, NULL)
ON CONFLICT (subdivision_code) DO NOTHING;

COMMENT ON TABLE age_of_majority_exceptions IS
  'Subdivision-level age of majority overrides (US states, Canadian provinces, etc.). Supports accurate age verification for regions where legal majority differs from the national default.';

-- ============================================================
-- TABLE: trust_tier_benefits
-- Defines what each trust tier unlocks (feature flags, limits).
-- Drives the "what can this user do?" logic.
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_tier_benefits (
    id BIGSERIAL PRIMARY KEY,
    tier trust_tier NOT NULL UNIQUE,
    max_deal_value_cents BIGINT NOT NULL,           -- maximum deal amount for this tier
    max_active_deals INTEGER NOT NULL,              -- concurrent active deals
    max_payout_per_transaction_cents BIGINT NOT NULL,
    daily_payout_limit_cents BIGINT NOT NULL,
    monthly_payout_limit_cents BIGINT NOT NULL,
    requires_kyc_level kyc_level NOT NULL,          -- minimum KYC level for this tier
    can_create_opportunities BOOLEAN NOT NULL DEFAULT FALSE,
    can_apply_to_opportunities BOOLEAN NOT NULL DEFAULT FALSE,
    can_send_messages BOOLEAN NOT NULL DEFAULT FALSE,
    can_initiate_payments BOOLEAN NOT NULL DEFAULT FALSE,
    can_receive_payments BOOLEAN NOT NULL DEFAULT FALSE,
    can_create_contracts BOOLEAN NOT NULL DEFAULT FALSE,
    can_sign_contracts BOOLEAN NOT NULL DEFAULT FALSE,
    can_file_disputes BOOLEAN NOT NULL DEFAULT FALSE,
    can_use_escrow BOOLEAN NOT NULL DEFAULT FALSE,
    can_access_analytics BOOLEAN NOT NULL DEFAULT FALSE,
    can_join_communities BOOLEAN NOT NULL DEFAULT FALSE,
    can_create_communities BOOLEAN NOT NULL DEFAULT FALSE,
    profile_visibility VARCHAR(50) NOT NULL DEFAULT 'public',  -- 'hidden', 'limited', 'public', 'featured'
    search_boost REAL NOT NULL DEFAULT 1.0,          -- multiplier in search results
    support_priority VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'standard', 'priority', 'dedicated', '24_7'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed tier benefits
INSERT INTO trust_tier_benefits (tier, max_deal_value_cents, max_active_deals, max_payout_per_transaction_cents, daily_payout_limit_cents, monthly_payout_limit_cents, requires_kyc_level, can_create_opportunities, can_apply_to_opportunities, can_send_messages, can_initiate_payments, can_receive_payments, can_create_contracts, can_sign_contracts, can_file_disputes, can_use_escrow, can_access_analytics, can_join_communities, can_create_communities, profile_visibility, search_boost, support_priority) VALUES
    ('UNTRUSTED',            50000,     1,  25000,     50000,     500000,    'NONE',              FALSE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,  FALSE, 'limited',  0.3,  'standard'),
    ('BASIC',                250000,   3,  100000,    250000,    2500000,   'EMAIL_ONLY',         TRUE,  TRUE,  TRUE,  FALSE, TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE, TRUE,  FALSE, 'public',   0.7,  'standard'),
    ('IDENTITY_VERIFIED',    1000000,  5,  500000,    1000000,   10000000,  'BASIC_KYC',          TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  FALSE, 'public',   1.0,  'standard'),
    ('TRUSTED',              5000000,  10, 1000000,   5000000,   50000000,  'FULL_KYC',           TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'public',   1.5,  'priority'),
    ('HIGHLY_TRUSTED',       25000000, 20, 5000000,   25000000,  250000000, 'ENHANCED_KYC',       TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'featured', 2.0,  'priority'),
    ('VERIFIED_CREATOR',     100000000,50, 10000000,  50000000,  500000000, 'FULL_KYC',           TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'featured', 3.0,  'dedicated'),
    ('VERIFIED_ENTERPRISE',  1000000000,100,50000000, 250000000, 2500000000,'INSTITUTIONAL_KYC',  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'featured', 3.0,  'dedicated'),
    ('VERIFIED_PUBLIC_FIGURE',100000000,20, 10000000,  50000000,  500000000, 'ENHANCED_KYC',       TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, 'featured', 2.5,  'dedicated'),
    ('PLATFORM_PARTNER',     1000000000,200,100000000,500000000, 5000000000,'INSTITUTIONAL_KYC',  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'featured', 4.0,  '24_7'),
    ('SYSTEM',               0,          0,  0,         0,         0,       'GOVERNMENT_KYC',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'hidden',   1.0,  '24_7')
ON CONFLICT (tier) DO NOTHING;

COMMENT ON TABLE trust_tier_benefits IS
  'Defines exactly what each trust tier unlocks. Controls deal limits, payout caps, feature access, and search visibility. Drives product experience per user.';

-- ============================================================
-- TABLE: escalation_matrix
-- Defines escalation paths for moderation and verification cases.
-- Maps case categories to reviewer roles and SLA targets.
-- ============================================================

CREATE TABLE IF NOT EXISTS escalation_matrix (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,                  -- matches moderation_queue.category
    risk_level_trigger risk_level NOT NULL,          -- escalate when risk >= this level
    assigned_role VARCHAR(50) NOT NULL,              -- 'moderator', 'senior_moderator', 'trust_safety', 'legal', 'executive'
    max_review_time_minutes INTEGER NOT NULL,
    requires_second_review BOOLEAN NOT NULL DEFAULT FALSE,
    auto_escalate BOOLEAN NOT NULL DEFAULT TRUE,     -- automatically escalate based on rules
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, risk_level_trigger, assigned_role)
);

-- Seed escalation paths
INSERT INTO escalation_matrix (category, risk_level_trigger, assigned_role, max_review_time_minutes, requires_second_review, auto_escalate) VALUES
    -- Fraud & impersonation
    ('fraud', 'MEDIUM', 'moderator', 240, FALSE, TRUE),
    ('fraud', 'HIGH', 'senior_moderator', 120, TRUE, TRUE),
    ('fraud', 'CRITICAL', 'trust_safety', 60, TRUE, TRUE),

    ('impersonation', 'MEDIUM', 'moderator', 240, FALSE, TRUE),
    ('impersonation', 'HIGH', 'senior_moderator', 120, TRUE, TRUE),
    ('impersonation', 'CRITICAL', 'trust_safety', 60, TRUE, TRUE),

    -- Age & guardian issues
    ('fake_document', 'MEDIUM', 'senior_moderator', 120, TRUE, TRUE),
    ('fake_document', 'HIGH', 'trust_safety', 60, TRUE, TRUE),
    ('fake_document', 'CRITICAL', 'legal', 30, TRUE, TRUE),

    ('age_forgery', 'MEDIUM', 'senior_moderator', 120, TRUE, TRUE),
    ('age_forgery', 'HIGH', 'trust_safety', 60, TRUE, TRUE),
    ('age_forgery', 'CRITICAL', 'legal', 30, TRUE, TRUE),

    ('guardian_abuse', 'MEDIUM', 'trust_safety', 120, TRUE, TRUE),
    ('guardian_abuse', 'HIGH', 'legal', 60, TRUE, TRUE),
    ('guardian_abuse', 'CRITICAL', 'executive', 30, TRUE, TRUE),

    -- Abuse & harassment
    ('abuse', 'MEDIUM', 'moderator', 120, FALSE, TRUE),
    ('abuse', 'HIGH', 'senior_moderator', 60, FALSE, TRUE),
    ('abuse', 'CRITICAL', 'trust_safety', 30, TRUE, TRUE),

    ('harassment', 'MEDIUM', 'moderator', 120, FALSE, TRUE),
    ('harassment', 'HIGH', 'senior_moderator', 60, FALSE, TRUE),
    ('harassment', 'CRITICAL', 'trust_safety', 30, TRUE, TRUE),

    -- Legal
    ('csam', 'HIGH', 'legal', 15, TRUE, TRUE),
    ('csam', 'CRITICAL', 'executive', 5, TRUE, TRUE),

    ('legal_request', 'MEDIUM', 'legal', 240, TRUE, TRUE),
    ('legal_request', 'HIGH', 'legal', 120, TRUE, TRUE),
    ('legal_request', 'CRITICAL', 'executive', 60, TRUE, TRUE),

    -- Payment & fraud
    ('payment_fraud', 'MEDIUM', 'trust_safety', 120, FALSE, TRUE),
    ('payment_fraud', 'HIGH', 'trust_safety', 60, TRUE, TRUE),
    ('payment_fraud', 'CRITICAL', 'legal', 30, TRUE, TRUE),

    ('money_laundering', 'MEDIUM', 'trust_safety', 60, TRUE, TRUE),
    ('money_laundering', 'HIGH', 'legal', 30, TRUE, TRUE),
    ('money_laundering', 'CRITICAL', 'executive', 15, TRUE, TRUE),

    -- Enterprise impersonation
    ('enterprise_impersonation', 'MEDIUM', 'senior_moderator', 240, FALSE, TRUE),
    ('enterprise_impersonation', 'HIGH', 'trust_safety', 120, TRUE, TRUE),
    ('enterprise_impersonation', 'CRITICAL', 'legal', 60, TRUE, TRUE)
ON CONFLICT (category, risk_level_trigger, assigned_role) DO NOTHING;

COMMENT ON TABLE escalation_matrix IS
  'Defines who handles what, and when it escalates. Maps case categories + risk levels to reviewer roles with SLA targets.';

-- ============================================================
-- TABLE: risk_event_scoring_weights
-- Configures how much each risk event type contributes to risk score.
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_event_scoring_weights (
    id BIGSERIAL PRIMARY KEY,
    event_type risk_event_type NOT NULL UNIQUE,
    base_severity VARCHAR(20) NOT NULL,                -- base severity level
    score_impact INTEGER NOT NULL DEFAULT 0,           -- points added to risk score
    auto_resolve_minutes INTEGER,                      -- auto-resolve after this many minutes (NULL = never)
    auto_resolve_requires_action BOOLEAN NOT NULL DEFAULT FALSE, -- must action be taken to resolve?
    auto_escalate BOOLEAN NOT NULL DEFAULT FALSE,       -- auto-create moderation queue item
    escalate_category VARCHAR(100),                    -- moderation queue category if escalated
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO risk_event_scoring_weights (event_type, base_severity, score_impact, auto_resolve_minutes, auto_resolve_requires_action, auto_escalate, escalate_category) VALUES
    -- Critical severity (instantly escalate)
    ('ACCOUNT_TAKEOVER_ATTEMPT', 'critical', 200, NULL, TRUE, TRUE, 'fraud'),
    ('PAYMENT_FRAUD', 'critical', 200, NULL, TRUE, TRUE, 'payment_fraud'),
    ('MONEY_LAUNDERING_ATTEMPT', 'critical', 250, NULL, TRUE, TRUE, 'money_laundering'),
    ('DOCUMENT_FORGERY', 'critical', 200, NULL, TRUE, TRUE, 'fake_document'),
    ('AGE_FORGERY_ATTEMPT', 'critical', 200, NULL, TRUE, TRUE, 'age_forgery'),
    ('DEEPFAKE_DETECTED', 'critical', 200, NULL, TRUE, TRUE, 'fake_document'),
    ('IDENTITY_LAUNDERING', 'critical', 250, NULL, TRUE, TRUE, 'fraud'),
    ('BRIBED_MODERATOR_ATTEMPT', 'critical', 300, NULL, TRUE, TRUE, 'fraud'),
    ('DATA_EXFILTRATION_ATTEMPT', 'critical', 250, NULL, TRUE, TRUE, 'fraud'),
    ('SESSION_HIJACKING_ATTEMPT', 'critical', 200, NULL, TRUE, TRUE, 'fraud'),

    -- High severity
    ('IMPERSONATION_ATTEMPT', 'high', 100, 1440, FALSE, TRUE, 'impersonation'),
    ('SYBIL_ATTACK', 'high', 100, NULL, TRUE, TRUE, 'fraud'),
    ('COLLUSION_DETECTED', 'high', 100, NULL, TRUE, TRUE, 'fraud'),
    ('CHARGEBACK_FRAUD', 'high', 100, 4320, TRUE, TRUE, 'payment_fraud'),
    ('PURCHASED_ACCOUNT_DETECTED', 'high', 100, NULL, TRUE, TRUE, 'fraud'),
    ('CONTRACT_TAMPERING', 'high', 100, NULL, TRUE, TRUE, 'fraud'),
    ('MFA_BYPASS_ATTEMPT', 'high', 100, NULL, TRUE, TRUE, 'fraud'),
    ('AI_GENERATED_DOCUMENT', 'high', 80, NULL, TRUE, TRUE, 'fake_document'),
    ('FAKE_GUARDIAN', 'high', 100, NULL, TRUE, TRUE, 'guardian_abuse'),
    ('FAKE_ENTERPRISE', 'high', 100, NULL, TRUE, TRUE, 'enterprise_impersonation'),

    -- Medium severity
    ('BRUTE_FORCE_LOGIN', 'medium', 50, 60, FALSE, TRUE, 'abuse'),
    ('SUSPICIOUS_LOGIN', 'medium', 30, 120, FALSE, FALSE, NULL),
    ('MASS_ACCOUNT_CREATION', 'medium', 60, 1440, FALSE, TRUE, 'fraud'),
    ('BADGE_SELLING_ATTEMPT', 'medium', 50, NULL, TRUE, TRUE, 'fraud'),
    ('FAKE_SOCIAL_PROOF', 'medium', 40, NULL, TRUE, TRUE, 'fraud'),
    ('API_ABUSE', 'medium', 40, 60, FALSE, TRUE, 'abuse'),
    ('SCRAPING_DETECTED', 'medium', 30, 1440, FALSE, FALSE, NULL),
    ('CONTENT_POLICY_VIOLATION', 'medium', 30, 1440, FALSE, TRUE, 'abuse'),
    ('HARASSMENT_REPORT', 'medium', 40, NULL, TRUE, TRUE, 'harassment'),
    ('INSIDER_ABUSE', 'medium', 60, NULL, TRUE, TRUE, 'fraud'),
    ('PHISHING_ATTEMPT', 'medium', 50, NULL, TRUE, TRUE, 'fraud'),

    -- Low severity
    ('RATE_LIMIT_VIOLATION', 'low', 10, 30, FALSE, FALSE, NULL)
ON CONFLICT (event_type) DO NOTHING;

COMMENT ON TABLE risk_event_scoring_weights IS
  'Configurable risk scoring. Defines severity, score impact, auto-resolve timing, and escalation triggers for each risk event type.';

-- ============================================================
-- INDEXES for new tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cdr_country ON country_document_requirements(country_code);
CREATE INDEX IF NOT EXISTS idx_cdr_doc_type ON country_document_requirements(document_type);
CREATE INDEX IF NOT EXISTS idx_cdr_primary ON country_document_requirements(country_code, is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_vrr_type ON verification_routing_rules(request_type);
CREATE INDEX IF NOT EXISTS idx_vrr_country ON verification_routing_rules(country_code);
CREATE INDEX IF NOT EXISTS idx_vrr_active ON verification_routing_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_vpc_type ON verification_provider_config(request_type);
CREATE INDEX IF NOT EXISTS idx_vpc_country ON verification_provider_config(country_code);
CREATE INDEX IF NOT EXISTS idx_vpc_active ON verification_provider_config(is_active);

CREATE INDEX IF NOT EXISTS idx_aome_country ON age_of_majority_exceptions(country_code);
CREATE INDEX IF NOT EXISTS idx_aome_subdivision ON age_of_majority_exceptions(subdivision_code);

CREATE INDEX IF NOT EXISTS idx_em_category ON escalation_matrix(category);
CREATE INDEX IF NOT EXISTS idx_em_risk ON escalation_matrix(risk_level_trigger);
CREATE INDEX IF NOT EXISTS idx_em_role ON escalation_matrix(assigned_role);

CREATE INDEX IF NOT EXISTS idx_resw_severity ON risk_event_scoring_weights(base_severity);
CREATE INDEX IF NOT EXISTS idx_resw_escalate ON risk_event_scoring_weights(auto_escalate) WHERE auto_escalate = TRUE;
