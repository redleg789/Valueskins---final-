export interface UserInterest {
  hashtag: string;
  weight: number;
  lastUpdate: string;
}

export interface CreatorAffinity {
  creatorId: string;
  score: number;
  lastInteraction: string;
}

export interface FeedScore {
  postId: string;
  score: number;
  factors: {
    recency: number;
    contentMatch: number;
    creatorAffinity: number;
    engagement: number;
    virality: number;
  };
}

export interface UserProfile {
  userId: string;
  interests: UserInterest[];
  affinities: CreatorAffinity[];
  savedPosts: string[];
  likedPosts: string[];
  followedCreators: string[];
}

const DEFAULT_INTEREST_WEIGHTS = {
  recency: 25,
  contentMatch: 30,
  creatorAffinity: 20,
  engagement: 15,
  virality: 10,
};

export function calculateFeedScore(
  post: {
    id: string;
    userId?: string;
    creatorId?: string;
    hashtags: string[];
    createdAt: string;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  },
  userProfile: UserProfile,
  currentTime: Date = new Date()
): FeedScore {
  const factors = {
    recency: calculateRecencyScore(post.createdAt, currentTime),
    contentMatch: calculateContentMatch(post.hashtags, userProfile.interests),
    creatorAffinity: calculateCreatorAffinity(post.creatorId, userProfile.affinities),
    engagement: calculateEngagementScore(post.likes, post.comments, post.shares, post.saves),
    virality: calculateViralityScore(post.shares, post.likes),
  };

  const weights = DEFAULT_INTEREST_WEIGHTS;
  const score =
    factors.recency * (weights.recency / 100) +
    factors.contentMatch * (weights.contentMatch / 100) +
    factors.creatorAffinity * (weights.creatorAffinity / 100) +
    factors.engagement * (weights.engagement / 100) +
    factors.virality * (weights.virality / 100);

  return {
    postId: post.id,
    score,
    factors,
  };
}

function calculateRecencyScore(createdAt: string, currentTime: Date): number {
  const postTime = new Date(createdAt).getTime();
  const hoursAgo = (currentTime.getTime() - postTime) / (1000 * 60 * 60);

  if (hoursAgo < 1) return 100;
  if (hoursAgo < 6) return 90;
  if (hoursAgo < 24) return 70;
  if (hoursAgo < 48) return 50;
  if (hoursAgo < 168) return 30;
  if (hoursAgo < 336) return 15;
  return 5;
}

function calculateContentMatch(
  hashtags: string[],
  interests: UserInterest[]
): number {
  if (hashtags.length === 0 || interests.length === 0) return 50;

  let totalWeight = 0;
  let matchWeight = 0;

  for (const tag of hashtags) {
    const normalized = tag.toLowerCase().replace('#', '');
    const interest = interests.find(i => i.hashtag.toLowerCase() === normalized);
    if (interest) {
      matchWeight += interest.weight;
    }
  }

  for (const interest of interests) {
    totalWeight += interest.weight;
  }

  if (totalWeight === 0) return 50;
  return Math.min(100, Math.round((matchWeight / totalWeight) * 100));
}

function calculateCreatorAffinity(
  creatorId: string | undefined,
  affinities: CreatorAffinity[]
): number {
  if (!creatorId || affinities.length === 0) return 50;

  const affinity = affinities.find(a => a.creatorId === creatorId);
  if (!affinity) return 30;

  return Math.min(100, affinity.score);
}

function calculateEngagementScore(
  likes: number,
  comments: number,
  shares: number,
  saves: number
): number {
  const engagementRate = (likes * 1 + comments * 2 + shares * 3 + saves * 4);

  if (engagementRate === 0) return 10;
  if (engagementRate < 10) return 20;
  if (engagementRate < 50) return 40;
  if (engagementRate < 100) return 60;
  if (engagementRate < 500) return 80;
  return 100;
}

function calculateViralityScore(shares: number, likes: number): number {
  if (likes === 0) return 0;

  const shareRate = shares / likes;

  if (shareRate > 0.3) return 100;
  if (shareRate > 0.2) return 80;
  if (shareRate > 0.1) return 60;
  if (shareRate > 0.05) return 40;
  return 20;
}

export function rankPosts(
  posts: {
    id: string;
    creatorId: string;
    hashtags: string[];
    createdAt: string;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }[],
  userProfile: UserProfile
): string[] {
  const scoredPosts = posts.map(post => ({
    post,
    score: calculateFeedScore(post as any, userProfile),
  }));

  scoredPosts.sort((a, b) => b.score.score - a.score.score);

  return scoredPosts.map(sp => sp.post.id);
}

export function updateInterests(
  interests: UserInterest[],
  hashtag: string,
  action: 'like' | 'comment' | 'share' | 'save' | 'follow' | 'post'
): UserInterest[] {
  const normalized = hashtag.toLowerCase().replace('#', '');
  const existing = interests.find(i => i.hashtag.toLowerCase() === normalized);

  const weights: Record<string, number> = {
    like: 5,
    comment: 10,
    share: 15,
    save: 20,
    follow: 25,
    post: 3,
  };

  const weightGain = weights[action] || 5;

  if (existing) {
    return interests.map(i =>
      i.hashtag.toLowerCase() === normalized
        ? { ...i, weight: Math.min(100, i.weight + weightGain), lastUpdate: new Date().toISOString() }
        : i
    );
  }

  return [...interests, {
    hashtag: normalized,
    weight: weightGain,
    lastUpdate: new Date().toISOString(),
  }];
}

export function updateAffinity(
  affinities: CreatorAffinity[],
  creatorId: string,
  action: 'like' | 'comment' | 'share' | 'message'
): CreatorAffinity[] {
  const existing = affinities.find(a => a.creatorId === creatorId);

  const weights: Record<string, number> = {
    like: 5,
    comment: 10,
    share: 15,
    message: 20,
  };

  const scoreGain = weights[action] || 5;

  if (existing) {
    return affinities.map(a =>
      a.creatorId === creatorId
        ? { ...a, score: Math.min(100, a.score + scoreGain), lastInteraction: new Date().toISOString() }
        : a
    );
  }

  return [...affinities, {
    creatorId,
    score: scoreGain,
    lastInteraction: new Date().toISOString(),
  }];
}

export function calculateSimilarityScore(
  postHashtags: string[],
  userInterests: UserInterest[]
): number {
  if (postHashtags.length === 0 || userInterests.length === 0) return 0;

  let score = 0;
  for (const tag of postHashtags) {
    const normalized = tag.toLowerCase().replace('#', '');
    const interest = userInterests.find(i => i.hashtag.toLowerCase() === normalized);
    if (interest) {
      score += interest.weight;
    }
  }

  return Math.min(100, score);
}

export function recommendedHashtags(
  userInterests: UserInterest[],
  trendingHashtags: string[],
  limit: number = 5
): { hashtag: string; score: number; reason: string }[] {
  const recommendations: { hashtag: string; score: number; reason: string }[] = [];

  const userTags = new Set(userInterests.map(i => i.hashtag.toLowerCase()));

  for (const tag of trendingHashtags) {
    const normalized = tag.toLowerCase().replace('#', '');
    if (userTags.has(normalized)) continue;

    const existing = userInterests.find(i => i.hashtag.toLowerCase() === normalized);
    if (existing) {
      recommendations.push({
        hashtag: tag,
        score: existing.weight + 20,
        reason: 'Based on your engagement',
      });
    } else {
      recommendations.push({
        hashtag: tag,
        score: 30,
        reason: 'Trending now',
      });
    }
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, limit);
}

export function getFeedInsights(
  posts: { id: string; creatorId: string; hashtags: string[]; likes: number; }[],
  userProfile: UserProfile
): {
  topCategories: { tag: string; count: number }[];
  creatorBreakdown: { id: string; posts: number; engagement: number }[];
  recommendedActions: string[];
} {
  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.hashtags) {
      const normalized = tag.toLowerCase().replace('#', '');
      tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    }
  }

  const topCategories = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const creatorStats = new Map<string, { posts: number; engagement: number }>();
  for (const post of posts) {
    const current = creatorStats.get(post.creatorId) || { posts: 0, engagement: 0 };
    creatorStats.set(post.creatorId, {
      posts: current.posts + 1,
      engagement: current.engagement + post.likes,
    });
  }

  const creatorBreakdown = Array.from(creatorStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  const recommendedActions: string[] = [];
  if (userProfile.savedPosts.length < 5) {
    recommendedActions.push('Save more posts to improve recommendations');
  }
  if (userProfile.followedCreators.length < 10) {
    recommendedActions.push('Follow more creators for better feed');
  }
  if (userProfile.interests.length < 3) {
    recommendedActions.push('Engage with more topics to personalize your feed');
  }

  return { topCategories, creatorBreakdown, recommendedActions };
}