-- Test Data Seeding Script
-- Populates database with 100 test creators, 20 brands, and sample deals
-- Run: psql -U postgres -d valueskins < seed_test_data.sql

-- 1. CREATE TEST USERS (CREATORS)
INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
SELECT
  'creator_' || i || '@test.com',
  'google',
  'google_' || i,
  'Creator ' || i,
  'https://via.placeholder.com/150?text=Creator' || i,
  NOW() - INTERVAL '30 days',
  NOW()
FROM generate_series(1, 100) AS i
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 2. CREATE TEST BRANDS
INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
SELECT
  'brand_' || i || '@test.com',
  'google',
  'brand_' || i,
  'Brand ' || i,
  'https://via.placeholder.com/150?text=Brand' || i,
  NOW() - INTERVAL '30 days',
  NOW()
FROM generate_series(1, 20) AS i
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 3. CREATE CREATOR PERSONAS
INSERT INTO personas (user_id, platform, platform_handle, followers, engagement_rate, bio, profile_picture_url, persona_type, created_at, updated_at)
SELECT
  u.id,
  CASE (i % 5)
    WHEN 0 THEN 'instagram'
    WHEN 1 THEN 'youtube'
    WHEN 2 THEN 'tiktok'
    WHEN 3 THEN 'linkedin'
    ELSE 'instagram'
  END,
  'handle_' || i,
  (RANDOM() * 1000000)::BIGINT,
  (RANDOM() * 10)::NUMERIC(5,2),
  'Test creator ' || i || ' bio',
  'https://via.placeholder.com/150',
  'creator',
  NOW() - INTERVAL '30 days',
  NOW()
FROM users u, generate_series(1, 100) AS i
WHERE u.email = 'creator_' || i || '@test.com'
ON CONFLICT DO NOTHING;

-- 4. CREATE BRAND PROFILES
INSERT INTO brands (user_id, name, logo_uri, website, verified, created_at, updated_at)
SELECT
  u.id,
  'Brand ' || i,
  'https://via.placeholder.com/150?text=Brand' || i,
  'https://brand' || i || '.example.com',
  i % 2 = 0, -- 50% verified
  NOW() - INTERVAL '30 days',
  NOW()
FROM users u, generate_series(1, 20) AS i
WHERE u.email = 'brand_' || i || '@test.com'
ON CONFLICT DO NOTHING;

-- 5. CREATE TEST OPPORTUNITIES (CAMPAIGNS)
INSERT INTO opportunities (brand_id, brand_user_id, title, description, category, required_profession_id, required_level, reward_amount, reward_currency, deadline, status, compensation_type, created_at, updated_at)
SELECT
  b.id,
  u.id,
  'Campaign: ' || b.name || ' - ' || (ARRAY['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage'])[((i % 4) + 1)],
  'Looking for a creator to work on our ' || b.name || ' campaign.',
  (ARRAY['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage'])[((i % 4) + 1)],
  1, -- All require software engineer profession (simplification)
  1, -- Level 1+
  ((RANDOM() * 5000) + 500)::BIGINT * 100, -- $5-5500 in cents
  'USD',
  NOW() + INTERVAL '30 days' + (RANDOM() * '60 days'::INTERVAL),
  'open',
  'paid',
  NOW() - INTERVAL '15 days' + (RANDOM() * '15 days'::INTERVAL),
  NOW()
FROM brands b, users u, generate_series(1, 5) AS i -- 5 campaigns per brand
WHERE b.user_id = u.id AND u.email LIKE 'brand_%@test.com'
ON CONFLICT DO NOTHING;

-- 6. CREATE DEAL ROOMS (SAMPLE ACTIVE DEALS)
INSERT INTO deal_rooms (creator_user_id, brand_user_id, opportunity_id, status, phase, agreed_amount_cents, currency, created_at, updated_at)
SELECT
  p.user_id,
  b.user_id,
  o.id,
  CASE (ROW_NUMBER() OVER (ORDER BY RANDOM()) % 5)
    WHEN 0 THEN 'active'
    WHEN 1 THEN 'negotiating'
    WHEN 2 THEN 'contract_pending'
    WHEN 3 THEN 'in_progress'
    ELSE 'active'
  END,
  CASE (ROW_NUMBER() OVER (ORDER BY RANDOM()) % 5)
    WHEN 0 THEN 'matching'
    WHEN 1 THEN 'negotiation'
    WHEN 2 THEN 'contract'
    WHEN 3 THEN 'deliverables'
    ELSE 'matching'
  END,
  o.reward_amount,
  'USD',
  NOW() - INTERVAL '7 days',
  NOW()
FROM personas p
CROSS JOIN opportunities o
CROSS JOIN brands b
WHERE p.persona_type = 'creator'
  AND o.brand_id = b.id
  AND RANDOM() < 0.3 -- Create deals for 30% of possible creator-opportunity pairs
LIMIT 50; -- 50 active/negotiating deals

-- 7. CREATE COMPLETED DEALS (FOR REPUTATION SCORING)
INSERT INTO deal_rooms (creator_user_id, brand_user_id, opportunity_id, status, phase, agreed_amount_cents, currency, completed_at, approved_at, created_at, updated_at)
SELECT
  p.user_id,
  b.user_id,
  o.id,
  'completed',
  'completed',
  ((RANDOM() * 10000) + 1000)::BIGINT * 100,
  'USD',
  NOW() - INTERVAL '1 days' - (RANDOM() * '90 days'::INTERVAL),
  NOW() - INTERVAL '2 days' - (RANDOM() * '90 days'::INTERVAL),
  NOW() - INTERVAL '100 days' - (RANDOM() * '100 days'::INTERVAL),
  NOW()
FROM personas p, brands b, opportunities o, generate_series(1, 3) AS i
WHERE p.persona_type = 'creator'
  AND o.brand_id = b.id
  AND RANDOM() < 0.15
LIMIT 30; -- 30 completed deals

-- 8. CREATE TESTIMONIALS (RATINGS)
INSERT INTO testimonials (for_persona_id, from_user_id, rating, comment, visibility, created_at)
SELECT
  p.id,
  b.user_id,
  (RANDOM() * 4 + 1)::INT, -- 1-5 stars
  'Great work! ' || (ARRAY['Professional', 'Delivered on time', 'Excellent quality', 'Would hire again'])[((RANDOM() * 4)::INT + 1)],
  RANDOM() < 0.7, -- 70% public
  NOW() - INTERVAL '1 days' - (RANDOM() * '90 days'::INTERVAL)
FROM personas p
CROSS JOIN brands b
CROSS JOIN generate_series(1, 2) AS i
WHERE p.persona_type = 'creator'
  AND RANDOM() < 0.25 -- 25% of creators get reviews
LIMIT 100;

-- 9. CREATE REPUTATION METRICS
INSERT INTO creator_reputation_metrics (creator_user_id, reputation_score, on_time_rate, avg_rating, response_score, revision_efficiency, repeat_brand_rate, total_deals, created_at, updated_at)
SELECT
  u.id,
  (RANDOM() * 100)::NUMERIC(5,2),
  (RANDOM() * 100)::NUMERIC(5,2),
  (RANDOM() * 5)::NUMERIC(3,2),
  (RANDOM() * 100)::NUMERIC(5,2),
  (RANDOM() * 100)::NUMERIC(5,2),
  (RANDOM() * 100)::NUMERIC(5,2),
  (RANDOM() * 20)::INT,
  NOW() - INTERVAL '7 days',
  NOW()
FROM users u
WHERE u.email LIKE 'creator_%@test.com'
ON CONFLICT (creator_user_id) DO UPDATE SET
  reputation_score = EXCLUDED.reputation_score,
  updated_at = NOW();

-- 10. CREATE ANALYTICS EVENTS
INSERT INTO analytics_events (event_type, user_id, persona_id, metadata, created_at)
SELECT
  (ARRAY['user_signup', 'creator_search', 'opportunity_view', 'opportunity_apply', 'deal_created', 'deal_completed'])[((i % 6) + 1)],
  u.id,
  COALESCE(p.id, NULL),
  '{"platform": "test"}'::JSONB,
  NOW() - INTERVAL '90 days' + (RANDOM() * '90 days'::INTERVAL)
FROM users u
LEFT JOIN personas p ON u.id = p.user_id
CROSS JOIN generate_series(1, 10) AS i
LIMIT 2000; -- 2000 events

-- 11. CREATE DISPUTES (SAMPLE)
INSERT INTO disputes (deal_id, filed_by_user_id, dispute_type, description, status, filed_at, created_at)
SELECT
  d.id,
  CASE RANDOM() < 0.5
    WHEN true THEN d.creator_user_id
    ELSE d.brand_user_id
  END,
  (ARRAY['late_delivery', 'quality_issue', 'payment_dispute', 'other'])[((RANDOM() * 4)::INT + 1)],
  'Sample dispute for testing',
  CASE (RANDOM() * 3)::INT
    WHEN 0 THEN 'open'
    WHEN 1 THEN 'in_review'
    ELSE 'resolved'
  END,
  NOW() - INTERVAL '7 days' - (RANDOM() * '7 days'::INTERVAL),
  NOW()
FROM deal_rooms d
WHERE d.status = 'completed'
  AND RANDOM() < 0.2 -- 20% of completed deals have disputes
LIMIT 10;

-- 12. SUMMARY COUNTS
SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE 'creator_%@test.com') as test_creators,
  (SELECT COUNT(*) FROM users WHERE email LIKE 'brand_%@test.com') as test_brands,
  (SELECT COUNT(*) FROM opportunities) as opportunities,
  (SELECT COUNT(*) FROM deal_rooms WHERE status != 'completed') as active_deals,
  (SELECT COUNT(*) FROM deal_rooms WHERE status = 'completed') as completed_deals,
  (SELECT COUNT(*) FROM analytics_events) as events,
  (SELECT COUNT(*) FROM disputes) as disputes;
