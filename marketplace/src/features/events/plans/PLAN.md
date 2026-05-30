# Club/Venue Event Hosting System — Plan

## Overview

Extend ValueSkins events from one-time individual hosting (house parties, meetups)
to recurring professional hosts (clubs, bars, lounges, venues, event companies).

## Architecture

```
EventManagementPage (page router)
├── Landing (2-choice: Host / Browse) + "My Events" + "My Venue"
│
├── Host flow
│   ├── BusinessProfileForm (create/edit venue profile — one time)
│   ├── CreateEventForm (existing — linked to business profile)
│   │   ├── "Use template" button → loads from EventTemplate
│   │   └── "Duplicate previous" button → loads from past event
│   └── RecurringTemplateForm (save as template, set recurrence)
│
├── Browse flow
│   ├── BrowseFilters
│   ├── EventCard (show "Hosted by Club XYZ" + "Promoted by @Rahul")
│   └── EventDetailView (show promoter attribution)
│
├── MyEventsPage
│   ├── Hosted tab
│   ├── Applied tab
│   └── Manage tab (applications, RSVPs)
│
├── VenuePage (profile view for a business)
│   ├── Header (logo, cover, info, social links)
│   ├── Upcoming events list
│   └── Past events
│
├── HostDashboard
│   ├── Ticket sales summary
│   ├── Revenue chart
│   ├── Promoter performance table
│   ├── Top promoters leaderboard
│   ├── Attendance stats
│   └── Event analytics
│
├── PromoterDashboard
│   ├── Tickets sold
│   ├── Earnings (total, pending, paid)
│   ├── Clicks / conversion rate
│   ├── Upcoming events
│   ├── Withdrawal balance
│   └── Leaderboard
│
├── PromoterManagement
│   ├── Search/select promoters
│   ├── Invite flow (send invite → accept → generate link)
│   ├── Promoter list with performance
│   └── Commission settings per promoter
│
├── CommissionSettings
│   ├── Fixed amount
│   ├── Percentage
│   ├── Tiered (e.g. 5% first 50, 10% after)
│   └── Max payout / approval rules
│
└── VenueDiscovery
    ├── Venue listing
    └── Venue detail pages
```

## Database Schema (Migration #4)

```sql
-- 1. BUSINESS PROFILES (one per business host account)
CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  business_name TEXT NOT NULL,
  logo_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  google_maps_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  website TEXT,
  social_links JSONB DEFAULT '[]',      -- [{platform, url}]
  venue_photos JSONB DEFAULT '[]',       -- [url]
  capacity INTEGER DEFAULT 0,
  parking_info TEXT,
  amenities JSONB DEFAULT '[]',          -- [string]
  dress_code_default TEXT,
  age_restriction_default INTEGER DEFAULT 0,
  venue_policies TEXT,
  music_preferences JSONB DEFAULT '[]',  -- [string]
  default_tags JSONB DEFAULT '[]',       -- [string]
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_profiles_account ON business_profiles(account_id);
CREATE INDEX idx_business_profiles_city ON business_profiles(city);

-- 2. EVENT TEMPLATES (reusable)
CREATE TABLE event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,                      -- "Friday Techno Party"
  description TEXT,
  category TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT,                    -- 'daily', 'weekly', 'monthly', 'custom'
  recurrence_config JSONB,                 -- {day_of_week: 5, week_of_month: 1, interval_days: 14}
  -- Pre-filled form state (stored as JSON snapshot of CreateEventFormState)
  template_data JSONB NOT NULL,
  sort_order INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_business ON event_templates(business_profile_id);

-- 3. PROMOTERS
CREATE TABLE promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  -- Can be linked to a ValueSkin user or be external
  account_id UUID REFERENCES accounts(id),          -- null if external
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  promoter_type TEXT NOT NULL DEFAULT 'individual', -- individual, creator, influencer, student_ambassador, club_promoter
  status TEXT NOT NULL DEFAULT 'active',             -- active, suspended, banned, deleted
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promoters_business ON promoters(business_profile_id);
CREATE INDEX idx_promoters_account ON promoters(account_id);

-- 4. PROMOTER COMMISSIONS (per-promoter config, overridable per-event)
CREATE TABLE promoter_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id UUID NOT NULL REFERENCES promoters(id),
  event_id UUID REFERENCES events(id),               -- null = default, set = per-event override
  commission_type TEXT NOT NULL,                     -- 'fixed', 'percentage', 'tiered'
  -- Fixed
  fixed_amount_cents INTEGER DEFAULT 0,
  -- Percentage
  percentage_rate NUMERIC(5,2) DEFAULT 0.00,         -- e.g. 10.00 = 10%
  -- Tiered
  tier_config JSONB DEFAULT '[]',                     -- [{min_tickets: 0, rate: 5}, {min_tickets: 50, rate: 10}]
  max_payout_cents INTEGER DEFAULT 0,                -- 0 = unlimited
  requires_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commissions_promoter ON promoter_commissions(promoter_id);

-- 5. PROMOTER REFERRAL LINKS
CREATE TABLE referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id UUID NOT NULL REFERENCES promoters(id),
  event_id UUID NOT NULL REFERENCES events(id),
  referral_code TEXT NOT NULL UNIQUE,                -- short unique code
  referral_url TEXT NOT NULL,
  promo_code TEXT,                                    -- optional discount code
  qr_code_url TEXT,                                   -- generated QR
  unique_clicks INTEGER DEFAULT 0,
  ticket_sales INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  refunds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_links_promoter ON referral_links(promoter_id);
CREATE INDEX idx_referral_links_event ON referral_links(event_id);
CREATE INDEX idx_referral_links_code ON referral_links(referral_code);

-- 6. PAYOUTS
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  event_id UUID REFERENCES events(id),
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER DEFAULT 0,                       -- ValueSkins fee
  promoter_commission_cents INTEGER DEFAULT 0,       -- total promoter commissions
  net_amount_cents INTEGER NOT NULL,                 -- amount - fees - commissions
  status TEXT NOT NULL DEFAULT 'pending',            -- pending, processing, completed, failed, reversed
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_business ON payouts(business_profile_id);

-- 7. VENUE ANALYTICS (rolled-up daily)
CREATE TABLE venue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  date DATE NOT NULL,
  ticket_sales INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  promoter_ticket_sales INTEGER DEFAULT 0,
  promoter_revenue_cents INTEGER DEFAULT 0,
  unique_attendees INTEGER DEFAULT 0,
  repeat_attendees INTEGER DEFAULT 0,
  top_promoter_id UUID REFERENCES promoters(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_profile_id, date)
);

-- 8. EVENT BUSINESS LINK (associate event with business profile)
ALTER TABLE events ADD COLUMN IF NOT EXISTS business_profile_id UUID REFERENCES business_profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES event_templates(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS promoter_ids UUID[] DEFAULT '{}';

CREATE INDEX idx_events_business ON events(business_profile_id);
```

## API Design

### Business Profiles
```
POST   /api/business-profiles          — create
GET    /api/business-profiles/mine     — get my profile
GET    /api/business-profiles/:id      — get by ID
PUT    /api/business-profiles/:id      — update
DELETE /api/business-profiles/:id      — delete

GET    /api/business-profiles          — list (with city/search/category filters)
GET    /api/business-profiles/:id/events — events for this venue
```

### Templates
```
POST   /api/templates                  — create template
GET    /api/templates                  — list my templates
GET    /api/templates/:id              — get template detail
PUT    /api/templates/:id              — update
DELETE /api/templates/:id              — delete
POST   /api/templates/:id/use          — create event from template (returns pre-filled form)

POST   /api/events/:id/duplicate       — duplicate an event into a new event
POST   /api/events/:id/save-template   — save an event as a template
```

### Promoters
```
POST   /api/promoters                  — add promoter
GET    /api/promoters                  — list promoters for my venue
GET    /api/promoters/:id              — promoter detail
PUT    /api/promoters/:id              — update promoter
DELETE /api/promoters/:id              — remove (soft-delete)
POST   /api/promoters/search           — search users to invite as promoters

POST   /api/promoters/:id/invite       — send invite
POST   /api/promoters/:id/approve      — approve pending promoter
POST   /api/promoters/:id/suspend      — suspend promoter
POST   /api/promoters/:id/commission   — set commission for promoter
```

### Referral Links
```
POST   /api/referral-links             — generate link for promoter+event
GET    /api/referral-links/:code       — resolve referral code (redirect + track click)
GET    /api/referral-links/promoter/:id — all links for a promoter
```

### Commissions
```
GET    /api/commissions/promoter/:id   — get commissions for promoter
PUT    /api/commissions/:id            — update commission config
POST   /api/commissions/calculate      — preview commission for given ticket price
```

### Payouts
```
GET    /api/payouts                    — list payouts for my venue
GET    /api/payouts/:id                — payout detail
POST   /api/payouts/:id/request        — request withdrawal
```

### Dashboards
```
GET    /api/host-dashboard             — aggregated venue analytics
GET    /api/promoter-dashboard         — promoter's personal dashboard
GET    /api/host-dashboard/top-promoters — leaderboard
GET    /api/promoter-dashboard/leaderboard — compare to other promoters
```

### Event Modifications
```
PUT    /api/events/:id/add-promoters   — attach promoters to event
PUT    /api/events/:id/set-commission  — override commission for this event
```

## UI Component Tree

```
EventManagementPage (main)
│
├── Landing
│   ├── "Host an event" → HostFlow
│   ├── "Browse events" → BrowseFlow
│   ├── "My Events" → MyEventsPage
│   └── "My Venue" → VenueFlow
│
├── HostFlow
│   ├── BusinessProfileForm (if no profile → create, else → skip)
│   ├── CreateEventForm
│   │   ├── "Use template" modal → TemplatePicker
│   │   └── "Duplicate previous" modal → EventPicker
│   └── RecurringTemplateForm (optional save as template)
│
├── VenueFlow
│   ├── HostDashboard (analytics, sales, promoter perf)
│   ├── PromoterManagement (invite, manage, commission)
│   ├── RecurringTemplateForm (manage templates)
│   ├── BusinessProfileForm (edit profile)
│   └── PromoterDashboard (if user is a promoter)
│
└── Shared
    ├── VenueCard (venue listing card)
    ├── VenuePage (public venue profile)
    ├── PromoterBadge (shown on event detail)
    └── CommissionEditor (reusable commission widget)
```

## Data Flow

### Creating an event as a venue:
1. User has BusinessProfile (created once)
2. User clicks "Host an event"
3. Can start from scratch, duplicate previous, or use template
4. CreateEventForm loads pre-filled data
5. On submit, event is linked to business_profile_id
6. Promoters can be added after creation
7. Each promoter gets a unique referral link

### Buying a ticket with promoter attribution:
1. Customer clicks promoter's referral link
2. Referral code tracked in session/localStorage
3. At checkout, promoter_id attached to ticket purchase
4. Commission calculated from promoter's config
5. ValueSkins fee deducted
6. Promoter commission withheld in escrow
7. Net amount sent to venue

### Promoter dashboard:
1. Promoter logs in
2. Sees all their referral links
3. Real-time stats: clicks, sales, revenue, conversions
4. Earnings summary: total, pending (in escrow), available (paid out)
5. Withdrawal request → creates Payout record
6. Admin approves payout → payment processed

## Implementation Order

Phase 1: Foundation (this session)
1. Database migration (SQL)
2. Types (TypeScript)
3. API proxy (mock handlers for all endpoints)
4. BusinessProfileForm component
5. Host Dashboard with embedded tabs (PromoterManagement, Templates, Settings)

Phase 2: Core Features (next)
6. RecurringTemplateForm + TemplatePicker
7. Duplicate event flow
8. Promoter search/invite/approve flow

Phase 3: Tracking (next)
9. Referral link generation (promo code, QR)
10. PromoterDashboard
11. Commission editor

Phase 4: Polish (next)
12. VenuePage (public)
13. VenueDiscovery (browse venues)
14. Analytics rollups
15. Empty/loading/error states

## Edge Cases (Addressed)

- **Self-referral**: Promoter cannot earn commission on their own ticket purchase (check account_id != customer_id)
- **Commission editing after sale**: Lock commission at time of sale. Edits apply to future sales only.
- **Refund handling**: On refund, reverse commission for that ticket. Deduct from future payouts.
- **Duplicate commissions**: idempotency key on referral click + ticket purchase prevents double-counting
- **Deleted promoters**: Promoter links still work (404 handled gracefully). New sales not attributed.
- **Banned promoters**: Same as deleted. Existing unpaid commissions forfeited.
- **Recurring failure**: If recurring event creation fails, queue retry with exponential backoff (max 3).
- **Event cancellation**: All promoter links invalidated. Pending payouts cancelled.
- **Promoter fraud**: Rate limit link generation (50/day). Flag accounts with >90% self-referral rate.
