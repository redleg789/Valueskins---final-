-- 20250519000004: Event OS -- Ticketing, Check-In, Chat, Safety, Intelligence

-- 1. QR TICKETS
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT REFERENCES accounts(id),
  attendee_id BIGINT,
  ticket_type TEXT NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  encrypted_payload TEXT NOT NULL,
  anti_forgery_token TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  wallet_url TEXT,
  transfer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);

-- 2. CHECK-INS
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  event_id BIGINT NOT NULL REFERENCES events(id),
  scanned_by BIGINT REFERENCES accounts(id),
  scan_method TEXT DEFAULT 'qr',
  entry_time TIMESTAMPTZ DEFAULT NOW(),
  re_entry BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- 3. PLUS-ONES / GROUPS
CREATE TABLE IF NOT EXISTS attendee_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  owner_attendee_id BIGINT NOT NULL,
  group_name TEXT,
  max_size INTEGER DEFAULT 1,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES attendee_groups(id),
  attendee_id BIGINT NOT NULL,
  role TEXT DEFAULT 'member',
  invited_by BIGINT,
  status TEXT DEFAULT 'pending',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ARRIVAL INFO
CREATE TABLE IF NOT EXISTS arrival_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id) UNIQUE,
  map_url TEXT,
  navigation_deeplink TEXT,
  parking_details TEXT,
  valet_info TEXT,
  gate_number TEXT,
  floor_number TEXT,
  table_assignment TEXT,
  entry_route_description TEXT,
  proximity_radius_meters INTEGER DEFAULT 0,
  location_reveal_policy TEXT DEFAULT 'purchase',
  reveal_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS event_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  host_id BIGINT NOT NULL REFERENCES accounts(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  priority TEXT DEFAULT 'normal',
  is_pinned BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EVENT CHAT
CREATE TABLE IF NOT EXISTS event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  sender_id BIGINT NOT NULL REFERENCES accounts(id),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_announcement BOOLEAN DEFAULT FALSE,
  is_moderated BOOLEAN DEFAULT FALSE,
  reply_to UUID REFERENCES event_chat_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AI FAQ
CREATE TABLE IF NOT EXISTS event_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TRUST & SAFETY
CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT REFERENCES events(id),
  reporter_id BIGINT REFERENCES accounts(id),
  reported_id BIGINT REFERENCES accounts(id),
  report_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'open',
  resolution TEXT,
  resolved_by BIGINT REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id BIGINT NOT NULL REFERENCES accounts(id),
  blocked_id BIGINT NOT NULL REFERENCES accounts(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 9. ATTENDEE CARDS
CREATE TABLE IF NOT EXISTS attendee_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES accounts(id) UNIQUE,
  photo_url TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  communities TEXT[] DEFAULT '{}',
  badges TEXT[] DEFAULT '{}',
  show_value_skin BOOLEAN DEFAULT FALSE,
  privacy_level TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ATTENDANCE METRICS
CREATE TABLE IF NOT EXISTS attendance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id) UNIQUE,
  total_check_ins INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  repeat_attendees INTEGER DEFAULT 0,
  unique_attendees INTEGER DEFAULT 0,
  peak_hour TIMESTAMPTZ,
  average_duration_minutes INTEGER DEFAULT 0,
  vip_check_ins INTEGER DEFAULT 0,
  group_check_ins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. POST-EVENT
CREATE TABLE IF NOT EXISTS event_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES accounts(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  requester_id BIGINT NOT NULL REFERENCES accounts(id),
  target_id BIGINT NOT NULL REFERENCES accounts(id),
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. AUTOMATION QUEUE
CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT REFERENCES events(id),
  job_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  payload JSONB,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
