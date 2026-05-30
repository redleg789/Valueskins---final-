-- Barter/Exposure/Free Collaboration System
-- Both brands and creators can signal willingness to work for free/exposure/barter.
-- Only for public accounts with ValueSkins (enforced at application layer).

-- 1. User-level preference: "I'm open to barter deals"
ALTER TABLE users
ADD COLUMN IF NOT EXISTS willing_to_barter BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_barter ON users(willing_to_barter) WHERE willing_to_barter = TRUE;

-- 2. Opportunity-level: what kind of compensation is this deal?
--    'paid'    = standard monetary deal (reward_amount > 0, platform takes 5%)
--    'barter'  = exchange of services/goods, no money changes hands
--    'exposure'= creator gets audience/portfolio value, no money
--    'hybrid'  = partial payment + barter/exposure component
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'paid'
    CHECK (compensation_type IN ('paid', 'barter', 'exposure', 'hybrid'));

-- 3. Optional: what the brand offers in barter (e.g., "Free product", "Cross-promotion to 500K followers")
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS barter_description TEXT;

CREATE INDEX IF NOT EXISTS idx_opportunities_compensation ON opportunities(compensation_type, status);

-- 4. Deal rooms need to know compensation type for escrow logic
ALTER TABLE deal_rooms
ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'paid'
    CHECK (compensation_type IN ('paid', 'barter', 'exposure', 'hybrid'));

-- 5. Completed deals: track barter separately for analytics
ALTER TABLE completed_deals
ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'paid'
    CHECK (compensation_type IN ('paid', 'barter', 'exposure', 'hybrid'));

-- 6. Revenue metrics: track barter deal volume separately
ALTER TABLE revenue_metrics
ADD COLUMN IF NOT EXISTS barter_deals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS barter_volume INTEGER DEFAULT 0;
