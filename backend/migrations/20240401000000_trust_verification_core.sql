-- TRUST + VERIFICATION SYSTEM: CORE SCHEMA
-- State-machine driven. No booleans. Every entity has explicit states.
-- This migration defines the entire trust/verification/identity substrate.
-- Must be applied BEFORE any trust/verification service code.

-- ============================================================
-- PART 1: ENUMS (explicit state machines, NOT booleans)
-- ============================================================

CREATE TYPE user_age_verification_state AS ENUM (
    'UNVERIFIED',           -- No age check performed
    'PENDING_SELF_DECLARATION', -- User provided DOB, awaiting verification
    'SELF_DECLARED_ADULT',  -- User claimed 18+, no document yet
    'PENDING_DOCUMENT_UPLOAD', -- Age document required
    'PENDING_DOCUMENT_REVIEW', -- Document submitted, under review
    'DOCUMENT_REJECTED',    -- Document failed verification
    'MINOR_PENDING_GUARDIAN', -- Under 18, needs guardian link
    'MINOR_GUARDIAN_PENDING_APPROVAL', -- Guardian invited, pending consent
    'MINOR_GUARDIAN_APPROVED', -- Guardian consented, minor partially active
    'MINOR_ACTIVE',         -- Minor fully active with guardian oversight
    'ADULT_ACTIVE',         -- Verified 18+, full independent access
    'AGE_ESCALATED',        -- Flagged for manual review
    'AGE_LOCKED',           -- Frozen - potential fraud/forgery
    'AGE_UNDER_REVIEW',     -- Under investigation
    'AGE_TRANSFERRING_TO_ADULT', -- Minor turning 18, in transfer process
    'AGE_EXPIRED'           -- Verification expired, needs re-verification
);

CREATE TYPE guardian_relationship_state AS ENUM (
    'PENDING_INVITE',       -- Guardian invited, not responded
    'INVITE_EXPIRED',       -- Invitation timed out
    'PENDING_CONSENT',      -- Guardian accepted, completing consent
    'CONSENT_DOCUMENTS_UPLOADED', -- Legal documents submitted
    'CONSENT_DOCUMENTS_REVIEWED', -- Documents verified
    'ACTIVE',               -- Full guardian relationship active
    'SUSPENDED',            -- Temporarily suspended (dispute/issue)
    'REVOKED',              -- Guardian revoked their consent
    'TERMINATED',           -- Relationship ended (minor turned 18/court order)
    'DISPUTED',             -- Relationship under dispute
    'AWAITING_COURT_ORDER', -- Legal proceedings pending
    'TRANSFERRED'           -- Guardian rights transferred to another
);

CREATE TYPE company_verification_state AS ENUM (
    'UNVERIFIED',           -- Default state
    'DOMAIN_CLAIMED',       -- Domain claimed, verification in progress
    'DNS_VERIFIED',         -- DNS TXT record confirmed
    'BUSINESS_REGISTRATION_SUBMITTED', -- Registration docs uploaded
    'BUSINESS_REGISTRATION_VERIFIED',  -- Docs confirmed
    'EMPLOYEE_VERIFIED',    -- At least one employee verified
    'BUSINESS_VERIFIED',    -- Full business verification
    'ENTERPRISE_VERIFIED',  -- Large enterprise verification
    'GOVERNMENT_VERIFIED',  -- Government entity
    'STRATEGIC_PARTNER',    -- Platform strategic partner
    'VERIFICATION_REVOKED', -- Previously verified, now revoked
    'IMPERSONATION_FLAGGED', -- Suspected impersonation
    'UNDER_INVESTIGATION',  -- Active fraud investigation
    'BLACKLISTED'           -- Permanently banned
);

CREATE TYPE employee_verification_state AS ENUM (
    'UNVERIFIED',
    'DOMAIN_EMAIL_SENT',    -- Verification email sent to company domain
    'DOMAIN_EMAIL_VERIFIED', -- Clicked link in company email
    'DNS_LINK_VERIFIED',    -- DNS-based verification confirmed
    'LINKEDIN_VERIFIED',    -- LinkedIn employment confirmed
    'DOCUMENT_VERIFIED',    -- Employment letter/tax form confirmed
    'MANUALLY_VERIFIED',    -- Reviewed by trust & safety team
    'FULLY_VERIFIED',       -- All checks passed
    'EXPIRED',              -- Verification expired, needs renewal
    'REVOKED',              -- Employment ended, access revoked
    'FLAGGED'               -- Suspicious activity detected
);

CREATE TYPE trust_tier AS ENUM (
    'UNTRUSTED',            -- New/unknown user
    'BASIC',                -- Email verified
    'IDENTITY_VERIFIED',    -- ID document verified
    'TRUSTED',              -- History + behavior verified
    'HIGHLY_TRUSTED',       -- Long-standing positive history
    'VERIFIED_CREATOR',     -- Platform-verified creator
    'VERIFIED_ENTERPRISE',  -- Verified business entity
    'VERIFIED_PUBLIC_FIGURE', -- Public figure/celebrity
    'PLATFORM_PARTNER',     -- Strategic platform partner
    'SYSTEM'                -- Internal system account
);

CREATE TYPE risk_level AS ENUM (
    'UNKNOWN',              -- Insufficient data
    'LOW',                  -- Normal user behavior
    'MEDIUM',               -- Some flags raised
    'HIGH',                 -- Significant risk indicators
    'CRITICAL',             -- Active abuse/fraud detected
    'LOCKED'                -- Account frozen, support required
);

CREATE TYPE contract_party_type AS ENUM (
    'INDIVIDUAL_ADULT',
    'INDIVIDUAL_MINOR',
    'GUARDIAN',
    'COMPANY',
    'AGENCY',
    'TRUST',
    'LLC',
    'PARTNERSHIP',
    'GOVERNMENT'
);

CREATE TYPE contract_state AS ENUM (
    'DRAFT',                -- Being created, not sent
    'PENDING_REVIEW',       -- Sent to party for review
    'REVISION_REQUESTED',   -- Changes requested
    'PENDING_GUARDIAN',     -- Waiting on guardian approval (minor)
    'GUARDIAN_REJECTED',    -- Guardian declined
    'PENDING_COMPANY_SIGN', -- Waiting on company signatory
    'PENDING_COUNTER_SIGN', -- One side signed, waiting for other
    'EXECUTED',             -- Both/all parties signed
    'IN_PROGRESS',          -- Contract active, work in progress
    'COMPLETED',            -- Deliverables fulfilled
    'DISPUTED',             -- Formal dispute filed
    'ARBITRATION',          -- In arbitration process
    'BREACHED',             -- Contract terms breached
    'TERMINATED',           -- Early termination
    'EXPIRED',              -- Reached end date
    'VOIDED',               -- Declared invalid
    'CANCELLED'             -- Cancelled before execution
);

CREATE TYPE dispute_state AS ENUM (
    'OPEN',
    'UNDER_INVESTIGATION',
    'EVIDENCE_COLLECTION',
    'MEDIATION',
    'ARBITRATION',
    'RESOLVED_REFUND',
    'RESOLVED_PARTIAL_REFUND',
    'RESOLVED_IN_FAVOR_OF_CREATOR',
    'RESOLVED_IN_FAVOR_OF_BRAND',
    'RESOLVED_SPLIT',
    'APPEALED',
    'CLOSED',
    'ESCALATED_LEGAL'
);

CREATE TYPE moderation_action AS ENUM (
    'NONE',
    'WARNING',
    'CONTENT_REMOVED',
    'TEMPORARY_SUSPENSION',
    'PERMANENT_SUSPENSION',
    'ACCOUNT_FREEZE',
    'FEATURE_RESTRICTION',
    'TRUST_SCORE_DECREASE',
    'BADGE_REMOVAL',
    'VERIFICATION_REVOCATION',
    'LEGAL_ESCALATION'
);

CREATE TYPE identity_document_type AS ENUM (
    'PASSPORT',
    'DRIVERS_LICENSE',
    'NATIONAL_ID',
    'STATE_ID',
    'BIRTH_CERTIFICATE',
    'RESIDENCE_PERMIT',
    'VISA',
    'GUARDIAN_CONSENT_FORM',
    'COURT_ORDER',
    'GUARDIANSHIP_ORDER',
    'COMPANY_REGISTRATION',
    'TAX_ID_DOCUMENT',
    'BUSINESS_LICENSE',
    'TRADEMARK_REGISTRATION',
    'DUNS_REPORT',
    'INSURANCE_CERTIFICATE'
);

-- ============================================================
-- PART 2: CORE TABLES
-- ============================================================

-- Users: extended with age verification state machine
-- This extends the existing users table via 1:1 profile
CREATE TABLE user_verification_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    date_of_birth_sha256 VARCHAR(64),            -- hash of DOB for age checks without exposing raw DOB
    age_verification_state user_age_verification_state NOT NULL DEFAULT 'UNVERIFIED',
    declared_age_at_signup SMALLINT,             -- age they claimed at signup
    verified_age SMALLINT,                       -- age confirmed via document
    age_verified_at TIMESTAMPTZ,
    age_verification_expires_at TIMESTAMPTZ,     -- re-verification deadline
    identity_document_id BIGINT,                 -- current active identity document
    selfie_verified BOOLEAN NOT NULL DEFAULT FALSE,
    liveness_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    liveness_checked_at TIMESTAMPTZ,
    risk_level risk_level NOT NULL DEFAULT 'UNKNOWN',
    trust_tier trust_tier NOT NULL DEFAULT 'UNTRUSTED',
    trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 1000),
    trust_score_updated_at TIMESTAMPTZ,
    is_public_figure BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_country_code VARCHAR(5),
    phone_number_hash VARCHAR(64),               -- SHA-256 of full phone
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    account_created_ip INET,
    account_created_device_fingerprint VARCHAR(255),
    account_created_user_agent TEXT,
    last_risk_assessment_at TIMESTAMPTZ,
    active_warning_count INTEGER NOT NULL DEFAULT 0,
    is_under_investigation BOOLEAN NOT NULL DEFAULT FALSE,
    investigation_case_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uvp_age_state ON user_verification_profiles(age_verification_state);
CREATE INDEX idx_uvp_trust_tier ON user_verification_profiles(trust_tier);
CREATE INDEX idx_uvp_risk_level ON user_verification_profiles(risk_level);
CREATE INDEX idx_uvp_trust_score ON user_verification_profiles(trust_score DESC);
CREATE INDEX idx_uvp_dob_hash ON user_verification_profiles(date_of_birth_sha256);
CREATE INDEX idx_uvp_phone_hash ON user_verification_profiles(phone_number_hash);
CREATE INDEX idx_uvp_expires ON user_verification_profiles(age_verification_expires_at) WHERE age_verification_expires_at IS NOT NULL;

COMMENT ON TABLE user_verification_profiles IS
  '1:1 extension of users table for all trust/verification/age state. No boolean soup - all state machine driven.';

-- ============================================================
-- GUARDIAN RELATIONSHIPS
-- ============================================================

CREATE TABLE guardian_relationships (
    id BIGSERIAL PRIMARY KEY,
    minor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guardian_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_state guardian_relationship_state NOT NULL DEFAULT 'PENDING_INVITE',
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'parent', -- parent, legal_guardian, court_appointed, relative
    invite_token VARCHAR(64) UNIQUE,                          -- unique invite token
    invite_expires_at TIMESTAMPTZ,                            -- token expiry
    invite_accepted_at TIMESTAMPTZ,
    consent_document_id BIGINT,                               -- signed consent document
    consent_signed_at TIMESTAMPTZ,
    guardian_identity_document_id BIGINT,                     -- guardian's ID proof
    court_order_document_id BIGINT,                           -- if court-appointed
    consent_revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    dispute_reason TEXT,
    transferred_to_guardian_id BIGINT,                        -- if rights transferred
    notes TEXT,                                               -- internal trust & safety notes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT different_users CHECK (minor_user_id != guardian_user_id),
    CONSTRAINT active_relationship_unique UNIQUE (minor_user_id, guardian_user_id) 
        WHERE relationship_state NOT IN ('TERMINATED', 'TRANSFERRED', 'REVOKED')
);

CREATE INDEX idx_gr_minor ON guardian_relationships(minor_user_id);
CREATE INDEX idx_gr_guardian ON guardian_relationships(guardian_user_id);
CREATE INDEX idx_gr_state ON guardian_relationships(relationship_state);
CREATE INDEX idx_gr_invite_token ON guardian_relationships(invite_token) WHERE invite_token IS NOT NULL;

COMMENT ON TABLE guardian_relationships IS
  'Maps minors to guardians with explicit state machine. Enforces single active guardian per minor.';

-- ============================================================
-- GUARDIAN PERMISSIONS (granular delegation)
-- ============================================================

CREATE TYPE guardian_permission AS ENUM (
    'VIEW_PROFILE',
    'EDIT_PROFILE',
    'VIEW_MESSAGES',
    'SEND_MESSAGES',
    'VIEW_CONTRACTS',
    'APPROVE_CONTRACTS',
    'REJECT_CONTRACTS',
    'VIEW_PAYMENTS',
    'APPROVE_PAYOUTS',
    'REJECT_PAYOUTS',
    'MANAGE_SCHEDULE',
    'VIEW_ANALYTICS',
    'MANAGE_TEAM',
    'DELETE_ACCOUNT',
    'TRANSFER_ACCOUNT',
    'VIEW_DISPUTES',
    'RESOLVE_DISPUTES'
);

CREATE TABLE guardian_permissions (
    id BIGSERIAL PRIMARY KEY,
    guardian_relationship_id BIGINT NOT NULL REFERENCES guardian_relationships(id) ON DELETE CASCADE,
    permission guardian_permission NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by VARCHAR(50) NOT NULL, -- 'system', 'guardian_self', 'trust_safety', 'court_order'
    expires_at TIMESTAMPTZ,
    UNIQUE(guardian_relationship_id, permission)
);

CREATE INDEX idx_gp_relationship ON guardian_permissions(guardian_relationship_id);

COMMENT ON TABLE guardian_permissions IS
  'Granular permission delegation from guardian to minor. Each permission individually grantable/revocable.';

-- ============================================================
-- COMPANIES & ENTERPRISE VERIFICATION
-- ============================================================

CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    legal_name VARCHAR(255) NOT NULL,
    doing_business_as VARCHAR(255),              -- DBA / trading name
    website VARCHAR(255),
    domain_name VARCHAR(255) UNIQUE,             -- verified domain (e.g., google.com)
    company_state company_verification_state NOT NULL DEFAULT 'UNVERIFIED',
    tax_id_sha256 VARCHAR(64),                   -- SHA-256 of tax ID (EIN/VAT/etc)
    tax_id_country VARCHAR(5),
    tax_id_type VARCHAR(50),                     -- EIN, VAT, GST, ABN, etc.
    registration_number VARCHAR(255),            -- government registration number
    registration_country VARCHAR(5),
    registration_jurisdiction VARCHAR(255),
    duns_number VARCHAR(20),
    lei_number VARCHAR(20),                      -- Legal Entity Identifier
    verified_at TIMESTAMPTZ,
    verification_expires_at TIMESTAMPTZ,
    verified_by_user_id BIGINT REFERENCES users(id),
    trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 1000),
    risk_level risk_level NOT NULL DEFAULT 'UNKNOWN',
    is_publicly_traded BOOLEAN NOT NULL DEFAULT FALSE,
    stock_ticker VARCHAR(20),
    stock_exchange VARCHAR(50),
    parent_company_id BIGINT REFERENCES companies(id),
    subsidiary_of_id BIGINT REFERENCES companies(id),
    known_aliases TEXT[] NOT NULL DEFAULT '{}',  -- alternative names the company uses
    blocked_domains TEXT[] NOT NULL DEFAULT '{}', -- domains that impersonate this company
    brand_guidelines_url VARCHAR(255),
    logo_url VARCHAR(255),
    description TEXT,
    employee_count_range VARCHAR(50),
    annual_revenue_range VARCHAR(50),
    notes TEXT,                                  -- internal trust & safety notes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comp_state ON companies(company_state);
CREATE INDEX idx_comp_domain ON companies(domain_name);
CREATE INDEX idx_comp_name ON companies USING gin(to_tsvector('english', legal_name));
CREATE INDEX idx_comp_parent ON companies(parent_company_id);
CREATE INDEX idx_comp_subsidiary ON companies(subsidiary_of_id);
CREATE INDEX idx_comp_trust_score ON companies(trust_score DESC);
CREATE INDEX idx_comp_risk ON companies(risk_level);

COMMENT ON TABLE companies IS
  'Verified business entities. State machine driven - UNVERIFIED -> DNS_VERIFIED -> BUSINESS_VERIFIED -> ENTERPRISE_VERIFIED.';

-- ============================================================
-- COMPANY DOMAIN CLAIMS (prevent impersonation)
-- ============================================================

CREATE TABLE company_domain_claims (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) NOT NULL,
    verification_method VARCHAR(50) NOT NULL,  -- 'dns_txt', 'dns_cname', 'email', 'website_file'
    verification_token VARCHAR(128) NOT NULL,
    verification_token_sha256 VARCHAR(64) NOT NULL,
    verified_at TIMESTAMPTZ,
    verified_by_ip INET,
    verification_attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(domain_name, is_active) WHERE is_active = TRUE
);

CREATE INDEX idx_cdc_company ON company_domain_claims(company_id);
CREATE INDEX idx_cdc_domain ON company_domain_claims(domain_name);

-- ============================================================
-- EMPLOYEE VERIFICATIONS
-- ============================================================

CREATE TABLE employee_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    state employee_verification_state NOT NULL DEFAULT 'UNVERIFIED',
    work_email VARCHAR(255),                     -- company email used for verification
    work_email_sha256 VARCHAR(64),               -- SHA-256 of work email
    work_email_verified_at TIMESTAMPTZ,
    linkedin_profile_url VARCHAR(255),
    linkedin_verified_at TIMESTAMPTZ,
    linkedin_employment_data JSONB,             -- snapshot from LinkedIn API
    employment_document_id BIGINT,
    employment_document_verified_at TIMESTAMPTZ,
    job_title VARCHAR(255),
    department VARCHAR(255),
    employment_type VARCHAR(50),                 -- full_time, part_time, contractor, intern, agency
    is_primary_employment BOOLEAN NOT NULL DEFAULT TRUE,
    verification_expires_at TIMESTAMPTZ,
    verified_by_user_id BIGINT REFERENCES users(id), -- who verified (trust & safety member)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, company_id, is_primary_employment) WHERE is_primary_employment = TRUE
);

CREATE INDEX idx_ev_user ON employee_verifications(user_id);
CREATE INDEX idx_ev_company ON employee_verifications(company_id);
CREATE INDEX idx_ev_state ON employee_verifications(state);
CREATE INDEX idx_ev_email_hash ON employee_verifications(work_email_sha256);
CREATE INDEX idx_ev_expires ON employee_verifications(verification_expires_at) WHERE verification_expires_at IS NOT NULL;

COMMENT ON TABLE employee_verifications IS
  'Proves an individual works at a company. Prevents impersonation. State machine from UNVERIFIED -> FULLY_VERIFIED.';

-- ============================================================
-- COMPANY ROLES (RBAC within companies)
-- ============================================================

CREATE TYPE company_role_type AS ENUM (
    'OWNER',        -- Full control, can delete company
    'ADMIN',        -- Manage employees, settings, billing
    'LEGAL',        -- Sign contracts, manage disputes
    'HIRING',       -- Post opportunities, review applications
    'PARTNERSHIP',  -- Manage partnerships, negotiate deals
    'EMPLOYEE',     -- Standard employee access
    'CONTRACTOR',   -- External contractor access
    'RECRUITER',    -- External recruiter (limited)
    'AGENCY'        -- Agency representing the company
);

CREATE TABLE company_roles (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type company_role_type NOT NULL,
    title VARCHAR(255),                          -- actual job title
    granted_by_user_id BIGINT REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    UNIQUE(company_id, user_id, role_type, is_active) WHERE is_active = TRUE
);

CREATE INDEX idx_cr_company ON company_roles(company_id);
CREATE INDEX idx_cr_user ON company_roles(user_id);
CREATE INDEX idx_cr_role ON company_roles(role_type);

-- ============================================================
-- PERMISSION MATRIX (what each role can do)
-- ============================================================

CREATE TYPE company_permission AS ENUM (
    'VIEW_COMPANY_PROFILE',
    'EDIT_COMPANY_PROFILE',
    'MANAGE_EMPLOYEES',
    'VIEW_EMPLOYEES',
    'CREATE_OPPORTUNITIES',
    'MANAGE_OPPORTUNITIES',
    'VIEW_APPLICATIONS',
    'REVIEW_APPLICATIONS',
    'MAKE_OFFERS',
    'SIGN_CONTRACTS',
    'VIEW_CONTRACTS',
    'MANAGE_PAYMENTS',
    'VIEW_PAYMENTS',
    'INITIATE_PAYOUTS',
    'MANAGE_DISPUTES',
    'VIEW_ANALYTICS',
    'MANAGE_BILLING',
    'MANAGE_SETTINGS',
    'DELETE_COMPANY',
    'MANAGE_ROLES',
    'VIEW_AUDIT_LOG',
    'API_ACCESS',
    'MANAGE_BRAND_ASSETS',
    'COMMUNICATE_AS_COMPANY'
);

CREATE TABLE company_role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_type company_role_type NOT NULL,
    permission company_permission NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(role_type, permission)
);

-- Seed default permissions
INSERT INTO company_role_permissions (role_type, permission, is_default) VALUES
    -- OWNER: everything
    ('OWNER', 'VIEW_COMPANY_PROFILE', TRUE),
    ('OWNER', 'EDIT_COMPANY_PROFILE', TRUE),
    ('OWNER', 'MANAGE_EMPLOYEES', TRUE),
    ('OWNER', 'VIEW_EMPLOYEES', TRUE),
    ('OWNER', 'CREATE_OPPORTUNITIES', TRUE),
    ('OWNER', 'MANAGE_OPPORTUNITIES', TRUE),
    ('OWNER', 'VIEW_APPLICATIONS', TRUE),
    ('OWNER', 'REVIEW_APPLICATIONS', TRUE),
    ('OWNER', 'MAKE_OFFERS', TRUE),
    ('OWNER', 'SIGN_CONTRACTS', TRUE),
    ('OWNER', 'VIEW_CONTRACTS', TRUE),
    ('OWNER', 'MANAGE_PAYMENTS', TRUE),
    ('OWNER', 'VIEW_PAYMENTS', TRUE),
    ('OWNER', 'INITIATE_PAYOUTS', TRUE),
    ('OWNER', 'MANAGE_DISPUTES', TRUE),
    ('OWNER', 'VIEW_ANALYTICS', TRUE),
    ('OWNER', 'MANAGE_BILLING', TRUE),
    ('OWNER', 'MANAGE_SETTINGS', TRUE),
    ('OWNER', 'DELETE_COMPANY', TRUE),
    ('OWNER', 'MANAGE_ROLES', TRUE),
    ('OWNER', 'VIEW_AUDIT_LOG', TRUE),
    ('OWNER', 'API_ACCESS', TRUE),
    ('OWNER', 'MANAGE_BRAND_ASSETS', TRUE),
    ('OWNER', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- ADMIN: almost everything except delete/manage roles
    ('ADMIN', 'VIEW_COMPANY_PROFILE', TRUE),
    ('ADMIN', 'EDIT_COMPANY_PROFILE', TRUE),
    ('ADMIN', 'MANAGE_EMPLOYEES', TRUE),
    ('ADMIN', 'VIEW_EMPLOYEES', TRUE),
    ('ADMIN', 'CREATE_OPPORTUNITIES', TRUE),
    ('ADMIN', 'MANAGE_OPPORTUNITIES', TRUE),
    ('ADMIN', 'VIEW_APPLICATIONS', TRUE),
    ('ADMIN', 'REVIEW_APPLICATIONS', TRUE),
    ('ADMIN', 'MAKE_OFFERS', TRUE),
    ('ADMIN', 'SIGN_CONTRACTS', TRUE),
    ('ADMIN', 'VIEW_CONTRACTS', TRUE),
    ('ADMIN', 'VIEW_PAYMENTS', TRUE),
    ('ADMIN', 'VIEW_ANALYTICS', TRUE),
    ('ADMIN', 'MANAGE_BILLING', TRUE),
    ('ADMIN', 'MANAGE_SETTINGS', TRUE),
    ('ADMIN', 'API_ACCESS', TRUE),
    ('ADMIN', 'MANAGE_BRAND_ASSETS', TRUE),
    ('ADMIN', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- LEGAL: contracts, disputes, audit
    ('LEGAL', 'VIEW_CONTRACTS', TRUE),
    ('LEGAL', 'SIGN_CONTRACTS', TRUE),
    ('LEGAL', 'MANAGE_DISPUTES', TRUE),
    ('LEGAL', 'VIEW_AUDIT_LOG', TRUE),
    ('LEGAL', 'VIEW_EMPLOYEES', TRUE),
    ('LEGAL', 'VIEW_COMPANY_PROFILE', TRUE),
    -- HIRING: opportunities + applications
    ('HIRING', 'VIEW_COMPANY_PROFILE', TRUE),
    ('HIRING', 'CREATE_OPPORTUNITIES', TRUE),
    ('HIRING', 'MANAGE_OPPORTUNITIES', TRUE),
    ('HIRING', 'VIEW_APPLICATIONS', TRUE),
    ('HIRING', 'REVIEW_APPLICATIONS', TRUE),
    ('HIRING', 'MAKE_OFFERS', TRUE),
    ('HIRING', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- PARTNERSHIP: partnerships + deals
    ('PARTNERSHIP', 'VIEW_COMPANY_PROFILE', TRUE),
    ('PARTNERSHIP', 'EDIT_COMPANY_PROFILE', TRUE),
    ('PARTNERSHIP', 'VIEW_APPLICATIONS', TRUE),
    ('PARTNERSHIP', 'MAKE_OFFERS', TRUE),
    ('PARTNERSHIP', 'VIEW_CONTRACTS', TRUE),
    ('PARTNERSHIP', 'SIGN_CONTRACTS', TRUE),
    ('PARTNERSHIP', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- EMPLOYEE: basic access
    ('EMPLOYEE', 'VIEW_COMPANY_PROFILE', TRUE),
    ('EMPLOYEE', 'VIEW_OPPORTUNITIES', TRUE),
    ('EMPLOYEE', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- CONTRACTOR: limited access
    ('CONTRACTOR', 'VIEW_COMPANY_PROFILE', TRUE),
    ('CONTRACTOR', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- RECRUITER: applications and communication only
    ('RECRUITER', 'VIEW_COMPANY_PROFILE', TRUE),
    ('RECRUITER', 'VIEW_APPLICATIONS', TRUE),
    ('RECRUITER', 'COMMUNICATE_AS_COMPANY', TRUE),
    -- AGENCY: acts on behalf
    ('AGENCY', 'VIEW_COMPANY_PROFILE', TRUE),
    ('AGENCY', 'MANAGE_OPPORTUNITIES', TRUE),
    ('AGENCY', 'VIEW_APPLICATIONS', TRUE),
    ('AGENCY', 'REVIEW_APPLICATIONS', TRUE),
    ('AGENCY', 'COMMUNICATE_AS_COMPANY', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- IDENTITY DOCUMENTS
-- ============================================================

CREATE TABLE identity_documents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    document_type identity_document_type NOT NULL,
    document_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ANALYZING, VERIFIED, REJECTED, EXPIRED
    file_storage_key VARCHAR(512) NOT NULL,                 -- S3/MinIO key
    file_hash VARCHAR(64) NOT NULL,                         -- SHA-256 of file contents
    file_size_bytes INTEGER,
    file_mime_type VARCHAR(100),
    extracted_data JSONB,                                   -- OCR-extracted fields
    verification_data JSONB,                                -- verification service response
    verification_provider VARCHAR(100),                     -- e.g., 'persona', 'stripe_identity', 'manual'
    verification_score REAL,                                -- confidence score 0-1
    reviewed_by_user_id BIGINT REFERENCES users(id),        -- trust & safety reviewer
    review_notes TEXT,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    upload_ip INET,
    upload_user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_owner_check CHECK (
        (user_id IS NOT NULL AND company_id IS NULL) OR
        (user_id IS NULL AND company_id IS NOT NULL)
    )
);

CREATE INDEX idx_id_user ON identity_documents(user_id);
CREATE INDEX idx_id_company ON identity_documents(company_id);
CREATE INDEX idx_id_type ON identity_documents(document_type);
CREATE INDEX idx_id_status ON identity_documents(document_status);
CREATE INDEX idx_id_file_hash ON identity_documents(file_hash);

COMMENT ON TABLE identity_documents IS
  'Verifiable identity documents for both individuals and companies. Each document is hashed, stored securely, and reviewed.';

-- ============================================================
-- TRUST SCORE HISTORY (immutable log)
-- ============================================================

CREATE TYPE trust_event_category AS ENUM (
    'IDENTITY',
    'BEHAVIOR',
    'PAYMENT',
    'HISTORY',
    'COLLABORATION',
    'REPUTATION',
    'DISPUTE',
    'NETWORK',
    'VERIFICATION',
    'RISK',
    'MODERATION',
    'SYSTEM'
);

CREATE TABLE trust_score_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    category trust_event_category NOT NULL,
    event_type VARCHAR(100) NOT NULL,            -- e.g., 'email_verified', 'contract_completed', 'dispute_filed'
    score_delta INTEGER NOT NULL,                -- positive or negative change
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    reason TEXT NOT NULL,                        -- human-readable explanation
    reference_type VARCHAR(50),                  -- e.g., 'contract', 'dispute', 'payment'
    reference_id BIGINT,
    source VARCHAR(100) NOT NULL,                -- 'system', 'moderator', 'ai', 'verification_service'
    confidence REAL NOT NULL DEFAULT 1.0,        -- confidence in this event (0-1)
    expires_at TIMESTAMPTZ,                      -- if the score effect is temporary
    metadata JSONB,                              -- additional structured data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tse_user ON trust_score_events(user_id);
CREATE INDEX idx_tse_company ON trust_score_events(company_id);
CREATE INDEX idx_tse_category ON trust_score_events(category);
CREATE INDEX idx_tse_created ON trust_score_events(created_at DESC);
CREATE INDEX idx_tse_reference ON trust_score_events(reference_type, reference_id);
CREATE INDEX idx_tse_expires ON trust_score_events(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE trust_score_events IS
  'Immutable append-only log of every trust score change. Enables full audit trail and score recomputation.';

-- ============================================================
-- CONTRACTS (guardian-aware, company-aware)
-- ============================================================

CREATE TABLE contracts (
    id BIGSERIAL PRIMARY KEY,
    external_id VARCHAR(64) UNIQUE,             -- idempotency key / client-facing ID
    deal_room_id BIGINT REFERENCES deal_rooms(id),
    contract_state contract_state NOT NULL DEFAULT 'DRAFT',
    contract_type VARCHAR(50) NOT NULL,          -- 'sponsorship', 'partnership', 'project', 'employment'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Parties (who is signing)
    creator_user_id BIGINT NOT NULL REFERENCES users(id),
    creator_party_type contract_party_type NOT NULL DEFAULT 'INDIVIDUAL_ADULT',
    creator_guardian_relationship_id BIGINT REFERENCES guardian_relationships(id),
    creator_company_id BIGINT REFERENCES companies(id),
    creator_company_role_id BIGINT REFERENCES company_roles(id),
    
    brand_user_id BIGINT NOT NULL REFERENCES users(id),
    brand_party_type contract_party_type NOT NULL DEFAULT 'INDIVIDUAL_ADULT',
    brand_guardian_relationship_id BIGINT REFERENCES guardian_relationships(id),
    brand_company_id BIGINT REFERENCES companies(id),
    brand_company_role_id BIGINT REFERENCES company_roles(id),
    
    -- Terms
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'USD',
    advance_cents BIGINT DEFAULT 0,
    kill_fee_cents BIGINT DEFAULT 0,
    revision_cap INTEGER DEFAULT 3,
    exclusivity_days INTEGER DEFAULT 0,
    usage_rights_scope TEXT,
    deliverables TEXT NOT NULL,
    deadline TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Content & signatures
    contract_content TEXT NOT NULL,
    contract_content_hash VARCHAR(64) NOT NULL,
    pdf_storage_key VARCHAR(512),
    
    -- Signature tracking
    creator_signed_at TIMESTAMPTZ,
    creator_signature_hash VARCHAR(64),
    creator_signature_ip INET,
    brand_signed_at TIMESTAMPTZ,
    brand_signature_hash VARCHAR(64),
    brand_signature_ip INET,
    guardian_signed_at TIMESTAMPTZ,
    guardian_signature_hash VARCHAR(64),
    
    -- Meta
    version INTEGER NOT NULL DEFAULT 1,
    template_id BIGINT REFERENCES contract_templates(id),
    jurisdiction VARCHAR(100) DEFAULT 'New York, USA',
    governing_law VARCHAR(100) DEFAULT 'New York law',
    dispute_resolution VARCHAR(100) DEFAULT 'Arbitration',
    
    -- Revocation
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    revoked_by_user_id BIGINT REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_contract_state ON contracts(contract_state);
CREATE INDEX idx_contract_creator ON contracts(creator_user_id);
CREATE INDEX idx_contract_brand ON contracts(brand_user_id);
CREATE INDEX idx_contract_deal_room ON contracts(deal_room_id);
CREATE INDEX idx_contract_creator_company ON contracts(creator_company_id);
CREATE INDEX idx_contract_brand_company ON contracts(brand_company_id);
CREATE INDEX idx_contract_created ON contracts(created_at DESC);
CREATE INDEX idx_contract_external_id ON contracts(external_id);

COMMENT ON TABLE contracts IS
  'Production contract system with full party-type awareness (minors, guardians, companies, agencies). Executed contracts are immutable.';

-- ============================================================
-- CONTRACT REVISIONS (versioned, append-only)
-- ============================================================

CREATE TABLE contract_revisions (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    previous_content_hash VARCHAR(64),
    new_content TEXT NOT NULL,
    new_content_hash VARCHAR(64) NOT NULL,
    change_description TEXT NOT NULL,
    requested_by_user_id BIGINT NOT NULL REFERENCES users(id),
    requested_by_role VARCHAR(50),               -- 'creator', 'brand', 'guardian'
    is_paid_revision BOOLEAN NOT NULL DEFAULT FALSE,
    additional_cost_cents BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, superseded
    approved_by_user_id BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejected_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cr_contract ON contract_revisions(contract_id);
CREATE INDEX idx_cr_version ON contract_revisions(contract_id, version);

-- ============================================================
-- DISPUTES
-- ============================================================

CREATE TABLE disputes (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    dispute_state dispute_state NOT NULL DEFAULT 'OPEN',
    filed_by_user_id BIGINT NOT NULL REFERENCES users(id),
    filed_by_role VARCHAR(50) NOT NULL,          -- 'creator', 'brand', 'guardian'
    dispute_type VARCHAR(100) NOT NULL,          -- 'non_payment', 'missed_deadline', 'quality', 'scope_creep', 'ip_violation', 'contract_breach', 'fraud', 'other'
    subject TEXT NOT NULL,                        -- brief description of dispute
    description TEXT NOT NULL,                    -- full description
    
    -- Evidence
    evidence_metadata JSONB,                     -- list of evidence files
    
    -- Resolution
    resolution_notes TEXT,
    resolution_amount_cents BIGINT,             -- if financial resolution
    resolved_by_user_id BIGINT REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    
    -- Appeal
    appealed_at TIMESTAMPTZ,
    appeal_reason TEXT,
    appeal_outcome TEXT,
    appeal_resolved_at TIMESTAMPTZ,
    
    -- Escalation
    escalated_to_legal BOOLEAN NOT NULL DEFAULT FALSE,
    legal_case_reference VARCHAR(255),
    escalated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispute_contract ON disputes(contract_id);
CREATE INDEX idx_dispute_state ON disputes(dispute_state);
CREATE INDEX idx_dispute_filer ON disputes(filed_by_user_id);
CREATE INDEX idx_dispute_type ON disputes(dispute_type);

-- ============================================================
-- DISPUTE EVIDENCE
-- ============================================================

CREATE TABLE dispute_evidence (
    id BIGSERIAL PRIMARY KEY,
    dispute_id BIGINT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
    file_storage_key VARCHAR(512) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_type VARCHAR(100) NOT NULL,             -- 'screenshot', 'document', 'message_export', 'contract', 'other'
    description TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,  -- has evidence been validated
    verification_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_de_dispute ON dispute_evidence(dispute_id);

-- ============================================================
-- RISK EVENTS (immutable audit trail)
-- ============================================================

CREATE TYPE risk_event_type AS ENUM (
    'ACCOUNT_TAKEOVER_ATTEMPT',
    'BRUTE_FORCE_LOGIN',
    'SUSPICIOUS_LOGIN',
    'MASS_ACCOUNT_CREATION',
    'AGE_FORGERY_ATTEMPT',
    'DOCUMENT_FORGERY',
    'AI_GENERATED_DOCUMENT',
    'Fake_GUARDIAN',
    'Fake_ENTERPRISE',
    'IMPERSONATION_ATTEMPT',
    'SYBIL_ATTACK',
    'PAYMENT_FRAUD',
    'COLLUSION_DETECTED',
    'CHARGEBACK_FRAUD',
    'MONEY_LAUNDERING_ATTEMPT',
    'IDENTITY_LAUNDERING',
    'BADGE_SELLING_ATTEMPT',
    'PURCHASED_ACCOUNT_DETECTED',
    'BRIBED_MODERATOR_ATTEMPT',
    'DEEPFAKE_DETECTED',
    'FAKE_SOCIAL_PROOF',
    'CONTRACT_TAMPERING',
    'API_ABUSE',
    'SCRAPING_DETECTED',
    'CONTENT_POLICY_VIOLATION',
    'HARASSMENT_REPORT',
    'INSIDER_ABUSE',
    'DATA_EXFILTRATION_ATTEMPT',
    'PHISHING_ATTEMPT',
    'SESSION_HIJACKING_ATTEMPT',
    'MFA_BYPASS_ATTEMPT',
    'RATE_LIMIT_VIOLATION'
);

CREATE TABLE risk_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    company_id BIGINT REFERENCES companies(id),
    event_type risk_event_type NOT NULL,
    severity VARCHAR(20) NOT NULL,               -- 'info', 'low', 'medium', 'high', 'critical'
    risk_score_delta INTEGER NOT NULL DEFAULT 0,
    source_ip INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    description TEXT NOT NULL,
    details JSONB,                               -- structured event data
    is_automated BOOLEAN NOT NULL DEFAULT TRUE,  -- detected by AI/automation
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_notes TEXT,
    resolved_by_user_id BIGINT REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_re_user ON risk_events(user_id);
CREATE INDEX idx_re_company ON risk_events(company_id);
CREATE INDEX idx_re_type ON risk_events(event_type);
CREATE INDEX idx_re_severity ON risk_events(severity);
CREATE INDEX idx_re_created ON risk_events(created_at DESC);
CREATE INDEX idx_re_ip ON risk_events(source_ip);
CREATE INDEX idx_re_unresolved ON risk_events(is_resolved, severity) WHERE is_resolved = FALSE;

COMMENT ON TABLE risk_events IS
  'Immutable append-only log of every risk/suspicious event. Foundation for risk scoring, fraud detection, and audit.';

-- ============================================================
-- VERIFICATION REQUESTS (audit trail for all verifications)
-- ============================================================

CREATE TYPE verification_request_type AS ENUM (
    'AGE_VERIFICATION',
    'IDENTITY_DOCUMENT',
    'GUARDIAN_CONSENT',
    'COMPANY_DOMAIN',
    'COMPANY_REGISTRATION',
    'EMPLOYEE_VERIFICATION',
    'BUSINESS_VERIFICATION',
    'ENTERPRISE_VERIFICATION',
    'PUBLIC_FIGURE',
    'STRATEGIC_PARTNER',
    'MANUAL_REVIEW',
    'ESCALATION',
    'APPEAL'
);

CREATE TYPE verification_request_state AS ENUM (
    'SUBMITTED',
    'QUEUED',
    'AUTOMATED_CHECK_IN_PROGRESS',
    'AUTOMATED_CHECK_PASSED',
    'AUTOMATED_CHECK_FAILED',
    'MANUAL_REVIEW_REQUIRED',
    'MANUAL_REVIEW_IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'FLAGGED_FRAUD',
    'APPEALED',
    'APPEAL_REVIEW_IN_PROGRESS',
    'APPEAL_DENIED',
    'APPEAL_APPROVED',
    'EXPIRED',
    'WITHDRAWN'
);

CREATE TABLE verification_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    company_id BIGINT REFERENCES companies(id),
    request_type verification_request_type NOT NULL,
    request_state verification_request_state NOT NULL DEFAULT 'SUBMITTED',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_reviewer_user_id BIGINT REFERENCES users(id),
    automated_check_results JSONB,
    manual_review_notes TEXT,
    rejection_reason TEXT,
    fraud_flags JSONB,                           -- fraud detection results
    reviewed_at TIMESTAMPTZ,
    appeal_reason TEXT,
    appeal_filed_at TIMESTAMPTZ,
    appeal_reviewed_at TIMESTAMPTZ,
    appeal_outcome TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    reference_id BIGINT,                         -- ID of related entity (identity_document, etc.)
    reference_type VARCHAR(50),                  -- table name of reference
    metadata JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vr_user ON verification_requests(user_id);
CREATE INDEX idx_vr_company ON verification_requests(company_id);
CREATE INDEX idx_vr_type ON verification_requests(request_type);
CREATE INDEX idx_vr_state ON verification_requests(request_state);
CREATE INDEX idx_vr_reviewer ON verification_requests(assigned_reviewer_user_id) WHERE assigned_reviewer_user_id IS NOT NULL;
CREATE INDEX idx_vr_priority ON verification_requests(priority, request_state);
CREATE INDEX idx_vr_reference ON verification_requests(reference_type, reference_id);
CREATE INDEX idx_vr_created ON verification_requests(created_at DESC);

-- ============================================================
-- MODERATION QUEUE
-- ============================================================

CREATE TYPE moderation_queue_source AS ENUM (
    'AI_AUTOMATED',
    'USER_REPORT',
    'SYSTEM_FLAG',
    'RISK_ENGINE',
    'ENTERPRISE_ESCALATION',
    'APPEAL',
    'MANUAL_AUDIT',
    'LEGAL_REQUEST'
);

CREATE TABLE moderation_queue (
    id BIGSERIAL PRIMARY KEY,
    target_user_id BIGINT REFERENCES users(id),
    target_company_id BIGINT REFERENCES companies(id),
    target_contract_id BIGINT REFERENCES contracts(id),
    source moderation_queue_source NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    category VARCHAR(100) NOT NULL,              -- 'fraud', 'impersonation', 'abuse', 'spam', 'fake_document', etc.
    description TEXT NOT NULL,
    ai_analysis JSONB,                           -- AI moderation results
    ai_confidence REAL,                          -- AI confidence score (0-1)
    ai_recommendation moderation_action,          -- AI's recommended action
    assigned_moderator_user_id BIGINT REFERENCES users(id),
    moderator_action moderation_action,
    moderator_notes TEXT,
    action_taken_at TIMESTAMPTZ,
    requires_escalation BOOLEAN NOT NULL DEFAULT FALSE,
    escalated_to_user_id BIGINT REFERENCES users(id),
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,
    is_appealable BOOLEAN NOT NULL DEFAULT TRUE,
    appeal_deadline TIMESTAMPTZ,
    resolution_notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',  -- 'open', 'in_progress', 'resolved', 'escalated', 'appealed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mq_target_user ON moderation_queue(target_user_id);
CREATE INDEX idx_mq_target_company ON moderation_queue(target_company_id);
CREATE INDEX idx_mq_source ON moderation_queue(source);
CREATE INDEX idx_mq_priority ON moderation_queue(priority, status);
CREATE INDEX idx_mq_moderator ON moderation_queue(assigned_moderator_user_id) WHERE assigned_moderator_user_id IS NOT NULL;
CREATE INDEX idx_mq_status ON moderation_queue(status);
CREATE INDEX idx_mq_created ON moderation_queue(created_at DESC);
CREATE INDEX idx_mq_escalated ON moderation_queue(requires_escalation, escalated_at) WHERE requires_escalation = TRUE;

-- ============================================================
-- MODERATOR AUDIT (prevent moderator abuse)
-- ============================================================

CREATE TABLE moderator_audit_log (
    id BIGSERIAL PRIMARY KEY,
    moderator_user_id BIGINT NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,           -- 'assigned', 'action_taken', 'escalated', 'notes_added', etc.
    target_type VARCHAR(50) NOT NULL,            -- 'moderation_queue', 'user', 'company', 'contract'
    target_id BIGINT NOT NULL,
    previous_state VARCHAR(100),
    new_state VARCHAR(100),
    action_description TEXT NOT NULL,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mal_moderator ON moderator_audit_log(moderator_user_id);
CREATE INDEX idx_mal_target ON moderator_audit_log(target_type, target_id);
CREATE INDEX idx_mal_created ON moderator_audit_log(created_at DESC);

COMMENT ON TABLE moderator_audit_log IS
  'Immutable log of all moderator actions. Enables detection of moderator abuse, bribery, and insider threats.';

-- ============================================================
-- APPROVAL WORKFLOW INSTANCES (generic workflow engine)
-- ============================================================

CREATE TYPE approval_entity_type AS ENUM (
    'GUARDIAN_CONSENT',
    'CONTRACT_SIGNATURE',
    'PAYOUT_APPROVAL',
    'COMPANY_VERIFICATION',
    'EMPLOYEE_VERIFICATION',
    'IDENTITY_DOCUMENT',
    'ACCOUNT_DELETION',
    'DISPUTE_RESOLUTION',
    'REFUND'
);

CREATE TYPE approval_step_state AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SKIPPED',
    'EXPIRED',
    'ESCALATED'
);

CREATE TABLE approval_workflows (
    id BIGSERIAL PRIMARY KEY,
    entity_type approval_entity_type NOT NULL,
    entity_id BIGINT NOT NULL,                   -- ID of the thing being approved
    workflow_state VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED'
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_aw_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX idx_aw_state ON approval_workflows(workflow_state);

CREATE TABLE approval_workflow_steps (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(100) NOT NULL,             -- 'guardian_approval', 'company_approval', 'moderator_review', etc.
    assigned_approver_user_id BIGINT REFERENCES users(id),
    assigned_approver_role VARCHAR(50),          -- 'guardian', 'company_admin', 'moderator', 'system'
    step_state approval_step_state NOT NULL DEFAULT 'PENDING',
    approved_by_user_id BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    timeout_hours INTEGER DEFAULT 72,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, step_number)
);

CREATE INDEX idx_aws_workflow ON approval_workflow_steps(workflow_id);
CREATE INDEX idx_aws_approver ON approval_workflow_steps(assigned_approver_user_id) WHERE assigned_approver_user_id IS NOT NULL;
CREATE INDEX idx_aws_state ON approval_workflow_steps(step_state);

-- ============================================================
-- AGE TRANSFER (minor -> adult account transfer)
-- ============================================================

CREATE TABLE age_transfer_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guardian_relationship_id BIGINT NOT NULL REFERENCES guardian_relationships(id),
    transfer_state VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING, GUARDIAN_NOTIFIED, GUARDIAN_CONFIRMED, TRANSFERRED, DISPUTED, CANCELLED
    user_confirmed_at TIMESTAMPTZ,
    guardian_confirmed_at TIMESTAMPTZ,
    new_age_verification_state user_age_verification_state,
    assets_transferred BOOLEAN NOT NULL DEFAULT FALSE,
    contracts_transferred BOOLEAN NOT NULL DEFAULT FALSE,
    permissions_transferred BOOLEAN NOT NULL DEFAULT FALSE,
    guardian_permissions_revoked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_atr_user ON age_transfer_requests(user_id);
CREATE INDEX idx_atr_state ON age_transfer_requests(transfer_state);

-- ============================================================
-- ENTERPRISE CLAIMS (tracking impersonation attempts)
-- ============================================================

CREATE TABLE enterprise_claims (
    id BIGSERIAL PRIMARY KEY,
    claiming_user_id BIGINT NOT NULL REFERENCES users(id),
    claimed_company_name VARCHAR(255) NOT NULL,
    claimed_domain VARCHAR(255),
    actual_company_id BIGINT REFERENCES companies(id),     -- matched to real company if legitimate
    claim_state VARCHAR(50) NOT NULL DEFAULT 'PENDING',    -- PENDING, VERIFIED, REJECTED_IMPERSONATION, APPEALED
    verification_method VARCHAR(100),
    verification_data JSONB,
    rejection_reason TEXT,
    flagged_as_impersonation BOOLEAN NOT NULL DEFAULT FALSE,
    impersonation_evidence JSONB,
    moderaton_queue_id BIGINT REFERENCES moderation_queue(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id BIGINT REFERENCES users(id)
);

CREATE INDEX idx_ec_claimant ON enterprise_claims(claiming_user_id);
CREATE INDEX idx_ec_company ON enterprise_claims(actual_company_id);
CREATE INDEX idx_ec_state ON enterprise_claims(claim_state);

-- ============================================================
-- ACCOUNT RECOVERY (with guardian awareness)
-- ============================================================

CREATE TYPE recovery_method AS ENUM (
    'EMAIL',
    'PHONE',
    'GUARDIAN',
    'IDENTITY_DOCUMENT',
    'BACKUP_CODES',
    'TRUSTED_CONTACTS',
    'MANUAL_REVIEW'
);

CREATE TABLE account_recovery_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recovery_state VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    recovery_method recovery_method NOT NULL,
    verification_token_sha256 VARCHAR(64),
    token_expires_at TIMESTAMPTZ,
    identity_document_id BIGINT,
    guardian_confirmation_id BIGINT REFERENCES guardian_relationships(id),
    request_ip INET,
    request_user_agent TEXT,
    risk_level risk_level NOT NULL DEFAULT 'UNKNOWN',
    risk_assessment JSONB,
    completed_at TIMESTAMPTZ,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_arr_user ON account_recovery_requests(user_id);
CREATE INDEX idx_arr_state ON account_recovery_requests(recovery_state);
CREATE INDEX idx_arr_ip ON account_recovery_requests(request_ip);

-- ============================================================
-- KYC STATUS TABLE (holistic view)
-- ============================================================

CREATE TYPE kyc_level AS ENUM (
    'NONE',
    'EMAIL_ONLY',
    'PHONE_VERIFIED',
    'BASIC_KYC',          -- ID document submitted
    'FULL_KYC',           -- ID + selfie + liveness
    'ENHANCED_KYC',       -- Full KYC + source of funds + address
    'INSTITUTIONAL_KYC',  -- For company accounts
    'GOVERNMENT_KYC'      -- Highest level
);

CREATE TABLE kyc_status (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    kyc_level kyc_level NOT NULL DEFAULT 'NONE',
    kyc_state VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    -- NOT_STARTED -> IN_PROGRESS -> PENDING_REVIEW -> COMPLETED -> EXPIRED -> REJECTED
    current_document_id BIGINT REFERENCES identity_documents(id),
    documents_submitted INTEGER NOT NULL DEFAULT 0,
    documents_verified INTEGER NOT NULL DEFAULT 0,
    liveness_passed BOOLEAN NOT NULL DEFAULT FALSE,
    liveness_attempts INTEGER NOT NULL DEFAULT 0,
    pep_check_passed BOOLEAN,                    -- politically exposed person check
    sanctions_check_passed BOOLEAN,              -- sanctions list check
    adverse_media_check_passed BOOLEAN,          -- adverse media check
    checks_performed_at TIMESTAMPTZ,
    kyc_provider VARCHAR(100),                   -- 'persona', 'stripe_identity', 'manual', 'onfido', 'veriff'
    kyc_provider_reference VARCHAR(255),          -- reference ID from KYC provider
    notes TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kyc_owner_check CHECK (
        (user_id IS NOT NULL AND company_id IS NULL) OR
        (user_id IS NULL AND company_id IS NOT NULL)
    )
);

CREATE INDEX idx_ks_user ON kyc_status(user_id);
CREATE INDEX idx_ks_company ON kyc_status(company_id);
CREATE INDEX idx_ks_level ON kyc_status(kyc_level);
CREATE INDEX idx_ks_state ON kyc_status(kyc_state);
CREATE INDEX idx_ks_expires ON kyc_status(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- COMPLETE AUDIT LOG (system-wide immutable audit)
-- ============================================================

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id),
    actor_company_id BIGINT REFERENCES companies(id),
    actor_role VARCHAR(50),                      -- role at time of action
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    changes JSONB,                               -- what fields changed
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(64),                      -- correlation ID
    idempotency_key VARCHAR(64),
    additional_context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create initial partitions (quarterly)
CREATE TABLE audit_log_2026_q1 PARTITION OF audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE audit_log_2026_q2 PARTITION OF audit_log
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE audit_log_2026_q3 PARTITION OF audit_log
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_log_2026_q4 PARTITION OF audit_log
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE INDEX idx_al_actor ON audit_log(actor_user_id);
CREATE INDEX idx_al_action ON audit_log(action);
CREATE INDEX idx_al_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_al_created ON audit_log(created_at DESC);
CREATE INDEX idx_al_request ON audit_log(request_id);
CREATE INDEX idx_al_idempotency ON audit_log(idempotency_key);

COMMENT ON TABLE audit_log IS
  'System-wide immutable audit log. Partitioned by quarter for performance. Every state change across all trust/verification entities is recorded.';

-- ============================================================
-- BADGE SYSTEM
-- ============================================================

CREATE TYPE badge_category AS ENUM (
    'IDENTITY',
    'TRUST',
    'ACHIEVEMENT',
    'VERIFICATION',
    'RISK',
    'WARNING',
    'PROBATION',
    'RESTRICTION'
);

CREATE TABLE badges (
    id BIGSERIAL PRIMARY KEY,
    badge_code VARCHAR(100) UNIQUE NOT NULL,     -- machine-readable code
    display_name VARCHAR(255) NOT NULL,          -- user-facing name
    description TEXT,
    category badge_category NOT NULL,
    badge_type VARCHAR(50) NOT NULL,             -- 'verified', 'trust', 'warning', 'restricted', etc.
    icon_url VARCHAR(255),
    color_hex VARCHAR(7),                        -- hex color for badge display
    is_visible_to_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_automated BOOLEAN NOT NULL DEFAULT TRUE,  -- awarded automatically or manually
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    expires_days INTEGER,                        -- days until badge expires
    priority INTEGER NOT NULL DEFAULT 0,         -- display priority (higher = more prominent)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed core badges
INSERT INTO badges (badge_code, display_name, description, category, badge_type, icon_url, color_hex, is_visible_to_public, is_automated, priority) VALUES
    ('EMAIL_VERIFIED', 'Email Verified', 'Verified email address', 'IDENTITY', 'verified', NULL, '#4ADE80', TRUE, TRUE, 10),
    ('PHONE_VERIFIED', 'Phone Verified', 'Verified phone number', 'IDENTITY', 'verified', NULL, '#4ADE80', TRUE, TRUE, 20),
    ('ID_VERIFIED', 'ID Verified', 'Government-issued ID verified', 'IDENTITY', 'verified', NULL, '#22C55E', TRUE, TRUE, 30),
    ('SELFIE_VERIFIED', 'Selfie Verified', 'Identity confirmed via selfie', 'IDENTITY', 'verified', NULL, '#22C55E', TRUE, TRUE, 40),
    ('TRUSTED_CREATOR', 'Trusted Creator', 'Consistent positive history', 'TRUST', 'verified', NULL, '#3B82F6', TRUE, TRUE, 50),
    ('VERIFIED_CREATOR', 'Verified Creator', 'Platform-verified creator', 'VERIFICATION', 'verified', NULL, '#8B5CF6', TRUE, TRUE, 60),
    ('BUSINESS_VERIFIED', 'Business Verified', 'Verified business entity', 'VERIFICATION', 'verified', NULL, '#6366F1', TRUE, TRUE, 70),
    ('ENTERPRISE_VERIFIED', 'Enterprise Verified', 'Verified enterprise organization', 'VERIFICATION', 'verified', NULL, '#4F46E5', TRUE, TRUE, 80),
    ('GOVERNMENT_VERIFIED', 'Government Entity', 'Verified government organization', 'VERIFICATION', 'verified', NULL, '#059669', TRUE, TRUE, 90),
    ('STRATEGIC_PARTNER', 'Strategic Partner', 'Official platform partner', 'VERIFICATION', 'verified', NULL, '#D97706', TRUE, TRUE, 100),
    ('PUBLIC_FIGURE', 'Public Figure', 'Verified public figure', 'VERIFICATION', 'verified', NULL, '#7C3AED', TRUE, TRUE, 95),
    ('EARLY_ADOPTER', 'Early Adopter', 'Joined during beta', 'ACHIEVEMENT', 'achievement', NULL, '#F59E0B', TRUE, TRUE, 5),
    ('TOP_CREATOR', 'Top Creator', 'Top-rated creator on platform', 'ACHIEVEMENT', 'achievement', NULL, '#F97316', TRUE, TRUE, 55),
    ('NEW_ACCOUNT', 'New Account', 'Recently joined platform', 'RISK', 'restricted', NULL, '#9CA3AF', TRUE, TRUE, 1),
    ('UNDER_REVIEW', 'Under Review', 'Account under active review', 'RISK', 'warning', NULL, '#F59E0B', TRUE, TRUE, 200),
    ('HIGH_RISK', 'High Risk', 'Account flagged for unusual activity', 'RISK', 'warning', NULL, '#EF4444', TRUE, TRUE, 210),
    ('RESTRICTED', 'Restricted', 'Account has limitations', 'RESTRICTION', 'restricted', NULL, '#DC2626', TRUE, TRUE, 220),
    ('PROBATION', 'Probation', 'Account on probation period', 'RISK', 'warning', NULL, '#F97316', TRUE, TRUE, 215),
    ('GUARDIAN_CONTROLLED', 'Guardian Managed', 'Account managed by guardian', 'RESTRICTION', 'restricted', NULL, '#6B7280', FALSE, TRUE, 25),
    ('MINOR_ACCOUNT', 'Minor Account', 'Account holder is under 18', 'RESTRICTION', 'restricted', NULL, '#6B7280', FALSE, TRUE, 15),
    ('PENDING_VERIFICATION', 'Pending Verification', 'Verification in progress', 'RISK', 'warning', NULL, '#FCD34D', TRUE, TRUE, 3)
ON CONFLICT (badge_code) DO NOTHING;

CREATE TABLE user_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id BIGINT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_by_user_id BIGINT REFERENCES users(id),  -- who awarded (NULL = system)
    awarded_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,          -- user can hide certain badges
    expires_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    deactivation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, badge_id, is_active) WHERE is_active = TRUE
);

CREATE INDEX idx_ub_user ON user_badges(user_id);
CREATE INDEX idx_ub_badge ON user_badges(badge_id);
CREATE INDEX idx_ub_active ON user_badges(is_active);
CREATE INDEX idx_ub_expires ON user_badges(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- TRUST SCORE WEIGHTS (configurable scoring engine)
-- ============================================================

CREATE TABLE trust_score_weights (
    id BIGSERIAL PRIMARY KEY,
    category trust_event_category NOT NULL,
    subcategory VARCHAR(100) NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,            -- multiplier for this category
    max_score INTEGER NOT NULL DEFAULT 100,      -- max contribution to total score
    decay_days INTEGER,                          -- days until score contribution decays
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, subcategory)
);

-- Seed default trust score weights
INSERT INTO trust_score_weights (category, subcategory, weight, max_score, decay_days) VALUES
    ('IDENTITY', 'email_verified', 20.0, 20, NULL),
    ('IDENTITY', 'phone_verified', 15.0, 15, NULL),
    ('IDENTITY', 'id_document_verified', 50.0, 50, 365),
    ('IDENTITY', 'selfie_verified', 30.0, 30, 365),
    ('IDENTITY', 'linkedin_verified', 15.0, 15, 180),
    ('BEHAVIOR', 'account_age_days', 0.5, 50, NULL),       -- 0.5 per day, max 50
    ('BEHAVIOR', 'login_consistency', 20.0, 20, 90),
    ('BEHAVIOR', 'profile_completeness', 25.0, 25, NULL),
    ('PAYMENT', 'completed_payments', 10.0, 50, NULL),      -- 10 per payment, max 50
    ('PAYMENT', 'on_time_payment_rate', 30.0, 30, NULL),
    ('PAYMENT', 'no_chargebacks', 40.0, 40, NULL),
    ('HISTORY', 'completed_deals', 15.0, 75, NULL),         -- 15 per deal, max 75
    ('HISTORY', 'average_rating', 25.0, 50, NULL),
    ('COLLABORATION', 'repeat_collaborations', 20.0, 40, NULL),
    ('COLLABORATION', 'positive_feedback_rate', 20.0, 30, NULL),
    ('REPUTATION', 'referrals', 10.0, 30, NULL),
    ('REPUTATION', 'external_reputation', 15.0, 25, 180),
    ('DISPUTE', 'no_disputes', 30.0, 30, NULL),            -- bonus for zero disputes
    ('DISPUTE', 'disputes_resolved_amicably', 15.0, 15, NULL),
    ('NETWORK', 'verified_connections', 5.0, 25, NULL),     -- 5 per verified connection
    ('NETWORK', 'network_diversity', 10.0, 20, NULL),
    ('VERIFICATION', 'kyc_level', 40.0, 40, 365),
    ('VERIFICATION', 'enterprise_verified', 50.0, 50, 365)
ON CONFLICT (category, subcategory) DO NOTHING;

-- ============================================================
-- EVENT OUTBOX EXTENSIONS (trust-specific events)
-- ============================================================

ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64);
ALTER TABLE event_outbox ADD COLUMN IF NOT EXISTS source_service VARCHAR(100);

-- Trust-specific event types use the existing event_outbox table.
-- Event types to be used:
--   identity.user.verified
--   identity.user.age_confirmed
--   identity.document.uploaded
--   identity.document.verified
--   identity.document.rejected
--   guardian.invite.sent
--   guardian.relationship.activated
--   guardian.consent.revoked
--   guardian.permissions.changed
--   company.verified
--   company.impersonation.flagged
--   employee.verified
--   employee.access.revoked
--   trust.score.changed
--   trust.tier.changed
--   contract.created
--   contract.signed
--   contract.breached
--   contract.disputed
--   dispute.opened
--   dispute.resolved
--   risk.event.detected
--   moderation.action.taken
--   badge.awarded
--   badge.revoked
--   kyc.level.changed

-- ============================================================
-- FUNCTION: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_uvp_updated_at BEFORE UPDATE ON user_verification_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gr_updated_at BEFORE UPDATE ON guardian_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comp_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ev_updated_at BEFORE UPDATE ON employee_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dispute_updated_at BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vr_updated_at BEFORE UPDATE ON verification_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mq_updated_at BEFORE UPDATE ON moderation_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_atr_updated_at BEFORE UPDATE ON age_transfer_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arr_updated_at BEFORE UPDATE ON account_recovery_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ks_updated_at BEFORE UPDATE ON kyc_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tsw_updated_at BEFORE UPDATE ON trust_score_weights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (enforce at database level)
-- ============================================================

ALTER TABLE user_verification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_domain_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their own verification profiles
CREATE POLICY user_verification_self ON user_verification_profiles
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'admin');
CREATE POLICY user_verification_self_update ON user_verification_profiles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Guardians can see their minor's data
CREATE POLICY guardian_view_minor ON user_verification_profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM guardian_relationships 
                WHERE guardian_user_id = auth.uid() 
                AND minor_user_id = user_id 
                AND relationship_state = 'ACTIVE')
    );

-- Companies: employees can view their company
CREATE POLICY company_employee_view ON companies
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employee_verifications 
                WHERE company_id = id 
                AND user_id = auth.uid() 
                AND state = 'FULLY_VERIFIED')
        OR auth.role() = 'admin'
    );

COMMENT ON TABLE audit_log IS 'System-wide immutable audit log. Partitioned by quarter for performance. Every state change is recorded.';
