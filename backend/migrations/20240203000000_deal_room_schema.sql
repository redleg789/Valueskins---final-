-- ==========================================================================
-- Deal Room Schema: Negotiation, Trust, and Deal Lifecycle
--
-- Implements:
--   * Private deal rooms (one per opportunity × creator pair)
--   * Offer/counter-offer history with expiry
--   * Price range tiers (public band, private exact)
--   * Intent declarations (explore / campaign / long-term)
--   * Soft holds (slot reservations)
--   * Auto-escalation blocks (minimum floor enforcement)
--   * Revision abuse tracking
--   * Ghosting / trust penalties
--   * Proof-of-work deliverable storage
--   * Contextual testimonials
--   * Creator energy + brand seriousness indicators
--   * Negotiation memory (past agreed prices between same parties)
--   * ValueSkin version history + seasonal states
--   * Escrow stages (advance / milestone / completion)
--   * Discovery throttle log
--   * Deal calendar soft availability slots
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. PRICE RANGE BANDS  (public-facing tier, exact $ private)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_price_bands (
    id                  BIGSERIAL PRIMARY KEY,
    persona_id          BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    profession_id       BIGINT NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
    band_label          TEXT NOT NULL CHECK (band_label IN ('experimental','mid-tier','premium','exclusive')),
    -- Exact floor/ceiling stored encrypted; visible only in active deal rooms
    exact_floor_cents   BIGINT NOT NULL DEFAULT 0,
    exact_ceiling_cents BIGINT NOT NULL DEFAULT 0,
    currency            TEXT NOT NULL DEFAULT 'USD',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, profession_id)
);

CREATE INDEX idx_cpb_persona ON creator_price_bands(persona_id);

-- ──────────────────────────────────────────────────────────────
-- 2. DEAL ROOMS  (one per brand×creator×opportunity triple)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_rooms (
    id                  BIGSERIAL PRIMARY KEY,
    opportunity_id      BIGINT REFERENCES opportunities(id) ON DELETE SET NULL,
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),

    -- Intent declared by brand before room opens
    intent              TEXT NOT NULL CHECK (intent IN ('explore','campaign','long-term')),

    -- Campaign brief (mandatory before first contact)
    brief_title         TEXT,
    brief_description   TEXT,
    brief_deliverables  TEXT,          -- newline-separated list
    brief_deadline      TIMESTAMPTZ,
    brief_campaign_type TEXT,          -- e.g. 'Product Review'

    -- Room lifecycle
    status              TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','accepted','rejected','expired','cancelled','completed')),

    -- Negotiation quiet mode: no new inbound offers during active talks
    quiet_mode          BOOLEAN NOT NULL DEFAULT FALSE,

    -- Time-zone aware: negotiation window in UTC hours (e.g. 9-18)
    creator_tz_offset   INT,           -- minutes from UTC
    creator_window_start INT,          -- hour of day (0-23) creator accepts responses
    creator_window_end   INT,          -- hour of day (0-23)

    -- Ghosting / expiry
    last_action_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand_user_id, creator_persona_id, opportunity_id)
);

CREATE INDEX idx_dr_brand      ON deal_rooms(brand_user_id);
CREATE INDEX idx_dr_creator    ON deal_rooms(creator_persona_id);
CREATE INDEX idx_dr_status     ON deal_rooms(status);
CREATE INDEX idx_dr_expires    ON deal_rooms(expires_at) WHERE status = 'active';

-- ──────────────────────────────────────────────────────────────
-- 3. OFFER ROUNDS  (counter-offer history inside a deal room)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offer_rounds (
    id              BIGSERIAL PRIMARY KEY,
    deal_room_id    BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    made_by         TEXT NOT NULL CHECK (made_by IN ('brand','creator')),
    amount_cents    BIGINT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    note            TEXT,

    -- Each round must be answered within this window or auto-expires
    response_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    responded_at    TIMESTAMPTZ,
    response        TEXT CHECK (response IN ('accepted','rejected','countered',NULL)),

    -- Silent decline: rejection without sending any notification
    silent_decline  BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_or_room ON offer_rounds(deal_room_id);

-- ──────────────────────────────────────────────────────────────
-- 4. SOFT HOLDS  (slot reservation without full escrow)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS soft_holds (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),
    hold_duration_hours INT NOT NULL DEFAULT 24 CHECK (hold_duration_hours BETWEEN 1 AND 72),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    released_at         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','converted','expired','released')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sh_creator  ON soft_holds(creator_persona_id) WHERE status = 'active';
CREATE INDEX idx_sh_expires  ON soft_holds(expires_at)         WHERE status = 'active';

-- ──────────────────────────────────────────────────────────────
-- 5. AUTO-ESCALATION RULES  (creator blocks below-floor offers)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_escalation_rules (
    id                  BIGSERIAL PRIMARY KEY,
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    profession_id       BIGINT REFERENCES professions(id),   -- NULL = all professions
    floor_cents         BIGINT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    -- How many consecutive lowball offers before auto-block triggers
    lowball_threshold   INT NOT NULL DEFAULT 2,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creator_persona_id, profession_id)
);

-- Per brand: track consecutive lowballs against a creator
CREATE TABLE IF NOT EXISTS lowball_counts (
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),
    count               INT NOT NULL DEFAULT 0,
    last_lowball_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (brand_user_id, creator_persona_id)
);

-- ──────────────────────────────────────────────────────────────
-- 6. NEGOTIATION MEMORY  (past agreed prices between same parties)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS negotiation_memory (
    id                  BIGSERIAL PRIMARY KEY,
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),
    profession_id       BIGINT REFERENCES professions(id),
    campaign_type       TEXT,
    agreed_amount_cents BIGINT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    deal_room_id        BIGINT REFERENCES deal_rooms(id),
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nm_pair ON negotiation_memory(brand_user_id, creator_persona_id);

-- ──────────────────────────────────────────────────────────────
-- 7. TRUST & BEHAVIOR SCORES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_scores (
    persona_id              BIGINT PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,

    -- Deal completion (0-100, based on fulfillment reliability, not followers)
    completion_score        SMALLINT NOT NULL DEFAULT 50 CHECK (completion_score BETWEEN 0 AND 100),

    -- Response time penalty — late responses lower this
    response_reliability    SMALLINT NOT NULL DEFAULT 100 CHECK (response_reliability BETWEEN 0 AND 100),

    -- How stable performance is campaign-to-campaign
    consistency_index       SMALLINT NOT NULL DEFAULT 100 CHECK (consistency_index BETWEEN 0 AND 100),

    -- Revision abuse: how many times brand requested excessive revisions (brand-side score)
    revision_requests_made  INT NOT NULL DEFAULT 0,
    revision_abuse_flag     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Fake urgency: brand marking "urgent" repeatedly lowers credibility
    urgent_flags_used       INT NOT NULL DEFAULT 0,
    fake_urgency_flag       BOOLEAN NOT NULL DEFAULT FALSE,

    -- Ghosting events (missed response deadlines)
    ghosting_events         INT NOT NULL DEFAULT 0,

    -- Discovery throttle: how many creator profiles scanned this week (brand)
    scans_this_week         INT NOT NULL DEFAULT 0,
    scan_week_reset_at      TIMESTAMPTZ NOT NULL DEFAULT (DATE_TRUNC('week', NOW()) + INTERVAL '7 days'),

    -- Energy / burnout state (creator self-reported)
    energy_state            TEXT NOT NULL DEFAULT 'available'
                               CHECK (energy_state IN ('available','limited','burnout','pause')),
    energy_updated_at       TIMESTAMPTZ,

    -- Brand seriousness indicator (based on budget adherence history)
    seriousness_score       SMALLINT NOT NULL DEFAULT 50 CHECK (seriousness_score BETWEEN 0 AND 100),

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 8. PROOF-OF-WORK DELIVERABLES  (stored inside skin history)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_deliverables (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),
    deliverable_type    TEXT NOT NULL,           -- 'post_url','reel_url','story_screenshot','invoice_pdf', etc.
    content_url         TEXT NOT NULL,
    content_hash        TEXT,                    -- SHA-256 of content at upload time (integrity)
    campaign_type       TEXT,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_by_brand   BOOLEAN,
    accepted_at         TIMESTAMPTZ,
    -- Proportional payout: what fraction of deal this deliverable represents (0.0-1.0)
    payout_weight       NUMERIC(5,4) NOT NULL DEFAULT 1.0
);

CREATE INDEX idx_cd_persona ON campaign_deliverables(creator_persona_id);
CREATE INDEX idx_cd_room    ON campaign_deliverables(deal_room_id);

-- ──────────────────────────────────────────────────────────────
-- 9. CONTEXTUAL TESTIMONIALS  (tied to campaign type, not generic)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id),
    from_user_id        BIGINT NOT NULL REFERENCES users(id),
    for_persona_id      BIGINT NOT NULL REFERENCES personas(id),
    campaign_type       TEXT NOT NULL,
    rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body                TEXT,
    is_public           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (deal_room_id, from_user_id)    -- one testimonial per deal per reviewer
);

CREATE INDEX idx_test_persona ON testimonials(for_persona_id);

-- ──────────────────────────────────────────────────────────────
-- 10. ESCROW STAGES  (advance → milestone → completion auto-release)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_stages (
    id                  BIGSERIAL PRIMARY KEY,
    deal_room_id        BIGINT NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
    stage_name          TEXT NOT NULL CHECK (stage_name IN ('advance','milestone','completion')),
    stage_order         SMALLINT NOT NULL,
    amount_cents        BIGINT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    -- Platform credits first, fiat second (stabilizes negotiations)
    denominated_in      TEXT NOT NULL DEFAULT 'credits' CHECK (denominated_in IN ('credits','fiat')),
    status              TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','held','released','cancelled','auto_cancelled')),
    -- Auto-cancel: if brand doesn't provide assets by this date, creator compensation triggers
    brand_asset_due_at  TIMESTAMPTZ,
    -- Rush multiplier: if deadline is set too late, price increases
    rush_multiplier     NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    released_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_es_room ON escrow_stages(deal_room_id);

-- ──────────────────────────────────────────────────────────────
-- 11. VALUESKIN VERSION HISTORY
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skin_versions (
    id                  BIGSERIAL PRIMARY KEY,
    persona_id          BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    profession_id       BIGINT NOT NULL REFERENCES professions(id),
    version_number      INT NOT NULL DEFAULT 1,
    -- State: active, dormant (seasonal pause), pivot (test new niche), retired
    state               TEXT NOT NULL DEFAULT 'active'
                           CHECK (state IN ('active','dormant','pivot','retired')),
    -- Campaign tagging: what kind of outcomes this skin history shows
    outcome_tags        TEXT[],    -- e.g. ARRAY['sales','awareness','virality']
    -- Managed by: self or agency
    managed_by          TEXT NOT NULL DEFAULT 'self' CHECK (managed_by IN ('self','agency')),
    agency_name         TEXT,
    -- Inactivity: pauses visibility instead of lowering credibility
    inactive_since      TIMESTAMPTZ,
    snapshot_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sv_persona ON skin_versions(persona_id, profession_id);

-- ──────────────────────────────────────────────────────────────
-- 12. DEAL CALENDAR SLOTS  (availability as opaque slots, not full schedule)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_slots (
    id                  BIGSERIAL PRIMARY KEY,
    persona_id          BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    slot_date           DATE NOT NULL,
    slot_label          TEXT NOT NULL DEFAULT 'available'
                           CHECK (slot_label IN ('available','tentative','booked','blocked')),
    deal_room_id        BIGINT REFERENCES deal_rooms(id),    -- set when slot is reserved
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, slot_date)
);

CREATE INDEX idx_cs_persona ON calendar_slots(persona_id, slot_date);

-- ──────────────────────────────────────────────────────────────
-- 13. DISCOVERY THROTTLE LOG  (new users can't mass-scan creators)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_scans (
    id              BIGSERIAL PRIMARY KEY,
    brand_user_id   BIGINT NOT NULL REFERENCES users(id),
    persona_id      BIGINT NOT NULL REFERENCES personas(id),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ds_brand_week ON discovery_scans(brand_user_id, scanned_at);

-- ──────────────────────────────────────────────────────────────
-- 14. REPEAT COLLABORATION TEMPLATES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collab_templates (
    id                  BIGSERIAL PRIMARY KEY,
    original_room_id    BIGINT NOT NULL REFERENCES deal_rooms(id),
    brand_user_id       BIGINT NOT NULL REFERENCES users(id),
    creator_persona_id  BIGINT NOT NULL REFERENCES personas(id),
    -- Snapshot of the key deal terms for one-click repeat
    template_json       JSONB NOT NULL,
    last_used_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 15. HELPER FUNCTIONS & TRIGGERS
-- ──────────────────────────────────────────────────────────────

-- Auto-expire deal rooms that haven't seen activity within their window
CREATE OR REPLACE FUNCTION expire_stale_deal_rooms()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE deal_rooms
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at < NOW();
END;
$$;

-- Auto-expire offer rounds that weren't responded to in time
CREATE OR REPLACE FUNCTION expire_stale_offer_rounds()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE offer_rounds
    SET responded_at = NOW(),
        response     = 'rejected'
    WHERE responded_at IS NULL
      AND response_due_at < NOW();
END;
$$;

-- Auto-release soft holds that expired
CREATE OR REPLACE FUNCTION release_expired_soft_holds()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE soft_holds
    SET status      = 'expired',
        released_at = NOW()
    WHERE status    = 'active'
      AND expires_at < NOW();
END;
$$;

-- When a deal room is completed, record negotiation memory
CREATE OR REPLACE FUNCTION record_negotiation_memory()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    last_round offer_rounds%ROWTYPE;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT * INTO last_round
        FROM offer_rounds
        WHERE deal_room_id = NEW.id
          AND response = 'accepted'
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO negotiation_memory
                (brand_user_id, creator_persona_id, agreed_amount_cents, currency, deal_room_id)
            VALUES
                (NEW.brand_user_id, NEW.creator_persona_id,
                 last_round.amount_cents, last_round.currency, NEW.id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_negotiation_memory
AFTER UPDATE ON deal_rooms
FOR EACH ROW EXECUTE FUNCTION record_negotiation_memory();

-- Bump deal room last_action_at whenever a new offer round is inserted
CREATE OR REPLACE FUNCTION bump_deal_room_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE deal_rooms
    SET last_action_at = NOW(),
        expires_at     = NOW() + INTERVAL '48 hours'
    WHERE id = NEW.deal_room_id
      AND status = 'active';
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_deal_room_activity
AFTER INSERT ON offer_rounds
FOR EACH ROW EXECUTE FUNCTION bump_deal_room_activity();

-- Detect revision abuse: flag if brand has requested > 3 revisions on the same deal
CREATE OR REPLACE FUNCTION check_revision_abuse()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    rev_count INT;
    b_user_id BIGINT;
BEGIN
    SELECT brand_user_id INTO b_user_id
    FROM deal_rooms WHERE id = NEW.deal_room_id;

    SELECT COUNT(*) INTO rev_count
    FROM offer_rounds
    WHERE deal_room_id = NEW.deal_room_id
      AND made_by = 'brand'
      AND note ILIKE '%revision%';

    IF rev_count >= 3 THEN
        UPDATE trust_scores
        SET revision_requests_made = revision_requests_made + 1,
            revision_abuse_flag    = TRUE,
            updated_at             = NOW()
        WHERE persona_id = (
            SELECT creator_persona_id FROM deal_rooms WHERE id = NEW.deal_room_id
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_revision_abuse
AFTER INSERT ON offer_rounds
FOR EACH ROW EXECUTE FUNCTION check_revision_abuse();

-- Ghosting penalty: mark trust_score when an offer round expires without response
CREATE OR REPLACE FUNCTION apply_ghosting_penalty()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.response = 'rejected' AND OLD.response IS NULL AND OLD.responded_at IS NULL THEN
        -- Find who should have responded and penalise them
        UPDATE trust_scores ts
        SET ghosting_events       = ghosting_events + 1,
            response_reliability  = GREATEST(0, response_reliability - 5),
            updated_at            = NOW()
        FROM deal_rooms dr
        WHERE dr.id = NEW.deal_room_id
          AND ts.persona_id = CASE
              WHEN NEW.made_by = 'brand' THEN dr.creator_persona_id
              ELSE (SELECT id FROM personas WHERE owner_user_id = dr.brand_user_id LIMIT 1)
          END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ghosting_penalty
AFTER UPDATE ON offer_rounds
FOR EACH ROW EXECUTE FUNCTION apply_ghosting_penalty();

-- Initialise trust_score row when a new persona is created
CREATE OR REPLACE FUNCTION init_trust_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trust_scores (persona_id)
    VALUES (NEW.id)
    ON CONFLICT (persona_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_trust_score
AFTER INSERT ON personas
FOR EACH ROW EXECUTE FUNCTION init_trust_score();

-- Seed trust_score for any existing personas that don't have a row yet
INSERT INTO trust_scores (persona_id)
SELECT id FROM personas
ON CONFLICT (persona_id) DO NOTHING;
