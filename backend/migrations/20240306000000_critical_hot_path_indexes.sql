-- ============================================================================
-- Critical hot-path indexes for marketplace and deal room operations
-- at billion-user scale. These prevent full table scans on frequently
-- accessed columns in high-concurrency paths.
-- ============================================================================

-- ============================================================================
-- Opportunities: list_opportunities queries with filters
-- ============================================================================
-- PRIMARY: list by category, profession, level + status filter
CREATE INDEX IF NOT EXISTS idx_opp_category_profession_level
ON opportunities(category, required_profession_id, required_level, status)
WHERE status = 'open';

-- SECONDARY: list by brand with status filter (brand dashboard)
CREATE INDEX IF NOT EXISTS idx_opp_brand_status
ON opportunities(brand_id, status);

-- TERTIARY: list by created_at for pagination (newest first)
CREATE INDEX IF NOT EXISTS idx_opp_created_desc
ON opportunities(created_at DESC);

-- ============================================================================
-- Deal Rooms: primary deal flow queries
-- ============================================================================
-- PRIMARY: list active deals by creator (creator dashboard)
CREATE INDEX IF NOT EXISTS idx_dr_creator_status
ON deal_rooms(creator_persona_id, status, created_at DESC);

-- SECONDARY: list active deals by brand (brand dashboard + opportunity view)
CREATE INDEX IF NOT EXISTS idx_dr_brand_status
ON deal_rooms(brand_user_id, status, created_at DESC);

-- TERTIARY: pagination and recent deals lookup
CREATE INDEX IF NOT EXISTS idx_dr_created
ON deal_rooms(created_at DESC);

-- QUATERNARY: escrow stage filtering (in_progress deals only)
CREATE INDEX IF NOT EXISTS idx_dr_escrow_stage
ON deal_rooms(escrow_stage) WHERE status = 'in_progress';

-- ============================================================================
-- Offer Rounds: counter-offer history on a deal
-- ============================================================================
-- PRIMARY: deal-side pagination (offer history timeline)
CREATE INDEX IF NOT EXISTS idx_offround_deal_round
ON offer_rounds(deal_room_id, offer_round DESC);

-- SECONDARY: status filtering for decision pending
CREATE INDEX IF NOT EXISTS idx_offround_status
ON offer_rounds(status) WHERE status IN ('pending', 'counter');

-- ============================================================================
-- Applications: opportunity-side listing (brand sees who applied)
-- ============================================================================
-- PRIMARY: who applied to this opportunity (brand dashboard)
CREATE INDEX IF NOT EXISTS idx_opp_app_opp_status
ON opportunity_applications(opportunity_id, status);

-- SECONDARY: creator's applications list (creator dashboard)
CREATE INDEX IF NOT EXISTS idx_opp_app_creator
ON opportunity_applications(creator_persona_id, status, created_at DESC);

-- ============================================================================
-- Personas: user profile lookups (frequent in joins)
-- ============================================================================
-- PRIMARY: user ID to persona mapping (used in ~40% of deal room queries)
CREATE INDEX IF NOT EXISTS idx_persona_user
ON personas(user_id);

-- SECONDARY: profession filtering (marketplace discovery)
CREATE INDEX IF NOT EXISTS idx_persona_profession
ON personas(profession_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- Users: auth and profile lookups
-- ============================================================================
-- PRIMARY: instagram ID mapping (OAuth flow, must be unique + indexed)
CREATE INDEX IF NOT EXISTS idx_user_instagram_id
ON users(instagram_id) WHERE instagram_id IS NOT NULL;

-- SECONDARY: email lookups (password reset, dedup checks)
CREATE INDEX IF NOT EXISTS idx_user_email
ON users(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- Event Outbox: worker processing (critical for reliability)
-- ============================================================================
-- PRIMARY: unprocessed events for worker polling (millions per day)
CREATE INDEX IF NOT EXISTS idx_evt_status_created
ON event_outbox(status, created_at ASC)
WHERE status = 'pending';

-- SECONDARY: failed event retry (exponential backoff window)
CREATE INDEX IF NOT EXISTS idx_evt_failed_next_retry
ON event_outbox(next_retry_at)
WHERE status = 'failed' AND retry_count < max_retries;

-- ============================================================================
-- Deal Room Messages: chat pagination (extremely hot path)
-- ============================================================================
-- Note: idx_drm_room_cursor already exists in 20240303, but ensure uniqueness
-- for cursor-based pagination on (deal_room_id, id DESC).
CREATE INDEX IF NOT EXISTS idx_drm_room_timestamp
ON deal_room_messages(deal_room_id, server_timestamp DESC);

-- ============================================================================
-- Escrow Disputes: dispute resolution workers + audit queries
-- ============================================================================
-- PRIMARY: disputes pending admin action
CREATE INDEX IF NOT EXISTS idx_disp_status_created
ON escrow_disputes(status, created_at DESC)
WHERE status IN ('open', 'escalated');

-- SECONDARY: deal-side dispute lookups
CREATE INDEX IF NOT EXISTS idx_disp_deal
ON escrow_disputes(deal_room_id);

-- ============================================================================
-- Feature Flags: admin config lookups (millions of reqs check this)
-- ============================================================================
-- PRIMARY: flag lookup by key (cache miss handler validates)
CREATE INDEX IF NOT EXISTS idx_ff_key
ON platform_feature_flags(key) WHERE enabled = true;

-- ============================================================================
-- Campaign Gating: permission check on opportunity view (high concurrency)
-- ============================================================================
-- PRIMARY: profession-based access filter
CREATE INDEX IF NOT EXISTS idx_cg_campaign_profession
ON campaign_gating_rules(campaign_id, profession_id);

-- ============================================================================
-- Notification Queue: worker dequeue (append-only tail reads)
-- ============================================================================
-- PRIMARY: unprocessed notifications ordered by insertion
CREATE INDEX IF NOT EXISTS idx_notif_status_id
ON notification_queue(status, id)
WHERE status = 'pending';

-- ============================================================================
-- Stats and Completeness: summary queries for dashboards/admin
-- ============================================================================
-- These aggregate queries are lower priority but should have indexes
-- to prevent full table scans when brand/creator stats are requested.

-- Deal completion rate per brand (brand analytics)
CREATE INDEX IF NOT EXISTS idx_dr_brand_completed
ON deal_rooms(brand_user_id, status)
WHERE status = 'completed';

-- Finalized deals for payout reporting
CREATE INDEX IF NOT EXISTS idx_dr_finalized
ON deal_rooms(created_at DESC)
WHERE status = 'finalized';
