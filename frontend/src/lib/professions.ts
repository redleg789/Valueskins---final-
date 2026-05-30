/*
 * PROFESSION EXPANSION SYSTEM
 * ──────────────────────────────────────────────────────────────────────────
 * This database includes 45+ specific professions across 8 categories.
 * The system supports:
 * 1. AI-driven trending detection (mock: based on request_count)
 * 2. User submission + admin approval workflow
 * 3. Platform-specific profession availability (e.g., SDE roles favor LinkedIn/Meta)
 *
 * PATENT ANGLE: Profession tagging system allows creators to self-categorize
 * with fine-grained specificity (SDE2 vs SDE1 vs Staff vs Principal), which
 * directly weights the AI matching algorithm's category_affinity score.
 * A creator's chosen profession (SDE2) is NOT just identity—it's an ML input.
 */

export type Platform = 'meta' | 'linkedin' | 'youtube' | 'across';

export interface Profession {
  id: string;
  name: string;
  category: 'Tech' | 'Art' | 'Law' | 'Medical' | 'Gaming' | 'Finance' | 'Fitness' | 'Content';
  description: string;
  icon: string; // emoji placeholder, can be replaced with SVG
  gradientFrom: string;
  gradientTo: string;
  platforms: Platform[];
  trending?: boolean;
  request_count?: number;
  estimated_avg_deal?: number;
  active_brands?: number;
  nested?: boolean; // for hierarchical professions like SDE1/2/3
}

const PROFESSIONS: Profession[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // TECH CATEGORY (18 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'sde1',
    name: 'SDE Level 1',
    category: 'Tech',
    description: 'Junior Software Engineer (0-2 years)',
    icon: '💻',
    gradientFrom: '#0095f6',
    gradientTo: '#1f51ba',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 234,
    estimated_avg_deal: 1500,
    active_brands: 12,
  },
  {
    id: 'sde2',
    name: 'SDE Level 2',
    category: 'Tech',
    description: 'Mid-Level Software Engineer (2-5 years)',
    icon: '💻',
    gradientFrom: '#0095f6',
    gradientTo: '#1f51ba',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 456,
    estimated_avg_deal: 2500,
    active_brands: 24,
    trending: true,
  },
  {
    id: 'sde3',
    name: 'SDE Level 3',
    category: 'Tech',
    description: 'Senior Software Engineer (5+ years)',
    icon: '💻',
    gradientFrom: '#0095f6',
    gradientTo: '#1f51ba',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 312,
    estimated_avg_deal: 4000,
    active_brands: 18,
  },
  {
    id: 'staff-eng',
    name: 'Staff Engineer',
    category: 'Tech',
    description: 'Staff / Principal Engineer (10+ years)',
    icon: '💻',
    gradientFrom: '#0095f6',
    gradientTo: '#1f51ba',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 89,
    estimated_avg_deal: 6000,
    active_brands: 8,
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    category: 'Tech',
    description: 'Product Manager / APM',
    icon: '📊',
    gradientFrom: '#00d4ff',
    gradientTo: '#0095f6',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 178,
    estimated_avg_deal: 2800,
    active_brands: 14,
  },
  {
    id: 'designer-ux',
    name: 'UX/Product Designer',
    category: 'Tech',
    description: 'UX Designer / Product Designer',
    icon: '🎨',
    gradientFrom: '#ff6b35',
    gradientTo: '#ff4500',
    platforms: ['meta', 'linkedin', 'youtube', 'across'],
    request_count: 267,
    estimated_avg_deal: 2200,
    active_brands: 16,
    trending: true,
  },
  {
    id: 'frontend-eng',
    name: 'Frontend Engineer',
    category: 'Tech',
    description: 'Frontend / React / Vue Engineer',
    icon: '⚛️',
    gradientFrom: '#61dafb',
    gradientTo: '#0095f6',
    platforms: ['meta', 'linkedin', 'youtube', 'across'],
    request_count: 345,
    estimated_avg_deal: 2100,
    active_brands: 20,
  },
  {
    id: 'ml-engineer',
    name: 'ML Engineer',
    category: 'Tech',
    description: 'Machine Learning / AI Engineer',
    icon: '🧠',
    gradientFrom: '#8b5cf6',
    gradientTo: '#ec4899',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 423,
    estimated_avg_deal: 3500,
    active_brands: 22,
    trending: true,
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    category: 'Tech',
    description: 'Data Scientist / Analytics',
    icon: '📈',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 198,
    estimated_avg_deal: 2600,
    active_brands: 13,
  },
  {
    id: 'devops-eng',
    name: 'DevOps Engineer',
    category: 'Tech',
    description: 'DevOps / Infrastructure Engineer',
    icon: '🔧',
    gradientFrom: '#f59e0b',
    gradientTo: '#f97316',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 145,
    estimated_avg_deal: 2400,
    active_brands: 10,
  },
  {
    id: 'qa-engineer',
    name: 'QA Engineer',
    category: 'Tech',
    description: 'QA Engineer / SDET',
    icon: '✅',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 112,
    estimated_avg_deal: 1800,
    active_brands: 9,
  },
  {
    id: 'tech-lead',
    name: 'Tech Lead',
    category: 'Tech',
    description: 'Engineering Manager / Tech Lead',
    icon: '👔',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 156,
    estimated_avg_deal: 3200,
    active_brands: 12,
  },
  {
    id: 'security-eng',
    name: 'Security Engineer',
    category: 'Tech',
    description: 'Security / AppSec Engineer',
    icon: '🔐',
    gradientFrom: '#ef4444',
    gradientTo: '#dc2626',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 134,
    estimated_avg_deal: 2900,
    active_brands: 11,
  },
  {
    id: 'blockchain-dev',
    name: 'Blockchain Developer',
    category: 'Tech',
    description: 'Solidity / Web3 Developer',
    icon: '⛓️',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 289,
    estimated_avg_deal: 3800,
    active_brands: 17,
    trending: true,
  },
  {
    id: 'data-eng',
    name: 'Data Engineer',
    category: 'Tech',
    description: 'Data / ETL Engineer',
    icon: '🗄️',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 201,
    estimated_avg_deal: 2700,
    active_brands: 14,
  },
  {
    id: 'solutions-arch',
    name: 'Solutions Architect',
    category: 'Tech',
    description: 'Solutions Architect / Cloud Architect',
    icon: '🏗️',
    gradientFrom: '#0095f6',
    gradientTo: '#1f51ba',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 143,
    estimated_avg_deal: 3100,
    active_brands: 11,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // LAW CATEGORY (8 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'law-intern',
    name: 'Law Intern',
    category: 'Law',
    description: 'Law Intern / Summer Associate',
    icon: '⚖️',
    gradientFrom: '#7c3aed',
    gradientTo: '#6366f1',
    platforms: ['linkedin', 'across'],
    request_count: 78,
    estimated_avg_deal: 800,
    active_brands: 4,
  },
  {
    id: 'junior-attorney',
    name: 'Junior Attorney',
    category: 'Law',
    description: 'Associate Attorney (0-3 years)',
    icon: '⚖️',
    gradientFrom: '#7c3aed',
    gradientTo: '#6366f1',
    platforms: ['linkedin', 'across'],
    request_count: 134,
    estimated_avg_deal: 2000,
    active_brands: 7,
  },
  {
    id: 'criminal-law',
    name: 'Criminal Law Attorney',
    category: 'Law',
    description: 'Criminal Defense / Prosecution',
    icon: '⚖️',
    gradientFrom: '#dc2626',
    gradientTo: '#991b1b',
    platforms: ['linkedin', 'across'],
    request_count: 156,
    estimated_avg_deal: 2400,
    active_brands: 9,
    trending: true,
  },
  {
    id: 'corporate-law',
    name: 'Corporate Attorney',
    category: 'Law',
    description: 'Corporate / M&A Lawyer',
    icon: '⚖️',
    gradientFrom: '#1e40af',
    gradientTo: '#1e3a8a',
    platforms: ['linkedin', 'across'],
    request_count: 189,
    estimated_avg_deal: 3500,
    active_brands: 12,
  },
  {
    id: 'ip-attorney',
    name: 'IP Attorney',
    category: 'Law',
    description: 'Intellectual Property / Patent Lawyer',
    icon: '⚖️',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['linkedin', 'across'],
    request_count: 167,
    estimated_avg_deal: 3100,
    active_brands: 10,
  },
  {
    id: 'employment-law',
    name: 'Employment Law Attorney',
    category: 'Law',
    description: 'Labor / Employment Law',
    icon: '⚖️',
    gradientFrom: '#10b981',
    gradientTo: '#047857',
    platforms: ['linkedin', 'across'],
    request_count: 123,
    estimated_avg_deal: 2200,
    active_brands: 8,
  },
  {
    id: 'tax-attorney',
    name: 'Tax Attorney',
    category: 'Law',
    description: 'Tax Law Specialist',
    icon: '⚖️',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['linkedin', 'across'],
    request_count: 145,
    estimated_avg_deal: 2800,
    active_brands: 9,
  },
  {
    id: 'litigation-attorney',
    name: 'Litigation Attorney',
    category: 'Law',
    description: 'Civil Litigation Lawyer',
    icon: '⚖️',
    gradientFrom: '#dc2626',
    gradientTo: '#7f1d1d',
    platforms: ['linkedin', 'across'],
    request_count: 134,
    estimated_avg_deal: 2600,
    active_brands: 8,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // MEDICAL CATEGORY (6 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'med-student',
    name: 'Medical Student',
    category: 'Medical',
    description: 'Medical / Nursing Student',
    icon: '🩺',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 167,
    estimated_avg_deal: 1000,
    active_brands: 6,
  },
  {
    id: 'resident-doctor',
    name: 'Resident Doctor',
    category: 'Medical',
    description: 'Medical Resident / Fellow',
    icon: '🩺',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 178,
    estimated_avg_deal: 1800,
    active_brands: 7,
  },
  {
    id: 'attending-physician',
    name: 'Attending Physician',
    category: 'Medical',
    description: 'Attending Doctor / Specialist',
    icon: '🩺',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 145,
    estimated_avg_deal: 3200,
    active_brands: 8,
  },
  {
    id: 'nurse-practitioner',
    name: 'Nurse Practitioner',
    category: 'Medical',
    description: 'NP / Registered Nurse',
    icon: '⚕️',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 134,
    estimated_avg_deal: 1600,
    active_brands: 6,
  },
  {
    id: 'dentist',
    name: 'Dentist',
    category: 'Medical',
    description: 'Dental Professional / Orthodontist',
    icon: '🦷',
    gradientFrom: '#f0f9ff',
    gradientTo: '#e0f2fe',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 112,
    estimated_avg_deal: 2200,
    active_brands: 5,
  },
  {
    id: 'therapist-counselor',
    name: 'Therapist / Counselor',
    category: 'Medical',
    description: 'Psychologist / Mental Health Professional',
    icon: '🧠',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 189,
    estimated_avg_deal: 2000,
    active_brands: 9,
    trending: true,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // FINANCE CATEGORY (6 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'analyst-junior',
    name: 'Financial Analyst',
    category: 'Finance',
    description: 'Junior / Senior Financial Analyst',
    icon: '💰',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    platforms: ['meta', 'linkedin', 'across'],
    request_count: 201,
    estimated_avg_deal: 1900,
    active_brands: 11,
  },
  {
    id: 'investment-banker',
    name: 'Investment Banker',
    category: 'Finance',
    description: 'I-Banking / M&A Advisor',
    icon: '💼',
    gradientFrom: '#1e40af',
    gradientTo: '#1e3a8a',
    platforms: ['linkedin', 'across'],
    request_count: 167,
    estimated_avg_deal: 4000,
    active_brands: 9,
  },
  {
    id: 'trader',
    name: 'Trader',
    category: 'Finance',
    description: 'Equity / Options / Crypto Trader',
    icon: '📈',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['meta', 'linkedin', 'youtube', 'across'],
    request_count: 234,
    estimated_avg_deal: 3100,
    active_brands: 13,
    trending: true,
  },
  {
    id: 'accountant-cpa',
    name: 'CPA / Accountant',
    category: 'Finance',
    description: 'Certified Public Accountant',
    icon: '📊',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['linkedin', 'across'],
    request_count: 145,
    estimated_avg_deal: 2000,
    active_brands: 8,
  },
  {
    id: 'financial-advisor',
    name: 'Financial Advisor',
    category: 'Finance',
    description: 'Wealth / Investment Advisor',
    icon: '💎',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['meta', 'linkedin', 'youtube', 'across'],
    request_count: 178,
    estimated_avg_deal: 2800,
    active_brands: 10,
  },
  {
    id: 'economist',
    name: 'Economist',
    category: 'Finance',
    description: 'Economic Researcher / Analyst',
    icon: '📉',
    gradientFrom: '#7c3aed',
    gradientTo: '#6366f1',
    platforms: ['linkedin', 'across'],
    request_count: 123,
    estimated_avg_deal: 2400,
    active_brands: 7,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // FITNESS CATEGORY (5 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'personal-trainer',
    name: 'Personal Trainer',
    category: 'Fitness',
    description: 'Certified Personal Trainer',
    icon: '💪',
    gradientFrom: '#ef4444',
    gradientTo: '#dc2626',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 267,
    estimated_avg_deal: 1200,
    active_brands: 14,
  },
  {
    id: 'nutrition-coach',
    name: 'Nutrition Coach',
    category: 'Fitness',
    description: 'Registered Dietitian / Nutritionist',
    icon: '🥗',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 198,
    estimated_avg_deal: 1400,
    active_brands: 10,
    trending: true,
  },
  {
    id: 'fitness-instructor',
    name: 'Group Fitness Instructor',
    category: 'Fitness',
    description: 'Yoga / Pilates / HIIT Instructor',
    icon: '🧘',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 212,
    estimated_avg_deal: 800,
    active_brands: 11,
  },
  {
    id: 'strength-coach',
    name: 'Strength & Conditioning Coach',
    category: 'Fitness',
    description: 'S&C Coach / Athletic Coach',
    icon: '⚡',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 167,
    estimated_avg_deal: 2000,
    active_brands: 9,
  },
  {
    id: 'sports-medicine',
    name: 'Sports Medicine Doctor',
    category: 'Fitness',
    description: 'Sports Medicine Physician',
    icon: '🏥',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['linkedin', 'youtube', 'across'],
    request_count: 89,
    estimated_avg_deal: 2800,
    active_brands: 6,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // ART CATEGORY (4 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'graphic-designer',
    name: 'Graphic Designer',
    category: 'Art',
    description: 'Visual / Graphic Designer',
    icon: '🎨',
    gradientFrom: '#ff6b35',
    gradientTo: '#ff4500',
    platforms: ['meta', 'linkedin', 'youtube', 'across'],
    request_count: 289,
    estimated_avg_deal: 1600,
    active_brands: 15,
  },
  {
    id: 'motion-designer',
    name: 'Motion Designer',
    category: 'Art',
    description: 'Animation / Motion Graphics Designer',
    icon: '🎬',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 234,
    estimated_avg_deal: 2300,
    active_brands: 12,
    trending: true,
  },
  {
    id: 'illustrator',
    name: 'Illustrator',
    category: 'Art',
    description: 'Digital / Traditional Illustrator',
    icon: '🖌️',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 156,
    estimated_avg_deal: 1800,
    active_brands: 9,
  },
  {
    id: '3d-artist',
    name: '3D Artist',
    category: 'Art',
    description: '3D Modeler / VFX Artist',
    icon: '🎯',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 167,
    estimated_avg_deal: 2700,
    active_brands: 10,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // GAMING CATEGORY (3 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'game-developer',
    name: 'Game Developer',
    category: 'Gaming',
    description: 'Game Engine / Engine Developer',
    icon: '🎮',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 178,
    estimated_avg_deal: 2600,
    active_brands: 10,
  },
  {
    id: 'esports-pro',
    name: 'Esports Pro',
    category: 'Gaming',
    description: 'Competitive / Tournament Player',
    icon: '🏆',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 245,
    estimated_avg_deal: 3200,
    active_brands: 13,
    trending: true,
  },
  {
    id: 'game-streamer',
    name: 'Game Streamer',
    category: 'Gaming',
    description: 'Twitch / YouTube Gaming Streamer',
    icon: '📹',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['youtube', 'across'],
    request_count: 312,
    estimated_avg_deal: 2800,
    active_brands: 16,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // CONTENT CATEGORY (4 professions)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'content-creator',
    name: 'Content Creator',
    category: 'Content',
    description: 'General Content Creator / Influencer',
    icon: '📱',
    gradientFrom: '#ec4899',
    gradientTo: '#be184d',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 512,
    estimated_avg_deal: 2000,
    active_brands: 28,
    trending: true,
  },
  {
    id: 'educational-creator',
    name: 'Educational Creator',
    category: 'Content',
    description: 'Educator / Tutorial / Course Creator',
    icon: '📚',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 267,
    estimated_avg_deal: 1800,
    active_brands: 14,
  },
  {
    id: 'podcast-creator',
    name: 'Podcast Host',
    category: 'Content',
    description: 'Podcast Producer / Host',
    icon: '🎙️',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6366f1',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 201,
    estimated_avg_deal: 2400,
    active_brands: 11,
  },
  {
    id: 'video-creator',
    name: 'Video Creator',
    category: 'Content',
    description: 'YouTuber / TikTok / Shorts Creator',
    icon: '🎬',
    gradientFrom: '#ef4444',
    gradientTo: '#dc2626',
    platforms: ['meta', 'youtube', 'across'],
    request_count: 445,
    estimated_avg_deal: 2200,
    active_brands: 22,
    trending: true,
  },
];

// ═════════════════════════════════════════════════════════════════════════
// PLATFORM CONFIGURATIONS
// ═════════════════════════════════════════════════════════════════════════

export interface PlatformConfig {
  id: Platform;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  logoEmoji: string;
  themes: {
    bg: string;
    card: string;
    separator: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accentColor: string;
  };
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  meta: {
    id: 'meta',
    name: 'Meta Platforms',
    description: 'Reach creators across Instagram & Threads',
    primaryColor: '#0a66c2',
    secondaryColor: '#0a66c2',
    logoEmoji: '👥',
    themes: {
      bg: '#000000',
      card: '#1a1a1a',
      separator: '#262626',
      textPrimary: '#f5f5f5',
      textSecondary: '#b0b0b0',
      textTertiary: '#737373',
      accentColor: '#0a66c2',
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Connect with professionals & B2B creators',
    primaryColor: '#0a66c2',
    secondaryColor: '#004182',
    logoEmoji: '💼',
    themes: {
      bg: '#ffffff',
      card: '#f3f2ef',
      separator: '#e5e5e1',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textTertiary: '#8a8d91',
      accentColor: '#0a66c2',
    },
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    description: 'Grow your audience on video platform',
    primaryColor: '#ff0000',
    secondaryColor: '#cc0000',
    logoEmoji: '📺',
    themes: {
      bg: '#000000',
      card: '#1a1a1a',
      separator: '#262626',
      textPrimary: '#f5f5f5',
      textSecondary: '#b0b0b0',
      textTertiary: '#737373',
      accentColor: '#ff0000',
    },
  },
  across: {
    id: 'across',
    name: 'Across All Platforms',
    description: 'Sell your persona across Meta, LinkedIn & YouTube',
    primaryColor: '#8b5cf6',
    secondaryColor: '#6366f1',
    logoEmoji: '🌐',
    themes: {
      bg: '#000000',
      card: '#1a1a1a',
      separator: '#262626',
      textPrimary: '#f5f5f5',
      textSecondary: '#b0b0b0',
      textTertiary: '#737373',
      accentColor: '#8b5cf6',
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Get all professions for a given platform
 */
export function getProfessionsByPlatform(platform: Platform): Profession[] {
  if (platform === 'across') return PROFESSIONS;
  return PROFESSIONS.filter(p => p.platforms.includes(platform));
}

/**
 * Get trending professions (AI-scanned, user-requested, high-demand)
 */
export function getTrendingProfessions(limit: number = 5): Profession[] {
  return PROFESSIONS.filter(p => p.trending).slice(0, limit);
}

/**
 * Get professions by category
 */
export function getProfessionsByCategory(category: Profession['category'], platform?: Platform): Profession[] {
  let filtered = PROFESSIONS.filter(p => p.category === category);
  if (platform && platform !== 'across') {
    filtered = filtered.filter(p => p.platforms.includes(platform));
  }
  return filtered;
}

/**
 * Get a single profession by ID
 */
export function getProfessionById(id: string): Profession | undefined {
  return PROFESSIONS.find(p => p.id === id);
}

/**
 * Randomize profession ordering for carousel/feed
 */
export function shuffleProfessions(professions: Profession[]): Profession[] {
  return [...professions].sort(() => Math.random() - 0.5);
}

export default PROFESSIONS;
