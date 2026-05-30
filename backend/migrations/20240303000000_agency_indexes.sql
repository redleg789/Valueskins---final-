-- ============================================================================
-- Performance indexes for agency elimination services at billion-user scale.
-- Covers: credit advances, contract revisions, pricing lookups, reputation,
-- deal suggestions, and hot-path composite indexes.
-- ============================================================================

-- Credit advances: idempotent draw (ON CONFLICT) needs unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_adv_credit_deal_unique
ON credit_advances(credit_line_id, deal_room_id);

-- Credit advances: list by status for a credit line (repayment dashboard)
CREATE INDEX IF NOT EXISTS idx_adv_credit_status
ON credit_advances(credit_line_id, status);

-- Credit advances: active advances for auto-repay worker
CREATE INDEX IF NOT EXISTS idx_adv_issued
ON credit_advances(status) WHERE status = 'issued';

-- Contract revisions: atomic cap check CTE queries by (contract, is_paid)
CREATE INDEX IF NOT EXISTS idx_cr_contract_paid
ON contract_revisions(contract_instance_id, is_paid_revision);

-- Pricing benchmarks: latest version lookup per (category, platform, content_type, level)
-- The UNIQUE constraint covers equality but not DESC ordering for "latest" queries.
CREATE INDEX IF NOT EXISTS idx_pb_latest_version
ON pricing_benchmarks(category, platform, content_type, level, benchmark_version DESC);

-- Reputation exports: latest version per persona
CREATE INDEX IF NOT EXISTS idx_re_persona_version
ON reputation_exports(persona_id, export_version DESC);

-- Deal suggestions: brand-side listing with status filter
CREATE INDEX IF NOT EXISTS idx_ds_brand_status
ON deal_suggestions(brand_user_id, status);

-- Deal suggestions: score-ranked matching (for ORDER BY match_score DESC LIMIT 500)
CREATE INDEX IF NOT EXISTS idx_ds_score
ON deal_suggestions(match_score DESC);

-- Creator credit lines: status for admin dashboards and worker queries
CREATE INDEX IF NOT EXISTS idx_ccl_status
ON creator_credit_lines(status);

-- Contract instances: created_at for pagination and recent lookups
CREATE INDEX IF NOT EXISTS idx_ci_created
ON contract_instances(created_at DESC);

-- Deal room messages: pagination by deal_room + id (cursor-based)
CREATE INDEX IF NOT EXISTS idx_drm_room_cursor
ON deal_room_messages(deal_room_id, id DESC);

-- Follower audit: rate limit check (persona + platform + audited_at)
CREATE INDEX IF NOT EXISTS idx_far_rate_limit
ON follower_audit_results(persona_id, platform, audited_at DESC);

-- Brand campaign ROI: brand-side aggregation queries
CREATE INDEX IF NOT EXISTS idx_roi_created
ON brand_campaign_roi(created_at DESC);
