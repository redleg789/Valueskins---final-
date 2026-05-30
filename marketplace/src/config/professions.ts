export const PROFESSIONS = {
  'Fashion': {
    name: 'Fashion',
    subProfessions: ['Fashion Influencer', 'Stylist', 'Fashion Designer', 'Model', 'Personal Shopper', 'Fashion Photographer', 'Streetwear Creator', 'Sustainable Fashion Advocate'],
  },
  'Beauty': {
    name: 'Beauty',
    subProfessions: ['Makeup Artist', 'Skincare Specialist', 'Hair Stylist', 'Nail Artist', 'Beauty Reviewer', 'Fragrance Enthusiast', 'Esthetician', 'Beauty Educator'],
  },
  'Travel': {
    name: 'Travel',
    subProfessions: ['Travel Blogger', 'Adventure Creator', 'Luxury Travel', 'Budget Travel', 'Solo Travel', 'Travel Photographer', 'Digital Nomad', 'Hotel Reviewer'],
  },
  'Food & Beverage': {
    name: 'Food & Beverage',
    subProfessions: ['Chef', 'Food Photographer', 'Recipe Creator', 'Restaurant Reviewer', 'Pastry Chef', 'Nutritionist', 'Food Stylist', 'Culinary Student'],
  },
  'Fitness': {
    name: 'Fitness',
    subProfessions: ['Personal Trainer', 'Yoga Instructor', 'Fitness Coach', 'CrossFit Athlete', 'Pilates Instructor', 'Bodybuilder', 'Marathon Runner', 'Sports Nutritionist'],
  },
  'Lifestyle': {
    name: 'Lifestyle',
    subProfessions: ['Lifestyle Blogger', 'Minimalist', 'Wellness Coach', 'Self-Care Advocate', 'Productivity Creator', 'Journal Creator', 'Morning Routine Creator', 'Slow Living Advocate'],
  },
  'Photography': {
    name: 'Photography',
    subProfessions: ['Portrait Photographer', 'Street Photographer', 'Landscape Photographer', 'Product Photographer', 'Wedding Photographer', 'Drone Photographer', 'Photo Editor', 'Analog Film Creator'],
  },
  'Interior Design': {
    name: 'Interior Design',
    subProfessions: ['Interior Designer', 'Home Decor Creator', 'DIY Home', 'Minimalist Home', 'Plant Parent', 'Organization Expert', 'Furniture Designer', 'Renovation Creator'],
  },
  'Technology': {
    name: 'Technology',
    subProfessions: ['Software Engineer', 'Full Stack Developer', 'Data Scientist', 'Product Manager', 'DevOps Engineer', 'UX/UI Designer', 'Tech Entrepreneur', 'AI/ML Specialist'],
  },
  'Entertainment': {
    name: 'Entertainment',
    subProfessions: ['Actor', 'Comedian', 'Musician', 'Producer', 'Director', 'Screenwriter', 'Animator', 'Voice Actor', 'Podcast Host', 'DJ', 'Streamer', 'Stunt Performer'],
  },
  'Sports': {
    name: 'Sports',
    subProfessions: ['Professional Athlete', 'Fitness Coach', 'Sports Coach', 'Yoga Instructor', 'Nutritionist', 'Sports Analyst', 'Personal Trainer', 'Physical Therapist'],
  },
  'Business': {
    name: 'Business',
    subProfessions: ['CEO', 'Entrepreneur', 'Consultant', 'Sales Manager', 'HR Manager', 'Operations Manager', 'Marketing Manager', 'Business Analyst'],
  },
};

export function getProfessionCategories() {
  return Object.values(PROFESSIONS).map(prof => ({
    id: prof.name,
    name: prof.name,
    subProfessions: prof.subProfessions,
  }));
}
