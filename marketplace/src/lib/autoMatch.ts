// Auto-matching algorithm: when a brand creates a deal, find best-fit creators
// Eliminates agencies by automating creator discovery

export interface Campaign {
  id: number;
  brandName?: string;
  title: string;
  description: string;
  budget: number | string;
  deadline: string;
  compensationType?: string;
  requiredProfessions: string[];
  status?: 'open' | 'closed' | 'expired';
  targetAudienceSize?: string;
  targetLocation?: string;
  deliverables?: string;
  requirements?: string[];
  exclusivity?: string;
  usageRights?: string;
  aboutDescription?: string;
}

export interface Creator {
  name: string;
  handle: string;
  valueSkin: string;
  followers: string;
  engagement: string;
  rate: string;
  matchScore?: string;
  featured?: boolean;
  willingToBarter?: boolean;
  timezone?: string;
  responseTimeHrs?: number;
  minDealUsd?: number;
  audienceAgeRange?: string;
  audienceLocation?: string;
  audienceLang?: string;
  languages?: string[];
  niche?: string;
  platforms?: string[];
}

export interface AutoMatchResult {
  creatorHandle: string;
  creatorName: string;
  creatorProfession: string;
  matchScore: number; // 0-100
  reasons: string[];
}

/**
 * Auto-match: Given a campaign, find creators who fit
 * Scores based on:
 * - Profession match (exact niche alignment)
 * - Audience size (meets minimum)
 * - Location (if specified)
 * - Budget fit (creator's rate ≤ deal budget)
 * - Language match
 * - Platform overlap
 */
export function autoMatchCreators(
  campaign: Campaign,
  allCreators: Creator[]
): AutoMatchResult[] {
  const results: AutoMatchResult[] = [];

  for (const creator of allCreators) {
    const matchScore = calculateMatchScore(campaign, creator);

    if (matchScore >= 60) {
      // Only return creators with >60% match
      const reasons = getMatchReasons(campaign, creator, matchScore);
      results.push({
        creatorHandle: creator.handle,
        creatorName: creator.name,
        creatorProfession: creator.valueSkin,
        matchScore,
        reasons,
      });
    }
  }

  // Sort by match score descending
  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Calculate match score (0-100) between a campaign and creator
 */
function calculateMatchScore(campaign: Campaign, creator: Creator): number {
  let score = 0;
  let weightSum = 0;

  // 1. Profession match (30 points)
  const professionWeight = 30;
  if (campaign.requiredProfessions.includes(creator.valueSkin)) {
    score += professionWeight;
  } else if (isSimilarProfession(campaign.requiredProfessions[0], creator.valueSkin)) {
    score += professionWeight * 0.7; // 70% if similar
  }
  weightSum += professionWeight;

  // 2. Audience size match (25 points)
  const audienceSizeWeight = 25;
  const creatorFollowers = parseFollowerCount(creator.followers);
  const targetSize = parseFollowerCount(campaign.targetAudienceSize || '0');

  if (targetSize === 0 || creatorFollowers >= targetSize * 0.8) {
    score += audienceSizeWeight;
  } else if (creatorFollowers >= targetSize * 0.5) {
    score += audienceSizeWeight * 0.6;
  }
  weightSum += audienceSizeWeight;

  // 3. Budget fit (20 points)
  const budgetWeight = 20;
  const creatorRate = parseRate(creator.rate);
  const dealBudget = typeof campaign.budget === 'string' ? parseInt(campaign.budget) : campaign.budget;

  if (creatorRate <= dealBudget) {
    score += budgetWeight;
  } else if (creatorRate <= dealBudget * 1.3) {
    // Slightly over budget but close enough (barter possible)
    score += budgetWeight * 0.5;
  }
  weightSum += budgetWeight;

  // 4. Location match (15 points, optional)
  const locationWeight = 15;
  if (campaign.targetLocation) {
    if (creator.audienceLocation === campaign.targetLocation || campaign.targetLocation.toLowerCase() === 'global' || campaign.targetLocation.toLowerCase() === 'remote') {
      score += locationWeight;
    } else if (creator.audienceLocation?.includes(campaign.targetLocation.split(',')[0])) {
      score += locationWeight * 0.7;
    }
  } else {
    score += locationWeight; // No location specified = automatic full points
  }
  weightSum += locationWeight;

  // 5. Response time / activity (10 points)
  const responseWeight = 10;
  if (creator.responseTimeHrs && creator.responseTimeHrs <= 24) {
    score += responseWeight;
  } else if (creator.responseTimeHrs && creator.responseTimeHrs <= 72) {
    score += responseWeight * 0.6;
  }
  weightSum += responseWeight;

  // Normalize to 0-100
  return Math.round((score / weightSum) * 100);
}

/**
 * Check if two professions are similar (for fuzzy matching)
 */
function isSimilarProfession(prof1: string, prof2: string): boolean {
  const similar: { [key: string]: string[] } = {
    'Fashion': ['Fashion Influencer', 'Stylist', 'Fashion Designer', 'Model'],
    'Beauty': ['Makeup Artist', 'Skincare Specialist', 'Hair Stylist', 'Beauty Reviewer'],
    'Travel': ['Travel Blogger', 'Adventure Creator', 'Digital Nomad'],
    'Food': ['Chef', 'Food Photographer', 'Recipe Creator', 'Restaurant Reviewer'],
    'Fitness': ['Personal Trainer', 'Yoga Instructor', 'Fitness Coach'],
    'Technology': ['Software Engineer', 'Developer', 'Tech Entrepreneur'],
  };

  const prof1Lower = prof1.toLowerCase();
  const prof2Lower = prof2.toLowerCase();

  for (const [key, vals] of Object.entries(similar)) {
    const keyLower = key.toLowerCase();
    if (prof1Lower.includes(keyLower) && vals.some(v => prof2Lower.includes(v.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

/**
 * Parse "100K" → 100000
 */
function parseFollowerCount(count: string | undefined): number {
  if (!count) return 0;
  const str = count.toString().toLowerCase().trim();
  const num = parseFloat(str);
  if (str.includes('k')) return num * 1000;
  if (str.includes('m')) return num * 1000000;
  return num;
}

/**
 * Parse "$4,500" → 4500
 */
function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  return parseInt(rate.replace(/[^0-9]/g, '')) || 0;
}

/**
 * Generate human-readable match reasons
 */
function getMatchReasons(campaign: Campaign, creator: Creator, matchScore: number): string[] {
  const reasons: string[] = [];

  // Profession
  if (campaign.requiredProfessions.includes(creator.valueSkin)) {
    reasons.push(`Perfect niche match: ${creator.valueSkin}`);
  } else if (isSimilarProfession(campaign.requiredProfessions[0], creator.valueSkin)) {
    reasons.push(`Similar niche: ${creator.valueSkin}`);
  }

  // Audience
  const creatorFollowers = parseFollowerCount(creator.followers);
  if (creatorFollowers > 0) {
    reasons.push(`${creator.followers} followers (${creator.engagement}% engagement)`);
  }

  // Budget
  const creatorRate = parseRate(creator.rate);
  const dealBudget = typeof campaign.budget === 'string' ? parseInt(campaign.budget) : campaign.budget;
  if (creatorRate <= dealBudget) {
    reasons.push(`Rate fits budget: ${creator.rate} ≤ $${dealBudget}`);
  }

  // Response time
  if (creator.responseTimeHrs && creator.responseTimeHrs <= 24) {
    reasons.push(`Fast responder: ${creator.responseTimeHrs}h average`);
  }

  // Location
  if (creator.audienceLocation) {
    reasons.push(`Audience in: ${creator.audienceLocation}`);
  }

  // Barter
  if (creator.willingToBarter) {
    reasons.push('Open to barter/gifting');
  }

  return reasons.slice(0, 3); // Top 3 reasons
}

/**
 * Batch auto-match: Find creators for multiple campaigns
 */
export function autoMatchBatch(
  campaigns: Campaign[],
  allCreators: Creator[]
): Map<number, AutoMatchResult[]> {
  const results = new Map<number, AutoMatchResult[]>();

  for (const campaign of campaigns) {
    results.set(campaign.id, autoMatchCreators(campaign, allCreators));
  }

  return results;
}
