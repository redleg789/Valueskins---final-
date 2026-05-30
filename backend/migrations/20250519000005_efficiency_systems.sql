-- ValueSkins Event Efficiency Systems
-- Covers: Gender + Entry Rules, Table + Seating, Bag + Security Rules,
-- Verified Host Workflow, Waitlist Automation, Fraud + Risk Engine,
-- Calendar Integration, Support System

BEGIN;

-- ── 1. VERIFIED HOST WORKFLOW ──────────────────────────────

CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'revoked')),
  requester_id BIGINT NOT NULL REFERENCES accounts(id),
  documents JSONB DEFAULT '[]',
  notes TEXT,
  reviewed_by BIGINT REFERENCES accounts(id),
  reviewed_at TIMESTAMPTZ,
  verification_level TEXT DEFAULT 'basic'
    CHECK (verification_level IN ('basic', 'premium', 'enterprise')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. WAITLIST AUTO-INVITE QUEUE ──────────────────────────

CREATE TABLE IF NOT EXISTS waitlist_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  position INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'invited', 'expired', 'converted', 'cancelled')),
  invited_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  wait_time_seconds INT DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. FRAUD RISK ENGINE ───────────────────────────────────

CREATE TABLE IF NOT EXISTS fraud_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors JSONB DEFAULT '[]',
  action_taken TEXT DEFAULT 'none'
    CHECK (action_taken IN ('none', 'flag', 'block', 'warn')),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by BIGINT REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  fraud_type TEXT NOT NULL
    CHECK (fraud_type IN ('scalping', 'duplicate_account', 'chargeback_abuse',
           'no_show_pattern', 'bulk_cancellation', 'suspicious_purchase',
           'promoter_abuse', 'velocity_anomaly', 'payment_fraud')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  flagged_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);

-- ── 4. CALENDAR INTEGRATION ────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  platform TEXT NOT NULL CHECK (platform IN ('google', 'apple', 'outlook')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, platform)
);

CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  remind_at TIMESTAMPTZ NOT NULL,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN ('1h_before', '2h_before', '6h_before',
           '1d_before', '1w_before', 'custom')),
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  channel TEXT DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'push', 'sms')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. SUPPORT SYSTEM ────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT REFERENCES events(id),
  requester_id BIGINT NOT NULL REFERENCES accounts(id),
  assigned_to BIGINT REFERENCES accounts(id),
  category TEXT NOT NULL
    CHECK (category IN ('general', 'ticketing', 'refund', 'safety',
           'technical', 'host_support', 'emergency', 'payment', 'account')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'waiting_on_user', 'resolved', 'closed')),
  escalation_level INT DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES accounts(id),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  helpful_count INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. TABLE + SEATING ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS table_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  section_type TEXT NOT NULL
    CHECK (section_type IN ('vip', 'general', 'standing', 'table', 'balcony', 'booth', 'outdoor')),
  capacity INT NOT NULL DEFAULT 0,
  price_cents INT DEFAULT 0,
  description TEXT,
  sort_order INT DEFAULT 0,
  color TEXT DEFAULT '#38bdf8',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  section_id UUID NOT NULL REFERENCES table_sections(id),
  table_label TEXT,
  seats INT DEFAULT 1,
  attendee_id BIGINT REFERENCES accounts(id),
  ticket_id UUID REFERENCES tickets(id),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'occupied', 'maintenance')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. EVENT GENDER + ENTRY RULE COLUMNS ──────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gender_rule TEXT DEFAULT 'any'
    CHECK (gender_rule IN ('any', 'couples_only', 'women_only', 'men_only',
           'invite_only', 'ratio_controlled', 'custom')),
  ADD COLUMN IF NOT EXISTS gender_ratio JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_entry_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS entry_approval_required BOOLEAN DEFAULT FALSE;

-- ── 8. BAG + SECURITY RULE COLUMNS ────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS bag_policy TEXT DEFAULT 'any'
    CHECK (bag_policy IN ('any', 'no_bags', 'small_bags_only',
           'clear_bags_only', 'no_restrictions')),
  ADD COLUMN IF NOT EXISTS locker_available BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locker_cost_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locker_info TEXT,
  ADD COLUMN IF NOT EXISTS storage_info TEXT,
  ADD COLUMN IF NOT EXISTS upgraded_prohibited_items TEXT[] DEFAULT '{}';

-- ── 9. AUDIT LOG ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efficiency_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_system_efficiency
  ON efficiency_audit_logs(system, created_at);

-- ── SEED DATA ─────────────────────────────────────────────

INSERT INTO support_knowledge_base (category, question, answer, tags)
VALUES
  ('ticketing', 'How do I get a refund?',
   'Refund policies vary by event. Check the event page for refund policy details. If eligible, contact the host through the support system or use the Need Help button.',
   ARRAY['refund', 'ticket', 'cancellation']),
  ('general', 'What should I bring to an event?',
   'Check the event page for "What to Bring" and any specific rules. Generally: valid ID, your ticket (printed or digital), and anything listed by the host.',
   ARRAY['what to bring', 'preparation']),
  ('general', 'Can I transfer my ticket to someone else?',
   'Yes, most tickets can be transferred up to 3 times. Go to your ticket view and use the Transfer option. Some events may restrict transfers.',
   ARRAY['transfer', 'ticket', 'guest']),
  ('safety', 'How do I report an incident at an event?',
   'Use the SOS button for emergencies. For non-emergency reports, use the Safety tab in the event detail view to submit a report. All reports are reviewed by the event host and our safety team.',
   ARRAY['safety', 'incident', 'report']),
  ('ticketing', 'What if I lose my ticket?',
   'Your ticket is stored in your account. Log in and go to My Events > your event > Ticket view. You can also save it to your device wallet.',
   ARRAY['lost ticket', 'wallet', 'qr code']),
  ('host_support', 'How do I verify my venue?',
   'Go to My Venue and submit a verification request. Upload your business documents and our team will review within 48 hours.',
   ARRAY['verification', 'venue', 'host']);
COMMIT;
