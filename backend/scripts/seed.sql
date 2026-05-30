-- Seed script for populating test data
-- Run with: psql -U postgres -d valueskins < seed.sql

-- Clear existing data (CAUTION - production use only with backup)
-- DELETE FROM deals;
-- DELETE FROM opportunities;
-- DELETE FROM personas;
-- DELETE FROM users;

-- Insert sample users
INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES
    ('user_creator_1', 'creator1@example.com', 'hash_placeholder', NOW(), NOW()),
    ('user_creator_2', 'creator2@example.com', 'hash_placeholder', NOW(), NOW()),
    ('user_creator_3', 'creator3@example.com', 'hash_placeholder', NOW(), NOW()),
    ('user_brand_1', 'brand1@example.com', 'hash_placeholder', NOW(), NOW()),
    ('user_brand_2', 'brand2@example.com', 'hash_placeholder', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert sample personas (creators)
INSERT INTO personas (id, user_id, profession, followers, bio, created_at, updated_at) VALUES
    ('creator_1', 'user_creator_1', 'Software Engineer', 890000, 'Full-stack engineer interested in tech sponsorships', NOW(), NOW()),
    ('creator_2', 'user_creator_2', 'Product Designer', 560000, 'UX/UI designer focusing on design systems', NOW(), NOW()),
    ('creator_3', 'user_creator_3', 'Marketing Manager', 340000, 'B2B marketing and SaaS growth content', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert sample opportunities
INSERT INTO opportunities (
    id, platform, brand_id, brand_name, title, description, category, deal_type,
    budget_min, budget_max, timeline_days, deliverables, script_required,
    status, applications_count, created_at, deadline_at, updated_at
) VALUES
    ('opp_1', 'instagram', 'brand_1', 'TechFlow Inc', 'Product Review Campaign',
     'We need authentic reviews of our new SaaS product', 'Tech', 'paid',
     2000, 5000, 14, 'video', false, 'open', 0, NOW(), NOW() + INTERVAL '30 days', NOW()),
    ('opp_2', 'instagram', 'brand_2', 'DesignCorp', 'Brand Ambassador Program',
     'Looking for designers to showcase our tools', 'Design', 'c2c_collab',
     1500, 3500, 21, 'content', false, 'open', 0, NOW(), NOW() + INTERVAL '45 days', NOW()),
    ('opp_3', 'youtube', 'brand_1', 'TechFlow Inc', 'Tutorial Sponsorship',
     'Sponsor a coding tutorial video', 'Tech', 'paid',
     3000, 8000, 30, 'long-form video', false, 'open', 0, NOW(), NOW() + INTERVAL '60 days', NOW()),
    ('opp_4', 'linkedin', 'brand_2', 'DesignCorp', 'Speaking Engagement',
     'Present at our annual design conference', 'Design', 'c2c_paid',
     5000, 10000, 60, 'speaking', false, 'open', 0, NOW(), NOW() + INTERVAL '90 days', NOW())
ON CONFLICT DO NOTHING;

-- Insert sample deals (for reputation calculation)
INSERT INTO deals (
    id, creator_id, brand_id, opportunity_id, status, payment_status,
    deal_amount, created_at, deadline_at, completed_at,
    final_rating, dispute_status
) VALUES
    ('deal_1', 'creator_1', 'brand_1', 'opp_1', 'completed', 'released',
     3500, NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days',
     95, NULL),
    ('deal_2', 'creator_1', 'brand_2', NULL, 'completed', 'released',
     2500, NOW() - INTERVAL '60 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days',
     88, NULL),
    ('deal_3', 'creator_2', 'brand_1', 'opp_2', 'completed', 'released',
     3000, NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days',
     92, NULL),
    ('deal_4', 'creator_3', 'brand_2', NULL, 'completed', 'released',
     2000, NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '32 days',
     78, 'resolved')
ON CONFLICT DO NOTHING;

-- Insert creator reputation scores (calculated, but seeded for immediate availability)
INSERT INTO creator_reputation (
    creator_id, score, risk_tier, on_time_rate, avg_rating,
    response_score, revision_efficiency, repeat_brand_rate,
    max_deal_size, completed_deals, dispute_count, calculated_at
) VALUES
    ('creator_1', 88, 'B', 1.0, 4.4, 1.0, 0.85, 0.5, 3500, 2, 0, NOW()),
    ('creator_2', 92, 'A', 1.0, 4.6, 1.0, 0.9, 0.33, 3000, 1, 0, NOW()),
    ('creator_3', 78, 'C', 0.5, 3.9, 0.75, 0.8, 0.0, 2000, 1, 1, NOW())
ON CONFLICT (creator_id) DO UPDATE SET
    score = EXCLUDED.score,
    risk_tier = EXCLUDED.risk_tier,
    on_time_rate = EXCLUDED.on_time_rate,
    avg_rating = EXCLUDED.avg_rating,
    calculated_at = EXCLUDED.calculated_at;

-- Insert escrow stages for active deals
INSERT INTO escrow_stages (
    id, deal_id, stage_number, description, amount_usd,
    status, condition, created_at
) VALUES
    ('escrow_1', 'deal_1', 1, 'Upfront payment', 1750, 'released', 'upfront', NOW() - INTERVAL '30 days'),
    ('escrow_2', 'deal_1', 2, 'On approval', 1750, 'released', 'on_approval', NOW() - INTERVAL '25 days')
ON CONFLICT DO NOTHING;

-- Verify seed data
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as creator_count FROM personas;
SELECT COUNT(*) as opportunity_count FROM opportunities;
SELECT COUNT(*) as deal_count FROM deals;
SELECT COUNT(*) as reputation_count FROM creator_reputation;
