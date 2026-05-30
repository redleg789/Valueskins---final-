-- SEED DATA: Domains, Roles, Synonyms
-- ──────────────────────────────────────────────────────────────────────────
-- This migration populates the initial domain/role taxonomy.
-- Admins can add more later. These are the foundational categories.

-- ──────────────────────────────────────────────────────────────────────────
-- DOMAINS (Layer 1 — ~25 broad categories)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO search_domains (slug, name, description, sort_order) VALUES
    ('creator', 'Creator', 'Content creators, influencers, and digital personalities', 1),
    ('business', 'Business', 'Founders, consultants, investors, and operators', 2),
    ('music', 'Music', 'Musicians, producers, DJs, and music industry professionals', 3),
    ('journalism', 'Journalism', 'Journalists, writers, reporters, and media professionals', 4),
    ('technology', 'Technology', 'Developers, engineers, designers, and tech professionals', 5),
    ('education', 'Education', 'Teachers, tutors, trainers, and education professionals', 6),
    ('fitness', 'Fitness', 'Trainers, coaches, athletes, and wellness professionals', 7),
    ('events', 'Events', 'Event planners, hosts, coordinators, and entertainers', 8),
    ('gaming', 'Gaming', 'Gamers, streamers, esports players, and game developers', 9),
    ('fashion', 'Fashion', 'Designers, stylists, models, and fashion professionals', 10),
    ('travel', 'Travel', 'Travel creators, guides, bloggers, and hospitality professionals', 11),
    ('photography', 'Photography', 'Photographers, videographers, and visual artists', 12),
    ('film', 'Film', 'Filmmakers, actors, directors, and cinema professionals', 13),
    ('finance', 'Finance', 'Financial advisors, analysts, bankers, and fintech professionals', 14),
    ('healthcare', 'Healthcare', 'Doctors, therapists, nurses, and health professionals', 15),
    ('aviation', 'Aviation', 'Pilots, cabin crew, ground staff, and aviation professionals', 16),
    ('sports', 'Sports', 'Athletes, coaches, commentators, and sports professionals', 17),
    ('art', 'Art', 'Artists, illustrators, sculptors, and creative professionals', 18),
    ('food', 'Food', 'Chefs, food creators, restaurateurs, and culinary professionals', 19),
    ('real-estate', 'Real Estate', 'Agents, developers, investors, and property professionals', 20),
    ('law', 'Law', 'Lawyers, legal consultants, and legal professionals', 21),
    ('science', 'Science', 'Researchers, scientists, and STEM professionals', 22),
    ('nonprofit', 'Nonprofit', 'NGO workers, activists, and social impact professionals', 23),
    ('architecture', 'Architecture', 'Architects, interior designers, and design professionals', 24),
    ('marketing', 'Marketing', 'Marketers, growth professionals, and brand strategists', 25)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- ROLES (Layer 2 — belong to domains)
-- ──────────────────────────────────────────────────────────────────────────

-- Creator
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'influencer', 'Influencer', 'Social media influencer with audience reach'),
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'youtuber', 'YouTuber', 'YouTube content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'podcaster', 'Podcaster', 'Audio content creator and host'),
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'streamer', 'Streamer', 'Live streaming content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'blogger', 'Blogger', 'Written content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'creator'), 'content-creator', 'Content Creator', 'General digital content creator')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Business
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'founder', 'Founder', 'Company or startup founder'),
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'ceo', 'CEO', 'Chief Executive Officer'),
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'consultant', 'Consultant', 'Business or strategy consultant'),
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'investor', 'Investor', 'Angel investor, VC, or financial investor'),
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'operator', 'Operator', 'Business operations professional'),
    ((SELECT id FROM search_domains WHERE slug = 'business'), 'entrepreneur', 'Entrepreneur', 'Serial entrepreneur or business builder')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Music
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'singer', 'Singer', 'Vocal performer'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'guitarist', 'Guitarist', 'Guitar player'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'pianist', 'Pianist', 'Piano player'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'producer', 'Producer', 'Music producer'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'composer', 'Composer', 'Music composer and writer'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'dj', 'DJ', 'Disc jockey and electronic music artist'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'drummer', 'Drummer', 'Drum performer'),
    ((SELECT id FROM search_domains WHERE slug = 'music'), 'sound-engineer', 'Sound Engineer', 'Audio and sound engineer')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Journalism
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'journalism'), 'journalist', 'Journalist', 'News journalist'),
    ((SELECT id FROM search_domains WHERE slug = 'journalism'), 'reporter', 'Reporter', 'Field reporter'),
    ((SELECT id FROM search_domains WHERE slug = 'journalism'), 'editor', 'Editor', 'Content editor'),
    ((SELECT id FROM search_domains WHERE slug = 'journalism'), 'writer', 'Writer', 'Professional writer'),
    ((SELECT id FROM search_domains WHERE slug = 'journalism'), 'correspondent', 'Correspondent', 'Foreign or specialist correspondent')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Technology
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'developer', 'Developer', 'Software developer'),
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'designer', 'Designer', 'UI/UX or graphic designer'),
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'data-scientist', 'Data Scientist', 'Data science professional'),
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'engineer', 'Engineer', 'Software or systems engineer'),
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'product-manager', 'Product Manager', 'Product management professional'),
    ((SELECT id FROM search_domains WHERE slug = 'technology'), 'devops', 'DevOps', 'DevOps and infrastructure engineer')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Education
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'education'), 'teacher', 'Teacher', 'School or college teacher'),
    ((SELECT id FROM search_domains WHERE slug = 'education'), 'tutor', 'Tutor', 'Private or online tutor'),
    ((SELECT id FROM search_domains WHERE slug = 'education'), 'professor', 'Professor', 'University professor'),
    ((SELECT id FROM search_domains WHERE slug = 'education'), 'trainer', 'Trainer', 'Professional skills trainer'),
    ((SELECT id FROM search_domains WHERE slug = 'education'), 'coach', 'Coach', 'Life or career coach')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Fitness
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'fitness'), 'personal-trainer', 'Personal Trainer', 'One-on-one fitness trainer'),
    ((SELECT id FROM search_domains WHERE slug = 'fitness'), 'yoga-instructor', 'Yoga Instructor', 'Yoga teacher'),
    ((SELECT id FROM search_domains WHERE slug = 'fitness'), 'nutritionist', 'Nutritionist', 'Diet and nutrition professional'),
    ((SELECT id FROM search_domains WHERE slug = 'fitness'), 'athlete', 'Athlete', 'Professional athlete'),
    ((SELECT id FROM search_domains WHERE slug = 'fitness'), 'gym-owner', 'Gym Owner', 'Fitness facility owner')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Events
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'events'), 'event-planner', 'Event Planner', 'Event planning professional'),
    ((SELECT id FROM search_domains WHERE slug = 'events'), 'event-host', 'Event Host', 'Event host or emcee'),
    ((SELECT id FROM search_domains WHERE slug = 'events'), 'coordinator', 'Coordinator', 'Event coordinator'),
    ((SELECT id FROM search_domains WHERE slug = 'events'), 'vendor', 'Vendor', 'Event vendor or supplier')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Gaming
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'gaming'), 'gamer', 'Gamer', 'Professional or content-creator gamer'),
    ((SELECT id FROM search_domains WHERE slug = 'gaming'), 'esports-player', 'Esports Player', 'Competitive esports player'),
    ((SELECT id FROM search_domains WHERE slug = 'gaming'), 'game-developer', 'Game Developer', 'Video game developer'),
    ((SELECT id FROM search_domains WHERE slug = 'gaming'), 'streamer', 'Gaming Streamer', 'Gaming live streamer')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Fashion
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'fashion'), 'designer', 'Fashion Designer', 'Clothing and fashion designer'),
    ((SELECT id FROM search_domains WHERE slug = 'fashion'), 'stylist', 'Stylist', 'Fashion stylist'),
    ((SELECT id FROM search_domains WHERE slug = 'fashion'), 'model', 'Model', 'Fashion model'),
    ((SELECT id FROM search_domains WHERE slug = 'fashion'), 'buyer', 'Buyer', 'Fashion buyer or merchandiser')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Travel
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'travel'), 'travel-creator', 'Travel Creator', 'Travel content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'travel'), 'guide', 'Tour Guide', 'Professional tour guide'),
    ((SELECT id FROM search_domains WHERE slug = 'travel'), 'photographer', 'Travel Photographer', 'Travel photography specialist'),
    ((SELECT id FROM search_domains WHERE slug = 'travel'), 'blogger', 'Travel Blogger', 'Travel blog writer')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Photography
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'photography'), 'photographer', 'Photographer', 'Professional photographer'),
    ((SELECT id FROM search_domains WHERE slug = 'photography'), 'videographer', 'Videographer', 'Video content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'photography'), 'photo-editor', 'Photo Editor', 'Photo editing professional'),
    ((SELECT id FROM search_domains WHERE slug = 'photography'), 'drone-operator', 'Drone Operator', 'Aerial photography specialist')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Film
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'film'), 'filmmaker', 'Filmmaker', 'Film director and producer'),
    ((SELECT id FROM search_domains WHERE slug = 'film'), 'actor', 'Actor', 'Film or theatre actor'),
    ((SELECT id FROM search_domains WHERE slug = 'film'), 'director', 'Director', 'Film or video director'),
    ((SELECT id FROM search_domains WHERE slug = 'film'), 'cinematographer', 'Cinematographer', 'Camera and cinematography professional'),
    ((SELECT id FROM search_domains WHERE slug = 'film'), 'editor', 'Film Editor', 'Film and video editor')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Finance
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'finance'), 'financial-advisor', 'Financial Advisor', 'Personal finance advisor'),
    ((SELECT id FROM search_domains WHERE slug = 'finance'), 'analyst', 'Financial Analyst', 'Financial analysis professional'),
    ((SELECT id FROM search_domains WHERE slug = 'finance'), 'banker', 'Banker', 'Banking professional'),
    ((SELECT id FROM search_domains WHERE slug = 'finance'), 'accountant', 'Accountant', 'Accounting professional'),
    ((SELECT id FROM search_domains WHERE slug = 'finance'), 'fintech', 'Fintech Professional', 'Financial technology professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Healthcare
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'healthcare'), 'doctor', 'Doctor', 'Medical doctor'),
    ((SELECT id FROM search_domains WHERE slug = 'healthcare'), 'nurse', 'Nurse', 'Nursing professional'),
    ((SELECT id FROM search_domains WHERE slug = 'healthcare'), 'therapist', 'Therapist', 'Mental or physical therapist'),
    ((SELECT id FROM search_domains WHERE slug = 'healthcare'), 'dentist', 'Dentist', 'Dental professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Aviation
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'aviation'), 'pilot', 'Pilot', 'Commercial or private pilot'),
    ((SELECT id FROM search_domains WHERE slug = 'aviation'), 'cabin-crew', 'Cabin Crew', 'Flight attendant'),
    ((SELECT id FROM search_domains WHERE slug = 'aviation'), 'ground-staff', 'Ground Staff', 'Airport ground operations'),
    ((SELECT id FROM search_domains WHERE slug = 'aviation'), 'trainer', 'Flight Trainer', 'Aviation trainer or instructor'),
    ((SELECT id FROM search_domains WHERE slug = 'aviation'), 'atc', 'Air Traffic Controller', 'Air traffic control professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Sports
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'sports'), 'athlete', 'Professional Athlete', 'Professional sports athlete'),
    ((SELECT id FROM search_domains WHERE slug = 'sports'), 'coach', 'Sports Coach', 'Sports coaching professional'),
    ((SELECT id FROM search_domains WHERE slug = 'sports'), 'commentator', 'Commentator', 'Sports commentator'),
    ((SELECT id FROM search_domains WHERE slug = 'sports'), 'referee', 'Referee', 'Sports referee or official')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Art
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'art'), 'artist', 'Artist', 'Visual artist'),
    ((SELECT id FROM search_domains WHERE slug = 'art'), 'illustrator', 'Illustrator', 'Illustration professional'),
    ((SELECT id FROM search_domains WHERE slug = 'art'), 'sculptor', 'Sculptor', 'Sculpture artist'),
    ((SELECT id FROM search_domains WHERE slug = 'art'), 'graphic-designer', 'Graphic Designer', 'Graphic design professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Food
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'food'), 'chef', 'Chef', 'Professional chef'),
    ((SELECT id FROM search_domains WHERE slug = 'food'), 'food-creator', 'Food Creator', 'Food content creator'),
    ((SELECT id FROM search_domains WHERE slug = 'food'), 'restaurateur', 'Restaurateur', 'Restaurant owner or operator'),
    ((SELECT id FROM search_domains WHERE slug = 'food'), 'baker', 'Baker', 'Professional baker')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Real Estate
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'real-estate'), 'agent', 'Real Estate Agent', 'Property sales agent'),
    ((SELECT id FROM search_domains WHERE slug = 'real-estate'), 'developer', 'Developer', 'Property developer'),
    ((SELECT id FROM search_domains WHERE slug = 'real-estate'), 'investor', 'Investor', 'Real estate investor'),
    ((SELECT id FROM search_domains WHERE slug = 'real-estate'), 'broker', 'Broker', 'Real estate broker')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Law
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'law'), 'lawyer', 'Lawyer', 'Licensed legal practitioner'),
    ((SELECT id FROM search_domains WHERE slug = 'law'), 'legal-consultant', 'Legal Consultant', 'Legal advisory professional'),
    ((SELECT id FROM search_domains WHERE slug = 'law'), 'paralegal', 'Paralegal', 'Paralegal professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Science
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'science'), 'researcher', 'Researcher', 'Scientific researcher'),
    ((SELECT id FROM search_domains WHERE slug = 'science'), 'scientist', 'Scientist', 'Professional scientist'),
    ((SELECT id FROM search_domains WHERE slug = 'science'), 'lab-technician', 'Lab Technician', 'Laboratory technician')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Nonprofit
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'nonprofit'), 'activist', 'Activist', 'Social or environmental activist'),
    ((SELECT id FROM search_domains WHERE slug = 'nonprofit'), 'ngo-worker', 'NGO Worker', 'Nonprofit organization worker'),
    ((SELECT id FROM search_domains WHERE slug = 'nonprofit'), 'volunteer-coordinator', 'Volunteer Coordinator', 'Volunteer management professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Architecture
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'architecture'), 'architect', 'Architect', 'Building or landscape architect'),
    ((SELECT id FROM search_domains WHERE slug = 'architecture'), 'interior-designer', 'Interior Designer', 'Interior design professional'),
    ((SELECT id FROM search_domains WHERE slug = 'architecture'), 'urban-planner', 'Urban Planner', 'City and urban planning professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- Marketing
INSERT INTO search_roles (domain_id, slug, name, description) VALUES
    ((SELECT id FROM search_domains WHERE slug = 'marketing'), 'marketer', 'Marketer', 'Marketing professional'),
    ((SELECT id FROM search_domains WHERE slug = 'marketing'), 'growth-hacker', 'Growth Hacker', 'Growth marketing specialist'),
    ((SELECT id FROM search_domains WHERE slug = 'marketing'), 'brand-strategist', 'Brand Strategist', 'Brand strategy professional'),
    ((SELECT id FROM search_domains WHERE slug = 'marketing'), 'social-media-manager', 'Social Media Manager', 'Social media management professional')
ON CONFLICT (domain_id, slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- SYNONYMS (guitar player → guitarist, etc.)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO search_synonyms (term, canonical, term_type) VALUES
    -- Music synonyms
    ('guitar player', 'guitarist', 'role'),
    ('piano player', 'pianist', 'role'),
    ('drum player', 'drummer', 'role'),
    ('disc jockey', 'dj', 'role'),
    ('music maker', 'producer', 'role'),
    ('vocalist', 'singer', 'role'),

    -- Business synonyms
    ('startup founder', 'founder', 'role'),
    ('company founder', 'founder', 'role'),
    ('business owner', 'entrepreneur', 'role'),
    ('chief executive', 'ceo', 'role'),

    -- Tech synonyms
    ('software developer', 'developer', 'role'),
    ('programmer', 'developer', 'role'),
    ('coder', 'developer', 'role'),
    ('software engineer', 'engineer', 'role'),
    ('ux designer', 'designer', 'role'),
    ('ui designer', 'designer', 'role'),

    -- Journalism synonyms
    ('news reporter', 'reporter', 'role'),
    ('news writer', 'journalist', 'role'),
    ('copywriter', 'writer', 'role'),

    -- Film synonyms
    ('movie maker', 'filmmaker', 'role'),
    ('actor actress', 'actor', 'role'),
    ('cameraman', 'cinematographer', 'role'),
    ('video editor', 'editor', 'role'),

    -- Education synonyms
    ('educator', 'teacher', 'role'),
    ('instructor', 'trainer', 'role'),
    ('tutor teacher', 'tutor', 'role'),

    -- Photography synonyms
    ('photo creator', 'photographer', 'role'),
    ('video creator', 'videographer', 'role'),

    -- Sports synonyms
    ('sports player', 'athlete', 'role'),

    -- Art synonyms
    ('painter', 'artist', 'role'),
    ('drawer', 'illustrator', 'role'),

    -- Food synonyms
    ('cook', 'chef', 'role'),
    ('food blogger', 'food-creator', 'role'),

    -- Marketing synonyms
    ('social media expert', 'social-media-manager', 'role'),
    ('digital marketer', 'marketer', 'role'),

    -- Common tag synonyms
    ('guitars', 'guitar', 'tag'),
    ('pianos', 'piano', 'tag'),
    ('coding', 'programming', 'tag'),
    ('photos', 'photography', 'tag'),
    ('videos', 'video production', 'tag'),
    ('fitness training', 'personal training', 'tag'),
    ('web development', 'web dev', 'tag')
ON CONFLICT (term) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- SUGGESTED TAGS (curated quality tags per role)
-- ──────────────────────────────────────────────────────────────────────────

-- Music → Guitarist
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'electric-guitar', 'Electric Guitar', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'acoustic-guitar', 'Acoustic Guitar', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'bass-guitar', 'Bass Guitar', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'rock', 'Rock', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'metal', 'Metal', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'blues', 'Blues', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'jazz', 'Jazz', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'classical', 'Classical', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'fingerstyle', 'Fingerstyle', TRUE, 65),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'live-performer', 'Live Performer', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'session-musician', 'Session Musician', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'college-fests', 'College Fests', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'cover-artist', 'Cover Artist', TRUE, 65),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'brand-deals', 'Brand Deals', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'interest'), 'linkin-park', 'Linkin Park', TRUE, 50),
    ((SELECT id FROM tag_categories WHERE slug = 'interest'), 'metallica', 'Metallica', TRUE, 50)
ON CONFLICT (slug) DO NOTHING;

-- Music → Producer
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'beat-making', 'Beat Making', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'mixing', 'Mixing', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'mastering', 'Mastering', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'fl-studio', 'FL Studio', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'ableton', 'Ableton', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'logic-pro', 'Logic Pro', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'hip-hop', 'Hip Hop', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'edm', 'EDM', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'lofi', 'Lo-Fi', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'pop', 'Pop', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'collaborations', 'Collaborations', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'brand-deals', 'Brand Deals', TRUE, 70)
ON CONFLICT (slug) DO NOTHING;

-- Business → Founder
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'fundraising', 'Fundraising', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'pitching', 'Pitching', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'team-building', 'Team Building', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'product-development', 'Product Development', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'ai-startups', 'AI Startups', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'saas', 'SaaS', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'ecommerce', 'E-commerce', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'fintech', 'Fintech', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'industry'), 'semiconductors', 'Semiconductors', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'industry'), 'healthcare-tech', 'Healthcare Tech', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'consulting', 'Consulting', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'speaking', 'Speaking', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'partnerships', 'Partnerships', TRUE, 75)
ON CONFLICT (slug) DO NOTHING;

-- Aviation → Pilot
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'boeing-737', 'Boeing 737', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'airbus-a320', 'Airbus A320', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'instrument-rating', 'Instrument Rating', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'commercial-pilot', 'Commercial Pilot', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'flight-instructor', 'Flight Instructor', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'industry'), 'aviation', 'Aviation', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'uae-routes', 'UAE Routes', TRUE, 60),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'us-routes', 'US Routes', TRUE, 60),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'brand-deals', 'Brand Deals', TRUE, 65),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'speaking', 'Speaking', TRUE, 60)
ON CONFLICT (slug) DO NOTHING;

-- Technology → Developer
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'python', 'Python', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'javascript', 'JavaScript', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'rust', 'Rust', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'react', 'React', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'typescript', 'TypeScript', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'sql', 'SQL', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'aws', 'AWS', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'ai-ml', 'AI/ML', TRUE, 85),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'blockchain', 'Blockchain', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'web-development', 'Web Development', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'mobile-development', 'Mobile Development', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'freelance', 'Freelance', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'collaborations', 'Collaborations', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'consulting', 'Consulting', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'remote', 'Remote', TRUE, 90),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'pune', 'Pune', TRUE, 60),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'mumbai', 'Mumbai', TRUE, 60),
    ((SELECT id FROM tag_categories WHERE slug = 'location'), 'bangalore', 'Bangalore', TRUE, 60)
ON CONFLICT (slug) DO NOTHING;

-- Photography → Photographer
INSERT INTO tag_dictionary (category_id, slug, canonical_name, is_suggested, quality_score) VALUES
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'portrait-photography', 'Portrait Photography', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'wedding-photography', 'Wedding Photography', TRUE, 80),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'product-photography', 'Product Photography', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'lightroom', 'Lightroom', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'skill'), 'photoshop', 'Photoshop', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'street-photography', 'Street Photography', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'landscape-photography', 'Landscape Photography', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'specialization'), 'drone-photography', 'Drone Photography', TRUE, 70),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'brand-deals', 'Brand Deals', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'events', 'Events', TRUE, 75),
    ((SELECT id FROM tag_categories WHERE slug = 'opportunity'), 'freelance', 'Freelance', TRUE, 70)
ON CONFLICT (slug) DO NOTHING;

-- Update role counts
UPDATE search_domains SET role_count = (
    SELECT COUNT(DISTINCT id) FROM search_roles WHERE search_roles.domain_id = search_domains.id
);
