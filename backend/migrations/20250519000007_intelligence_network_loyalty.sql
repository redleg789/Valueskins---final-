-- 20250519000007: Event OS Intelligence, Network, Loyalty & Retention Systems
-- Covers: Network Graph, Event Memories, Tribes, Host CRM,
--         Loyalty Engine, Attendee Reputation, Admin Intelligence

BEGIN;

-- ── 1. NETWORK GRAPH ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS network_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'co_attendance', 'mutual_follow', 'community_co_member',
    'event_connection', 'recommendation', 'referral'
  )),
  weight NUMERIC(5,2) DEFAULT 1.00,
  metadata JSONB DEFAULT '{}',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type),
  CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_network_edges_source ON network_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_network_edges_target ON network_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_network_edges_type ON network_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_network_edges_weight ON network_edges(weight DESC);

-- ── 2. EVENT MEMORIES (RECAPS) ────────────────────────────

CREATE TABLE IF NOT EXISTS event_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  summary TEXT,
  stats_json JSONB DEFAULT '{}',
  audience_composition JSONB DEFAULT '{}',
  promoter_leaderboard JSONB DEFAULT '[]',
  photo_highlights JSONB DEFAULT '[]',
  engagement_heatmap JSONB DEFAULT '[]',
  top_communities JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  is_published BOOLEAN DEFAULT FALSE,
  UNIQUE(event_id)
);

-- ── 3. TRIBES (COMMUNITY PERSISTENCE) ─────────────────────

CREATE TABLE IF NOT EXISTS tribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  city TEXT,
  cover_photo_url TEXT,
  host_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  rules TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tribe_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id UUID NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tribe_id, account_id)
);

CREATE TABLE IF NOT EXISTS tribe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id UUID NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tribe_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_tribes_host ON tribes(host_id);
CREATE INDEX IF NOT EXISTS idx_tribes_city ON tribes(city);
CREATE INDEX IF NOT EXISTS idx_tribes_category ON tribes(category);
CREATE INDEX IF NOT EXISTS idx_tribe_members_account ON tribe_members(account_id);
CREATE INDEX IF NOT EXISTS idx_tribe_events_event ON tribe_events(event_id);

-- ── 4. HOST CRM ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS host_crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  is_auto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS host_crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attendee_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS host_crm_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attendee_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(host_id, attendee_id, label)
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_host ON host_crm_notes(host_id);
CREATE INDEX IF NOT EXISTS idx_crm_segments_host ON host_crm_segments(host_id);

-- ── 5. LOYALTY ENGINE ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_event_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE TABLE IF NOT EXISTS loyalty_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'reliable', 'vip', 'regular', 'legend', 'explorer',
    'early_bird', 'super_fan', 'loyalist', 'night_owl', 'globetrotter'
  )),
  badge_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vip_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  points_threshold INTEGER NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_account ON loyalty_points(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_account ON loyalty_badges(account_id);
CREATE INDEX IF NOT EXISTS idx_vip_tiers_account ON vip_tiers(account_id);

-- ── 6. ATTENDEE REPUTATION ────────────────────────────────

CREATE TABLE IF NOT EXISTS reputation_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'trusted_attendee', 'reliable_guest', 'vip_guest',
    'risk_user', 'restricted', 'late_arriver', 'no_show_risk',
    'top_reviewer', 'early_adopter'
  )),
  score_threshold INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, badge_type)
);

-- ── 7. EVENT RECOMMENDATIONS (CACHED) ─────────────────────

CREATE TABLE IF NOT EXISTS event_recommendation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  reason TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_scores_account ON event_recommendation_scores(account_id, score DESC);

-- ── 8. ADMIN CACHE ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  data_json JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- ── 9. AUDIENCE EXPORTS ───────────────────────────────────

CREATE TABLE IF NOT EXISTS host_audience_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  segment_criteria JSONB,
  row_count INTEGER DEFAULT 0,
  download_url TEXT,
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- ── 10. AUDIENCE ANALYTICS (MATERIALIZED) ─────────────────

CREATE TABLE IF NOT EXISTS audience_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role_distribution JSONB DEFAULT '{}',
  community_overlap JSONB DEFAULT '{}',
  conversion_patterns JSONB DEFAULT '{}',
  retention_data JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

-- ── SEED: Auto-create tribe for demo event series ─────────
-- (Handled by API proxy seed data)

COMMIT;
