-- 20250519000003: Club / Venue / Business Event Hosting System

-- 1. BUSINESS PROFILES

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT NOT NULL REFERENCES accounts(id),
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
  social_links JSONB DEFAULT '[]'::jsonb,
  venue_photos JSONB DEFAULT '[]'::jsonb,
  capacity INTEGER DEFAULT 0,
  parking_info TEXT,
  amenities JSONB DEFAULT '[]'::jsonb,
  dress_code_default TEXT,
  age_restriction_default INTEGER DEFAULT 0,
  venue_policies TEXT,
  music_preferences JSONB DEFAULT '[]'::jsonb,
  default_tags JSONB DEFAULT '[]'::jsonb,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_account ON business_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_city ON business_profiles(city);

-- 2. EVENT TEMPLATES

CREATE TABLE IF NOT EXISTS event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT,
  recurrence_config JSONB,
  template_data JSONB NOT NULL,
  sort_order INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_business ON event_templates(business_profile_id);

-- 3. PROMOTERS

CREATE TABLE IF NOT EXISTS promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  account_id BIGINT REFERENCES accounts(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  promoter_type TEXT NOT NULL DEFAULT 'individual',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promoters_business ON promoters(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_promoters_account ON promoters(account_id);

-- 4. PROMOTER COMMISSIONS

CREATE TABLE IF NOT EXISTS promoter_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id UUID NOT NULL REFERENCES promoters(id),
  event_id BIGINT REFERENCES events(id),
  commission_type TEXT NOT NULL,
  fixed_amount_cents INTEGER DEFAULT 0,
  percentage_rate NUMERIC(5,2) DEFAULT 0.00,
  tier_config JSONB DEFAULT '[]'::jsonb,
  max_payout_cents INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_promoter ON promoter_commissions(promoter_id);

-- 5. REFERRAL LINKS

CREATE TABLE IF NOT EXISTS referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id UUID NOT NULL REFERENCES promoters(id),
  event_id BIGINT NOT NULL REFERENCES events(id),
  referral_code TEXT NOT NULL UNIQUE,
  referral_url TEXT NOT NULL,
  promo_code TEXT,
  qr_code_url TEXT,
  unique_clicks INTEGER DEFAULT 0,
  ticket_sales INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  refunds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_links_promoter ON referral_links(promoter_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_event ON referral_links(event_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON referral_links(referral_code);

-- 6. PAYOUTS

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id),
  event_id BIGINT REFERENCES events(id),
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER DEFAULT 0,
  promoter_commission_cents INTEGER DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_business ON payouts(business_profile_id);

-- 7. VENUE ANALYTICS

CREATE TABLE IF NOT EXISTS venue_analytics (
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

-- 8. EVENT EXTENSIONS

ALTER TABLE events ADD COLUMN IF NOT EXISTS business_profile_id UUID REFERENCES business_profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES event_templates(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS promoter_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_events_business ON events(business_profile_id);
