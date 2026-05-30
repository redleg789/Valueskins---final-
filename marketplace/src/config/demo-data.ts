// Centralized demo/mock data configuration
// All hardcoded values should be defined here, not scattered throughout components

export const DEMO_CREATOR_CATEGORIES = {
  'Tech': {
    name: 'Tech',
    subProfessions: ['Software Engineer', 'Full Stack Developer', 'Data Scientist', 'Product Manager', 'DevOps Engineer', 'UX/UI Designer', 'Tech Entrepreneur', 'AI/ML Specialist']
  },
  'Fashion': {
    name: 'Fashion',
    subProfessions: ['Fashion Influencer', 'Stylist', 'Fashion Designer', 'Model', 'Personal Shopper', 'Fashion Photographer', 'Streetwear Creator', 'Sustainable Fashion Advocate']
  },
  'Beauty': {
    name: 'Beauty',
    subProfessions: ['Makeup Artist', 'Skincare Specialist', 'Hair Stylist', 'Nail Artist', 'Beauty Reviewer', 'Fragrance Enthusiast', 'Esthetician', 'Beauty Educator']
  },
  'Travel': {
    name: 'Travel',
    subProfessions: ['Travel Blogger', 'Adventure Creator', 'Luxury Travel', 'Budget Travel', 'Solo Travel', 'Travel Photographer', 'Digital Nomad', 'Hotel Reviewer']
  },
  'Food & Beverage': {
    name: 'Food & Beverage',
    subProfessions: ['Chef', 'Food Photographer', 'Recipe Creator', 'Restaurant Reviewer', 'Pastry Chef', 'Nutritionist', 'Food Stylist', 'Culinary Student']
  },
  'Fitness': {
    name: 'Fitness',
    subProfessions: ['Personal Trainer', 'Yoga Instructor', 'Fitness Coach', 'CrossFit Athlete', 'Pilates Instructor', 'Bodybuilder', 'Marathon Runner', 'Sports Nutritionist']
  },
  'Lifestyle': {
    name: 'Lifestyle',
    subProfessions: ['Lifestyle Blogger', 'Minimalist', 'Wellness Coach', 'Self-Care Advocate', 'Productivity Creator', 'Journal Creator', 'Morning Routine Creator', 'Slow Living Advocate']
  },
  'Photography': {
    name: 'Photography',
    subProfessions: ['Portrait Photographer', 'Street Photographer', 'Landscape Photographer', 'Product Photographer', 'Wedding Photographer', 'Drone Photographer', 'Photo Editor', 'Analog Film Creator']
  },
  'Interior Design': {
    name: 'Interior Design',
    subProfessions: ['Interior Designer', 'Home Decor Creator', 'DIY Home', 'Minimalist Home', 'Plant Parent', 'Organization Expert', 'Furniture Designer', 'Renovation Creator']
  },
  'Entertainment': {
    name: 'Entertainment',
    subProfessions: ['Actor', 'Comedian', 'Musician', 'Producer', 'Director', 'Screenwriter', 'Animator', 'Voice Actor', 'Podcast Host', 'DJ', 'Streamer', 'Stunt Performer']
  },
  'Sports': {
    name: 'Sports',
    subProfessions: ['Professional Athlete', 'Fitness Coach', 'Sports Coach', 'Yoga Instructor', 'Nutritionist', 'Sports Analyst', 'Personal Trainer', 'Physical Therapist']
  },
  'Business': {
    name: 'Business',
    subProfessions: ['CEO', 'Entrepreneur', 'Consultant', 'Sales Manager', 'HR Manager', 'Operations Manager', 'Marketing Manager', 'Business Analyst']
  }
};

export const DEMO_BRAND_CATEGORIES = {
  'Industry': {
    name: 'Industry',
    subCategories: ['Technology', 'Fashion', 'Beauty', 'Health & Wellness', 'Food & Beverage', 'Travel', 'Finance', 'Education']
  },
  'Company Size': {
    name: 'Company Size',
    subCategories: ['Startup', 'SMB', 'Mid-Market', 'Enterprise', 'Agency', 'Solo Brand']
  },
  'Campaign Type': {
    name: 'Campaign Type',
    subCategories: ['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage', 'Affiliate', 'UGC']
  },
  'Budget Tier': {
    name: 'Budget Tier',
    subCategories: ['Micro ($500-2K)', 'Standard ($2K-10K)', 'Premium ($10K-50K)', 'Enterprise ($50K+)']
  }
};

export const DEMO_SKILL_TAGS = [
  'React', 'Node.js', 'TypeScript', 'Python', 'JavaScript',
  'Figma', 'Adobe CC', 'Prototyping', 'User Research',
  'Content Creation', 'Video Editing', 'Photography',
  'Social Media', 'SEO', 'Analytics', 'Marketing'
];

export const DEMO_COLORS = {
  primary: '#0066CC',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#38bdf8',
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1'
};

export const DEMO_LIMITS = {
  maxCreatorsPerBulk: 100,
  maxDealAmount: 100000,
  minDealAmount: 100,
  exclusivityWindowDays: 30,
  maxRevisions: 3,
  maxPortfolioItems: 10
};
