-- ============================================================================
-- Agency Elimination Features: Deal Room Messaging, Contracts, Pricing,
-- Credits, Reputation, AI Suggestions, Follower Audit, Brand ROI
-- ============================================================================

-- 1. DEAL ROOM MESSAGES (append-only, immutable audit trail)
-- Replaces DMs for all negotiation communication
CREATE TABLE IF NOT EXISTS deal_room_messages (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    sender_user_id      BIGINT NOT NULL REFERENCES users(id),
    content             TEXT NOT NULL,
    message_type        TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','system','offer_made','offer_accepted','deliverable_uploaded')),
    server_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- No UPDATE/DELETE permitted at application level
    CONSTRAINT no_null_sender CHECK (sender_user_id IS NOT NULL),
    CONSTRAINT no_empty_content CHECK (content != '')
);

CREATE INDEX idx_drm_room ON deal_room_messages(deal_room_id, server_timestamp);
CREATE INDEX idx_drm_sender ON deal_room_messages(sender_user_id);

-- Database-level immutability: prevent any UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_deal_room_message_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Deal room messages are immutable and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER trg_prevent_message_update
BEFORE UPDATE ON deal_room_messages
FOR EACH ROW EXECUTE FUNCTION prevent_deal_room_message_mutation();

CREATE TRIGGER trg_prevent_message_delete
BEFORE DELETE ON deal_room_messages
FOR EACH ROW EXECUTE FUNCTION prevent_deal_room_message_mutation();

-- 2. CONTRACT TEMPLATES (standardized legal templates)
CREATE TABLE IF NOT EXISTS contract_templates (
    id                  BIGSERIAL PRIMARY KEY,
    template_name       VARCHAR(100) NOT NULL UNIQUE,
    template_type       VARCHAR(50) NOT NULL CHECK (template_type IN ('standard_post','ugc_license','long_term_retainer','affiliate','ambassador')),
    description         TEXT NOT NULL,
    template_body       TEXT NOT NULL,  -- HTML/markdown template with {{placeholders}}

    -- Standard clauses
    default_revision_cap    SMALLINT NOT NULL DEFAULT 2,
    default_kill_fee_pct    SMALLINT NOT NULL DEFAULT 20 CHECK (default_kill_fee_pct BETWEEN 0 AND 100),
    default_advance_pct     SMALLINT NOT NULL DEFAULT 30 CHECK (default_advance_pct BETWEEN 0 AND 100),
    default_exclusivity_days INT NOT NULL DEFAULT 30,

    -- Usage rights scope
    usage_rights_description TEXT NOT NULL,  -- e.g., "Instagram feed posts only, 6-month license"

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON contract_templates(template_type);

-- 3. CONTRACT INSTANCES (generated contracts, must be signed by both parties)
CREATE TABLE IF NOT EXISTS contract_instances (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    template_id         BIGINT NOT NULL REFERENCES contract_templates(id),

    -- Generated content
    contract_content    TEXT NOT NULL,  -- final HTML/markdown with values filled in
    contract_hash       VARCHAR(64) NOT NULL,  -- SHA-256 of contract_content
    pdf_url             TEXT,

    -- Status
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_both','pending_brand','pending_creator','signed','executed')),

    -- Locked terms (immutable once signed)
    exact_amount_cents  BIGINT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    deliverable_list    TEXT NOT NULL,
    revision_cap        SMALLINT NOT NULL DEFAULT 2,
    kill_fee_pct        SMALLINT NOT NULL DEFAULT 20,
    advance_pct         SMALLINT NOT NULL DEFAULT 30,
    exclusivity_days    INT NOT NULL DEFAULT 30,
    usage_rights_scope  TEXT NOT NULL,
    deadline            TIMESTAMPTZ,

    -- E-signatures (both parties must sign)
    brand_signed_at     TIMESTAMPTZ,
    brand_signed_hash   VARCHAR(64),  -- signature verification hash
    creator_signed_at   TIMESTAMPTZ,
    creator_signed_hash VARCHAR(64),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(deal_room_id)  -- only one active contract per deal room
);

CREATE INDEX idx_ci_room ON contract_instances(deal_room_id);
CREATE INDEX idx_ci_status ON contract_instances(status);

-- 4. PRICING BENCHMARKS (market authority: p25, median, p75)
CREATE TABLE IF NOT EXISTS pricing_benchmarks (
    id                      BIGSERIAL PRIMARY KEY,
    category                VARCHAR(60) NOT NULL,
    platform                VARCHAR(30) NOT NULL,
    content_type            VARCHAR(60) NOT NULL,
    level                   SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),

    -- Statistics (cents)
    p25_rate_cents          BIGINT NOT NULL,
    median_rate_cents       BIGINT NOT NULL,
    p75_rate_cents          BIGINT NOT NULL,

    -- Trend indicator
    trend                   VARCHAR(10) NOT NULL DEFAULT 'stable' CHECK (trend IN ('rising','stable','falling')),
    change_last_month_pct   NUMERIC(5,1) NOT NULL DEFAULT 0,

    -- Data quality
    data_points             INT NOT NULL DEFAULT 0,

    -- Version stamping (for historical queries)
    benchmark_version       INT NOT NULL DEFAULT 1,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(category, platform, content_type, level, benchmark_version)
);

CREATE INDEX idx_pb_lookup ON pricing_benchmarks(category, platform, content_type, level);
CREATE INDEX idx_pb_computed ON pricing_benchmarks(computed_at DESC);

-- 5. CREATOR CREDIT LINES (advance draws based on deal history)
CREATE TABLE IF NOT EXISTS creator_credit_lines (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Credit metrics (cents)
    credit_limit_cents  BIGINT NOT NULL,
    used_cents          BIGINT NOT NULL DEFAULT 0,
    available_cents     BIGINT NOT NULL,

    -- Score (deterministic: completed deals + avg value + trust score + months active)
    credit_score        SMALLINT NOT NULL DEFAULT 50 CHECK (credit_score BETWEEN 0 AND 100),

    -- Status
    status              VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_ccl_user ON creator_credit_lines(user_id);

-- 6. CREDIT ADVANCES (individual advance draws)
CREATE TABLE IF NOT EXISTS credit_advances (
    id                      BIGSERIAL PRIMARY KEY,
    credit_line_id          BIGINT NOT NULL REFERENCES creator_credit_lines(id) ON DELETE CASCADE,
    deal_room_id            BIGINT NOT NULL REFERENCES deal_rooms(id),

    -- Advance amount (cents)
    amount_cents            BIGINT NOT NULL,

    -- Repayment
    repayment_auto_deduct   BOOLEAN NOT NULL DEFAULT TRUE,
    repayment_due_at        TIMESTAMPTZ,
    repaid_at               TIMESTAMPTZ,

    -- Status
    status                  VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','pending','repaid','forfeited')),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adv_credit ON credit_advances(credit_line_id);
CREATE INDEX idx_adv_deal ON credit_advances(deal_room_id);

-- 7. FOLLOWER AUDIT RESULTS (fake follower detection)
CREATE TABLE IF NOT EXISTS follower_audit_results (
    id                              BIGSERIAL PRIMARY KEY,
    persona_id                      BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    platform                        VARCHAR(30) NOT NULL,

    -- Audit scores
    fake_follower_pct               NUMERIC(5,2) NOT NULL DEFAULT 0,
    engagement_authenticity_score   SMALLINT NOT NULL DEFAULT 50 CHECK (engagement_authenticity_score BETWEEN 0 AND 100),

    -- Signal breakdown (JSON for future extensibility)
    signal_breakdown                JSONB NOT NULL DEFAULT '{}',

    -- Rate limiting (1 audit per 30 days)
    audited_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(persona_id, platform)
);

CREATE INDEX idx_far_persona ON follower_audit_results(persona_id);
CREATE INDEX idx_far_audited ON follower_audit_results(audited_at DESC);

-- 8. BRAND CAMPAIGN ROI (post-campaign performance tracking)
CREATE TABLE IF NOT EXISTS brand_campaign_roi (
    id                      BIGSERIAL PRIMARY KEY,
    completed_deal_id       BIGINT NOT NULL REFERENCES completed_deals(id) ON DELETE CASCADE,

    -- Campaign metrics
    impressions             BIGINT NOT NULL DEFAULT 0,
    clicks                  BIGINT NOT NULL DEFAULT 0,
    conversions             BIGINT NOT NULL DEFAULT 0,
    estimated_value_cents   BIGINT NOT NULL DEFAULT 0,

    -- ROI calculation
    cost_cents              BIGINT NOT NULL,  -- deal amount
    roi_pct                 NUMERIC(8,2) NOT NULL DEFAULT 0,

    reported_by_brand_at    TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roi_deal ON brand_campaign_roi(completed_deal_id);

-- 9. ADVANCE PREFERENCES (creator/brand control over advance requirements)
CREATE TABLE IF NOT EXISTS advance_preferences (
    id                          BIGSERIAL PRIMARY KEY,
    user_id                     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role                   VARCHAR(20) NOT NULL CHECK (user_role IN ('creator','brand')),

    -- Brand: whether they offer advances
    brand_offers_advance        BOOLEAN,
    brand_default_advance_pct   SMALLINT CHECK (brand_default_advance_pct BETWEEN 10 AND 50),

    -- Creator: whether they require/prefer advances
    creator_requires_advance    BOOLEAN,
    creator_advance_pct_wanted  SMALLINT CHECK (creator_advance_pct_wanted BETWEEN 10 AND 50),
    creator_advance_negotiable  BOOLEAN NOT NULL DEFAULT TRUE,  -- false = deal-breaker

    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_ap_user ON advance_preferences(user_id);
CREATE INDEX idx_ap_role ON advance_preferences(user_role);

-- 10. DEAL SUGGESTIONS (AI-ranked proactive matches)
CREATE TABLE IF NOT EXISTS deal_suggestions (
    id                          BIGSERIAL PRIMARY KEY,
    brand_user_id               BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id          BIGINT NOT NULL REFERENCES personas(id),

    -- Scoring
    match_score                 NUMERIC(5,2) NOT NULL,
    match_factors               JSONB NOT NULL DEFAULT '{}',  -- explainability: {ValuSkin, level_fit, price_band_overlap, trust_score, follower_audit_score}
    advance_compatible          BOOLEAN NOT NULL,

    -- Status
    status                      VARCHAR(20) NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','dismissed','converted_to_deal','expired')),

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted_at                TIMESTAMPTZ,
    UNIQUE(brand_user_id, creator_persona_id)
);

CREATE INDEX idx_ds_creator ON deal_suggestions(creator_persona_id) WHERE status IN ('suggested','converted_to_deal');
CREATE INDEX idx_ds_brand ON deal_suggestions(brand_user_id);

-- 11. REPUTATION EXPORTS (portable, signed reputation passports)
CREATE TABLE IF NOT EXISTS reputation_exports (
    id                      BIGSERIAL PRIMARY KEY,
    persona_id              BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

    -- Snapshot data
    export_version          INT NOT NULL,
    deal_count              INT NOT NULL,
    avg_deal_cents          BIGINT NOT NULL,
    completion_rate_pct     NUMERIC(5,2) NOT NULL,
    on_time_rate_pct        NUMERIC(5,2) NOT NULL,

    -- Trust scores snapshot (JSON)
    trust_scores_snapshot   JSONB NOT NULL,
    testimonial_count       INT NOT NULL,

    -- Cryptographic signature (Ed25519)
    signed_hash             VARCHAR(128) NOT NULL,  -- base64-encoded signature

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_re_persona ON reputation_exports(persona_id);
CREATE INDEX idx_re_created ON reputation_exports(created_at DESC);

-- 12. PAYMENT VERIFICATION & ON-TIME TRACKING
-- Creator documents when brand paid (or didn't), immutable proof
CREATE TABLE IF NOT EXISTS payment_verification_log (
    id                      BIGSERIAL PRIMARY KEY,
    deal_room_id            BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    expected_payment_date   TIMESTAMPTZ NOT NULL,
    actual_payment_date     TIMESTAMPTZ,
    amount_cents            BIGINT NOT NULL,
    payment_status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid_on_time','paid_late','not_paid','partial')),
    days_late               INT,  -- NULL if on-time
    creator_verified_at     TIMESTAMPTZ,  -- when creator confirmed receipt
    creator_notes           TEXT,
    proof_urls              TEXT[],  -- screenshots, bank statements, etc.
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(deal_room_id)
);

CREATE INDEX idx_pvl_deal ON payment_verification_log(deal_room_id);
CREATE INDEX idx_pvl_status ON payment_verification_log(payment_status);

-- 13. REVISION TRACKING & PAID REVISIONS
-- Every revision must be explicitly negotiated and paid for (not unlimited)
CREATE TABLE IF NOT EXISTS contract_revisions (
    id                      BIGSERIAL PRIMARY KEY,
    contract_instance_id    BIGINT NOT NULL REFERENCES contract_instances(id) ON DELETE CASCADE,
    revision_number         SMALLINT NOT NULL CHECK (revision_number > 0),
    requested_by_user_id    BIGINT NOT NULL REFERENCES users(id),
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Revision details
    change_description      TEXT NOT NULL,

    -- Paid revision
    is_paid_revision        BOOLEAN NOT NULL DEFAULT FALSE,
    additional_cost_cents   BIGINT CHECK (is_paid_revision = FALSE OR additional_cost_cents > 0),

    -- Status
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
    completed_at            TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cr_contract ON contract_revisions(contract_instance_id);
CREATE INDEX idx_cr_status ON contract_revisions(status);

-- 14. CONTENT UPLOAD GATING (can't upload if payment not received)
-- Deliverables can only be marked "approved" after payment is verified
CREATE TABLE IF NOT EXISTS deliverable_payment_requirements (
    id                      BIGSERIAL PRIMARY KEY,
    deal_room_id            BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    deliverable_number      SMALLINT NOT NULL,
    payment_required_before_upload BOOLEAN NOT NULL DEFAULT TRUE,
    advance_percentage      SMALLINT NOT NULL CHECK (advance_percentage BETWEEN 0 AND 100),
    advance_must_be_received BOOLEAN NOT NULL DEFAULT TRUE,  -- if TRUE, creator can't upload without advance payment verified
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(deal_room_id, deliverable_number)
);

CREATE INDEX idx_dpr_deal ON deliverable_payment_requirements(deal_room_id);

-- Trigger: prevent deliverable approval if payment not received
CREATE OR REPLACE FUNCTION prevent_deliverable_approval_without_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    payment_req RECORD;
    payment_verified BOOLEAN;
BEGIN
    -- Check if this deliverable has payment requirements
    SELECT * INTO payment_req
    FROM deliverable_payment_requirements
    WHERE deal_room_id = (SELECT deal_room_id FROM deal_rooms WHERE id IN (SELECT deal_room_id FROM campaign_deliverables WHERE id = NEW.id))
    AND deliverable_number = (SELECT COUNT(*) FROM campaign_deliverables WHERE deal_room_id = (SELECT deal_room_id FROM campaign_deliverables WHERE id = NEW.id));

    IF payment_req.advance_must_be_received THEN
        -- Check if payment is verified
        SELECT (payment_status IN ('paid_on_time','paid_late')) INTO payment_verified
        FROM payment_verification_log
        WHERE deal_room_id = (SELECT deal_room_id FROM campaign_deliverables WHERE id = NEW.id)
        LIMIT 1;

        IF NOT COALESCE(payment_verified, FALSE) THEN
            RAISE EXCEPTION 'Cannot approve deliverable until payment is verified by creator. Advance payment must be received first.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_gate_deliverable
BEFORE UPDATE ON campaign_deliverables
FOR EACH ROW
WHEN (NEW.accepted_by_brand IS DISTINCT FROM OLD.accepted_by_brand AND NEW.accepted_by_brand = TRUE)
EXECUTE FUNCTION prevent_deliverable_approval_without_payment();

-- 15. PERFORMANCE CLAUSE BLOCKER
-- Brands can't claim "performance didn't meet expectations" — contract is legally binding on quality assumptions
CREATE TABLE IF NOT EXISTS performance_dispute_blocks (
    id                      BIGSERIAL PRIMARY KEY,
    contract_instance_id    BIGINT NOT NULL REFERENCES contract_instances(id) ON DELETE CASCADE,

    -- Clause: what quality/performance is guaranteed?
    performance_clause      TEXT NOT NULL,  -- e.g., "Minimum 100k impressions on post" or "Follow brand guidelines exactly"

    -- Evidence: brand agreed to this upfront
    brand_acknowledged_at   TIMESTAMPTZ,
    brand_acknowledged_hash VARCHAR(64),

    -- Protection: brand can't later claim "performance was bad"
    dispute_blocked         BOOLEAN NOT NULL DEFAULT TRUE,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_instance_id)
);

CREATE INDEX idx_pdb_contract ON performance_dispute_blocks(contract_instance_id);

-- 16. DATA RETENTION for anti-scam tables
INSERT INTO data_retention_policies (table_name, id_column, timestamp_column, retention_days)
VALUES
    ('payment_verification_log', 'id', 'created_at', 2555),
    ('contract_revisions', 'id', 'created_at', 2555),
    ('deliverable_payment_requirements', 'id', 'created_at', 2555),
    ('performance_dispute_blocks', 'id', 'created_at', 2555)
ON CONFLICT DO NOTHING;

-- 12. DATA RETENTION POLICIES for new tables
INSERT INTO data_retention_policies (table_name, id_column, timestamp_column, retention_days)
VALUES
    ('deal_room_messages', 'id', 'server_timestamp', 2555),
    ('contract_instances', 'id', 'created_at', 2555),
    ('credit_advances', 'id', 'created_at', 2555),
    ('brand_campaign_roi', 'id', 'created_at', 2555),
    ('reputation_exports', 'id', 'created_at', 2555)
ON CONFLICT DO NOTHING;
