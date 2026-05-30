# PLAN 3: Efficiency Systems — Eliminating Attendee & Host Friction

## Goal

Eliminate every remaining reason for repetitive DMs between attendees and hosts.
If a user thinks "Wait, I have a question..." — the system should already answer it.

---

## Inventory: What Already Exists (DO NOT REBUILD)

| # | System | Status | What Exists |
|---|--------|--------|-------------|
| 1 | Age Restriction | DONE | ageRestriction field + DB column + FAQ auto-gen |
| 2 | ID Verification | DONE | idRequired checkbox + DB column |
| 3 | Dress Code | DONE | dressCode field + DB column + venue default + FAQ |
| 4 | Food & Drinks | DONE | foodAndDrink textarea + DB column |
| 5 | Entry Policy | DONE | 7+ fields (idRequired, reentryAllowed, alcoholRules, guestRules, photographyRules, securityRules, prohibitedItems) |
| 6 | Accessibility | DONE | accessibility textarea + DB column |
| 7 | Weather Contingency | DONE | weatherContingency textarea + DB column |

## What Needs Building

### 1. Gender + Entry Rules (NEW)
DB column `gender_preferences` exists (`'any' | 'male' | 'female' | 'non-binary'`) but no frontend.
- Couples only toggle
- Women only / Men only
- Invite-only entry
- Gender ratio controls (max X% male/female)
- Custom restrictions text
- Approval workflows per gender rule

### 2. Table + Seating (ENHANCE)
Arrival info has `tableAssignment` but no dedicated creation flow.
- Table reservation booking
- Seat assignment (numbered seats)
- Standing / General admission
- VIP areas / Sections
- Table maps (visual grid)
- Max per table

### 3. Bag + Security Rules (STRUCTURE)
Currently free-text via securityRules + prohibitedItems tags.
- Structured bag policy (clear bag, no bags, small bags only, etc.)
- Prohibited items list (upgraded from free-text tags)
- Locker availability (yes/no/free/paid)
- Storage information (location, pricing, restrictions)

### 4. Verified Host System (WORKFLOW)
`business_profiles.verified` boolean exists but no workflow or badge.
- Verification workflow (document upload → review → approve/reject)
- Verified badge UI component (on cards, listings, detail views)
- Trust indicators (verified since date, verification level)
- Application + review admin flow

### 5. Waitlist Automation (ENHANCE)
Waitlist toggle + automation job type exist. Missing auto-invite pipeline.
- Queue management (ordered by application time)
- Auto-invite next attendee when ticket cancelled
- Invite expiry timer (configurable: 2/6/12/24 hours)
- Auto-reassign on expiry
- Waitlist analytics (conversion rate, avg wait time)
- Notifications (invited, expiring, expired)

### 6. Fraud + Risk Engine (NEW)
Fraud_rules DB table + account creation logging exists. Missing event-specific risk.
- Scalper detection (multiple tickets same card, rapid purchase velocity)
- Suspicious purchase scoring (new account, VPN, mismatched billing/event city)
- Duplicate account detection (same email hash, device fingerprint)
- Repeat no-show tracking
- Abuse pattern detection (mass refund requests, chargeback patterns)
- Risk score per attendee (0-100)
- Block/Flag/Warn actions per score threshold

### 7. Calendar Integration (NEW)
Nothing exists.
- Add to Google Calendar (direct link)
- Add to Apple Calendar (ICS download)
- Add to Outlook (direct link)
- ICS file generation (RFC 5545)
- In-app reminders (1h, 1d, 1w before)
- Calendar sync toggle in attendee preferences

### 8. Support System (NEW)
Contact fields + AI FAQ + safety reports exist. Missing ticketing.
- Need Help button (persistent, every view)
- Support ticket creation (category, priority, description)
- Ticket status tracking (open, investigating, resolved, closed)
- Escalation workflow (auto-escalate after 24h no response)
- Emergency support (high-priority, SMS/phone callback)
- Knowledge base (searchable, linked from AI FAQ)
- Support dashboard for hosts (manage tickets, respond)

---

## DB Migration

**File**: `20250519000005_efficiency_systems.sql`

### New Tables

```sql
-- 1. VERIFIED HOST WORKFLOW
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'revoked')),
  requester_id UUID NOT NULL REFERENCES accounts(id),
  documents JSONB DEFAULT '[]',  -- [{type: 'business_license', url: '...', verified: false}, ...]
  notes TEXT,
  reviewed_by UUID REFERENCES accounts(id),
  reviewed_at TIMESTAMPTZ,
  verification_level TEXT DEFAULT 'basic' CHECK (verification_level IN ('basic', 'premium', 'enterprise')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WAITLIST AUTO-INVITE
CREATE TABLE waitlist_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  position INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'expired', 'converted', 'cancelled')),
  invited_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual',  -- 'manual', 'auto_cancellation', 'promoter_release'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FRAUD RISK ENGINE
CREATE TABLE fraud_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors JSONB DEFAULT '[]',  -- [{factor: 'new_account', weight: 30, details: '...'}, ...]
  action_taken TEXT DEFAULT 'none' CHECK (action_taken IN ('none', 'flag', 'block', 'warn')),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  fraud_type TEXT NOT NULL CHECK (fraud_type IN ('scalping', 'duplicate_account', 'chargeback_abuse', 'no_show_pattern', 'bulk_cancellation', 'suspicious_purchase', 'promoter_abuse', 'velocity_anomaly')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  flagged_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);

-- 4. CALENDAR INTEGRATION
CREATE TABLE calendar_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
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

CREATE TABLE event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  remind_at TIMESTAMPTZ NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('1h_before', '2h_before', '6h_before', '1d_before', '1w_before', 'custom')),
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push', 'sms')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUPPORT SYSTEM
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT REFERENCES events(id),
  requester_id UUID NOT NULL REFERENCES accounts(id),
  assigned_to UUID REFERENCES accounts(id),
  category TEXT NOT NULL CHECK (category IN ('general', 'ticketing', 'refund', 'safety', 'technical', 'host_support', 'emergency')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'waiting_on_user', 'resolved', 'closed')),
  escalation_level INT DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES accounts(id),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_knowledge_base (
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

-- 6. EVENT GENDER + ENTRY RULES (new columns on events table)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gender_rule TEXT DEFAULT 'any'
    CHECK (gender_rule IN ('any', 'couples_only', 'women_only', 'men_only', 'invite_only', 'ratio_controlled', 'custom')),
  ADD COLUMN IF NOT EXISTS gender_ratio JSONB DEFAULT '{}',  -- {male_max_pct: 60, female_min_pct: 40}
  ADD COLUMN IF NOT EXISTS custom_entry_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS entry_approval_required BOOLEAN DEFAULT FALSE;

-- 7. TABLE + SEATING (new columns on events / dedicated table)
CREATE TABLE table_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('vip', 'general', 'standing', 'table', 'balcony', 'booth')),
  capacity INT NOT NULL DEFAULT 0,
  price_cents INT DEFAULT 0,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES events(id),
  section_id UUID NOT NULL REFERENCES table_sections(id),
  table_label TEXT,  -- 'A1', 'VIP-2', 'Booth-4'
  seats INT DEFAULT 1,
  attendee_id UUID REFERENCES accounts(id),
  ticket_id UUID REFERENCES tickets(id),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'occupied', 'maintenance')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BAG + SECURITY RULES (new columns on events)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS bag_policy TEXT DEFAULT 'any'
    CHECK (bag_policy IN ('any', 'no_bags', 'small_bags_only', 'clear_bags_only', 'no_restrictions')),
  ADD COLUMN IF NOT EXISTS locker_available BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locker_cost_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locker_info TEXT,
  ADD COLUMN IF NOT EXISTS storage_info TEXT,
  ADD COLUMN IF NOT EXISTS upgraded_prohibited_items TEXT[] DEFAULT '{}';
```

### Audit Logging
```sql
CREATE TABLE efficiency_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_eal_system ON efficiency_audit_logs(system, created_at);
```

---

## API Structure

### Base: `/api/efficiency`

```
POST   /api/efficiency/verify/request         — Submit verification request
GET    /api/efficiency/verify/status/:id       — Check verification status
GET    /api/efficiency/verify/pending          — List pending (admin)
POST   /api/efficiency/verify/review/:id       — Approve/reject

GET    /api/efficiency/waitlist/:eventId       — Get waitlist queue
POST   /api/efficiency/waitlist/:eventId/join  — Join waitlist
POST   /api/efficiency/waitlist/invite/:id     — Invite from waitlist
POST   /api/efficiency/waitlist/reassign/:id   — Auto-reassign on expiry

POST   /api/efficiency/fraud/score/:eventId    — Calculate/refresh risk scores
GET    /api/efficiency/fraud/scores/:eventId   — List risk scores for event
POST   /api/efficiency/fraud/review/:id        — Review fraud event
GET    /api/efficiency/fraud/dashboard/:eventId — Fraud dashboard summary

POST   /api/efficiency/calendar/ics/:eventId   — Generate ICS download
GET    /api/efficiency/calendar/links/:eventId — Get Google/Apple/Outlook links
POST   /api/efficiency/calendar/reminder       — Set reminder
GET    /api/efficiency/calendar/reminders      — List reminders
DELETE /api/efficiency/calendar/reminder/:id   — Remove reminder

POST   /api/efficiency/support/tickets         — Create ticket
GET    /api/efficiency/support/tickets         — List tickets (user or host)
GET    /api/efficiency/support/tickets/:id     — Get ticket detail
POST   /api/efficiency/support/tickets/:id/message — Add message
POST   /api/efficiency/support/tickets/:id/status — Update status
GET    /api/efficiency/support/kb              — Search knowledge base
GET    /api/efficiency/support/kb/:id          — Get article
POST   /api/efficiency/support/kb/:id/feedback — Mark helpful/not

GET    /api/efficiency/gender-rules/:eventId   — Get gender rules
PUT    /api/efficiency/gender-rules/:eventId   — Update gender rules

GET    /api/efficiency/tables/:eventId         — List sections + tables
POST   /api/efficiency/tables/reserve          — Reserve table
GET    /api/efficiency/tables/sections/:eventId — Get sections

GET    /api/efficiency/bag-rules/:eventId      — Get bag policy
PUT    /api/efficiency/bag-rules/:eventId      — Update bag policy

GET    /api/efficiency/host/trust-score/:id    — Get host trust indicators
GET    /api/efficiency/host/badge/:id          — Get verification badge info
```

---

## Component Architecture

```
CreateEventForm enhancements (new sections):
├── Gender & Entry Rules (gender rule, ratio, approval)
├── Table & Seating (sections, capacity, VIP)
├── Bag & Security (structured bag policy, lockers, storage)

EventDetailView enhancements:
├── VerifiedHostBadge (on event card + detail)
├── TableSeatingView (interactive section map)
├── BagSecurityBadge (policy summary badges)
├── CalendarIntegration (Add to Calendar buttons)
├── GenderEntryBadge (rule display)

Global:
├── SupportCenter (Need Help widget → ticket system)
│   ├── TicketList
│   ├── TicketDetail
│   ├── NewTicketForm
│   └── KnowledgeBase

Host-only:
├── VerifiedHostWorkflow (application + status)
├── FraudRiskDashboard
│   ├── RiskScoreTable
│   ├── FraudEventList
│   └── BlockedUsers
├── WaitlistAutomationPanel
│   ├── QueueList
│   ├── AutoInviteConfig
│   └── Analytics
├── SupportDashboard (ticket management)
└── TableSeatingEditor (manage sections + tables)
```

---

## Implementation Order

### Phase 1 — DB + Types + API Proxy
1. Migration SQL for all new tables/columns
2. TypeScript types in types.ts
3. API proxy at `api/efficiency/[...path].ts`

### Phase 2 — Host-Side Components
4. WaitlistAutomationPanel (queue, invite config, analytics)
5. TableSeatingEditor (section management)
6. VerifiedHostWorkflow (application + review)
7. FraudRiskDashboard (risk scores, events, blocks)

### Phase 3 — Attendee-Facing Components
8. CalendarIntegration (Add to Calendar + reminders)
9. GenderEntryRules + TableSeatingView + BagSecurityBadge
10. SupportCenter (Need Help widget, tickets, KB)

### Phase 4 — Wiring
11. CreateEventForm sections for gender rules, bag policy, table sections
12. EventDetailTabs integration (Fraud, Waitlist, Support as host-only tabs)
13. Global SupportCenter button

---

## Edge Cases

- **Waitlist**: Race condition when two cancellations happen simultaneously — use queue + atomic position assignment
- **Fraud**: False positives must be appealable; flag should NOT block outright without review
- **Calendar**: ICS generation must handle recurring events, multi-day events, timezone-aware
- **Support**: Emergency tickets bypass queue and notify on-call via SMS
- **Verification**: Documents stored encrypted; verification expires after 12 months
- **Tables**: Concurrent reservation attempts need row-level locking or optimistic locking
- **Gender rules**: Cannot be enforced at purchase time for private/invite-only — requires approval workflow
