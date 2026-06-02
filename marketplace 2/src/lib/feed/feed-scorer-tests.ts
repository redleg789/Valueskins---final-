import {
  calculateFeedScore,
  rankPosts,
  updateInterests,
  updateAffinity,
  calculateSimilarityScore,
  recommendedHashtags,
  getFeedInsights,
  UserProfile,
} from './personalization';

console.log('🛡️  FEED PERSONALIZATION TESTS\n');
console.log('='.repeat(45));

const results: { test: string; passed: boolean; details: string }[] = [];

function test(name: string, passed: boolean, details: string) {
  results.push({ test: name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  console.log(`   ${details}\n`);
}

const mockUserProfile: UserProfile = {
  userId: 'user-1',
  interests: [
    { hashtag: 'tech', weight: 80, lastUpdate: '2024-01-01' },
    { hashtag: 'ai', weight: 90, lastUpdate: '2024-01-01' },
    { hashtag: 'startup', weight: 60, lastUpdate: '2024-01-01' },
  ],
  affinities: [
    { creatorId: 'creator-1', score: 80, lastInteraction: '2024-01-01' },
    { creatorId: 'creator-2', score: 50, lastInteraction: '2024-01-01' },
  ],
  savedPosts: ['post-1'],
  likedPosts: ['post-2'],
  followedCreators: ['creator-1'],
};

console.log('\n📊 RECENCY SCORING\n');

test(
  'Recent Post Gets High Score',
  (() => {
    const post = {
      id: 'post-1',
      creatorId: 'creator-1',
      hashtags: ['tech'],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.recency >= 90;
  })(),
  'Posts <1 hour old should score 90+'
);

test(
  'Older Post Gets Lower Score',
  (() => {
    const post = {
      id: 'post-2',
      creatorId: 'creator-1',
      hashtags: ['tech'],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.recency < 50;
  })(),
  'Posts >7 days old should score <50'
);

test(
  'Week-old Post Gets Very Low Score',
  (() => {
    const post = {
      id: 'post-3',
      creatorId: 'creator-1',
      hashtags: ['tech'],
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.recency < 20;
  })(),
  'Posts >14 days old should score <20'
);

console.log('\n🎯 CONTENT MATCHING\n');

test(
  'Matching Hashtag Gets High Score',
  (() => {
    const post = {
      id: 'post-4',
      creatorId: 'creator-1',
      hashtags: ['#tech', '#ai'],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.contentMatch >= 70;
  })(),
  'Matching hashtags should boost score'
);

test(
  'No Matching Hashtag Gets Medium',
  (() => {
    const post = {
      id: 'post-5',
      creatorId: 'creator-1',
      hashtags: ['#cooking'],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.contentMatch >= 30 && score.factors.contentMatch < 60;
  })(),
  'No match should give baseline score'
);

test(
  'Case Insensitive Matching',
  (() => {
    const post = {
      id: 'post-6',
      creatorId: 'creator-1',
      hashtags: ['#TECH', '#AI'],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.contentMatch >= 70;
  })(),
  'Hashtag matching should be case-insensitive'
);

console.log('\n👤 CREATOR AFFINITY\n');

test(
  'Followed Creator Gets High Score',
  (() => {
    const post = {
      id: 'post-7',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.creatorAffinity >= 70;
  })(),
  'Followed creators should boost score'
);

test(
  'Unknown Creator Gets Baseline',
  (() => {
    const post = {
      id: 'post-8',
      creatorId: 'unknown-creator',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 5,
      shares: 2,
      saves: 1,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.creatorAffinity < 50;
  })(),
  'Unknown creators should get baseline'
);

console.log('\n📈 ENGAGEMENT SCORING\n');

test(
  'High Engagement Gets High Score',
  (() => {
    const post = {
      id: 'post-9',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 500,
      comments: 100,
      shares: 50,
      saves: 20,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.engagement >= 70;
  })(),
  'High engagement posts should score higher'
);

test(
  'Zero Engagement Gets Low Score',
  (() => {
    const post = {
      id: 'post-10',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.engagement < 25;
  })(),
  'Zero engagement should score low'
);

test(
  'Saves Weighted Highest',
  (() => {
    const post = {
      id: 'post-11',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 10,
      comments: 10,
      shares: 10,
      saves: 100,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.engagement >= 80;
  })(),
  'Saves should weight highest in engagement'
);

console.log('\n🔥 VIRALITY SCORING\n');

test(
  'High Share Rate Gets High Score',
  (() => {
    const post = {
      id: 'post-12',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 100,
      comments: 10,
      shares: 40,
      saves: 5,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.virality >= 80;
  })(),
  'High share-to-like ratio should boost'
);

test(
  'No Shares Gets Zero Virality',
  (() => {
    const post = {
      id: 'post-13',
      creatorId: 'creator-1',
      hashtags: [],
      createdAt: new Date().toISOString(),
      likes: 100,
      comments: 10,
      shares: 0,
      saves: 5,
    };
    const score = calculateFeedScore(post as any, mockUserProfile);
    return score.factors.virality === 0;
  })(),
  'No shares should give zero virality score'
);

console.log('\n🏆 RANKING\n');

test(
  'Rank Posts By Score',
  (() => {
    const posts = [
      { id: 'post-low', creatorId: 'c1', hashtags: [], createdAt: new Date().toISOString(), likes: 5, comments: 0, shares: 0, saves: 0 },
      { id: 'post-high', creatorId: 'c1', hashtags: ['#tech', '#ai'], createdAt: new Date().toISOString(), likes: 500, comments: 100, shares: 50, saves: 20 },
      { id: 'post-med', creatorId: 'c2', hashtags: ['#tech'], createdAt: new Date().toISOString(), likes: 50, comments: 10, shares: 5, saves: 2 },
    ];
    const ranked = rankPosts(posts as any, mockUserProfile);
    return ranked[0] === 'post_high' && ranked[2] === 'post_low';
  })(),
  'Highest scored posts should rank first'
);

test(
  'Personalization Actually Changes Order',
  (() => {
    const posts = [
      { id: 'a', creatorId: 'c1', hashtags: ['#cooking'], createdAt: new Date().toISOString(), likes: 100, comments: 10, shares: 10, saves: 5 },
      { id: 'b', creatorId: 'c1', hashtags: ['#tech'], createdAt: new Date().toISOString(), likes: 100, comments: 10, shares: 10, saves: 5 },
    ];
    const ranked = rankPosts(posts as any, mockUserProfile);
    return ranked[0] === 'b';
  })(),
  'User interests should affect post ranking'
);

console.log('\n📚 INTEREST TRACKING\n');

test(
  'Update Interest Weight',
  (() => {
    const interests = [{ hashtag: 'tech', weight: 50, lastUpdate: '2024-01-01' }];
    const updated = updateInterests(interests, 'tech', 'like');
    return updated[0].weight === 55;
  })(),
  'Like should increase interest weight'
);

test(
  'Share Increases More Than Like',
  (() => {
    const interests = [{ hashtag: 'tech', weight: 50, lastUpdate: '2024-01-01' }];
    const likeUpdated = updateInterests(interests, 'tech', 'like');
    const shareUpdated = updateInterests(interests, 'tech', 'share');
    return shareUpdated[0].weight > likeUpdated[0].weight;
  })(),
  'Share action should increase more than like'
);

test(
  'New Interest Added',
  (() => {
    const interests: any[] = [];
    const updated = updateInterests(interests, 'newtopic', 'like');
    return updated.length === 1 && updated[0].hashtag === 'newtopic';
  })(),
  'New hashtag should be added to interests'
);

test(
  'Weight Capped At 100',
  (() => {
    const interests = [{ hashtag: 'tech', weight: 95, lastUpdate: '2024-01-01' }];
    const updated = updateInterests(interests, 'tech', 'like');
    return updated[0].weight <= 100;
  })(),
  'Interest weight should cap at 100'
);

console.log('\n👥 CREATOR AFFINITY\n');

test(
  'Update Creator Affinity',
  (() => {
    const affinities: any[] = [];
    const updated = updateAffinity(affinities, 'creator-1', 'message');
    return updated[0].score === 20;
  })(),
  'Message should increase affinity score'
);

test(
  'New Creator Affinity',
  (() => {
    const affinities = [{ creatorId: 'creator-1', score: 50, lastInteraction: '2024-01-01' }];
    const updated = updateAffinity(affinities, 'creator-1', 'comment');
    return updated[0].score === 60;
  })(),
  'New interaction should increase existing affinity'
);

console.log('\n💡 RECOMMENDATIONS\n');

test(
  'Similarity Score Calculation',
  (() => {
    const score = calculateSimilarityScore(['#tech', '#ai'], mockUserProfile.interests);
    return score > 0;
  })(),
  'Should calculate similarity between post and interests'
);

test(
  'Recommended Hashtags',
  (() => {
    const recommendations = recommendedHashtags(
      mockUserProfile.interests,
      ['#new', '#trending', '#viral'],
      3
    );
    return recommendations.length <= 3 && !recommendations.some(r => r.hashtag === 'tech');
  })(),
  'Should recommend new hashtags not in user interests'
);

test(
  'Feed Insights',
  (() => {
    const posts = [
      { id: '1', creatorId: 'c1', hashtags: ['#tech'], likes: 10 },
      { id: '2', creatorId: 'c1', hashtags: ['#ai'], likes: 20 },
      { id: '3', creatorId: 'c2', hashtags: ['#tech'], likes: 15 },
    ];
    const insights = getFeedInsights(posts as any, mockUserProfile);
    return insights.topCategories.length > 0;
  })(),
  'Should provide feed analytics'
);

console.log('\n' + '='.repeat(45));
console.log('\n📊 PERSONALIZATION TEST RESULTS\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  FAILED TESTS:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ ${r.test}`);
    console.log(`   ${r.details}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL PERSONALIZATION TESTS PASSED!');
  console.log('🎯 Feed personalization is working!\n');
  process.exit(0);
}