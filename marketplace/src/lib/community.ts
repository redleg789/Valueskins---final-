export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  memberCount: number;
  creatorId: string;
  creatorName: string;
  currentArtwork: Artwork | null;
  createdAt: string;
  isPrivate: boolean;
}

export interface Artwork {
  id: string;
  communityId: string;
  submitterId: string;
  submitterName: string;
  imageUrl: string;
  votes: number;
  submittedAt: string;
  weekNumber: number;
  year: number;
  status: 'pending' | 'active' | 'completed';
}

export interface Vote {
  artworkId: string;
  voterId: string;
  votedAt: string;
}

export interface CommunityMember {
  communityId: string;
  userId: string;
  joinedAt: string;
  role: 'member' | 'moderator' | 'admin';
}

export interface ArtworkSubmission {
  artworkId: string;
  userId: string;
  userName: string;
  imageUrl: string;
  submittedAt: string;
  votes: number;
  hasVoted: boolean;
}

const STORAGE_KEYS = {
  COMMUNITIES: 'valueskins_communities',
  ARTWORKS: 'valueskins_artworks',
  VOTES: 'valueskins_votes',
  MEMBERS: 'valueskins_members',
};

const DEFAULT_COMMUNITIES: Community[] = [
  {
    id: 'tech-community',
    name: 'Tech Builders',
    description: 'For developers and tech enthusiasts to share and celebrate creative work',
    category: 'Technology',
    memberCount: 1247,
    creatorId: 'system',
    creatorName: 'ValueSkins Team',
    currentArtwork: null,
    createdAt: '2026-01-01T00:00:00Z',
    isPrivate: false,
  },
  {
    id: 'art-community',
    name: 'Digital Artists',
    description: 'A space for digital artists to showcase their masterpieces and inspire others',
    category: 'Art',
    memberCount: 892,
    creatorId: 'system',
    creatorName: 'ValueSkins Team',
    currentArtwork: null,
    createdAt: '2026-01-01T00:00:00Z',
    isPrivate: false,
  },
  {
    id: 'music-community',
    name: 'Sound Collective',
    description: 'Musicians and producers sharing their latest beats and compositions',
    category: 'Music',
    memberCount: 654,
    creatorId: 'system',
    creatorName: 'ValueSkins Team',
    currentArtwork: null,
    createdAt: '2026-01-01T00:00:00Z',
    isPrivate: false,
  },
];

const SAMPLE_ARTWORKS: Artwork[] = [
  {
    id: 'artwork-1',
    communityId: 'tech-community',
    submitterId: 'user-1',
    submitterName: 'Alex Chen',
    imageUrl: 'https://picsum.photos/seed/art1/800/600',
    votes: 24,
    submittedAt: '2026-04-20T10:00:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-2',
    communityId: 'tech-community',
    submitterId: 'user-2',
    submitterName: 'Sarah Kim',
    imageUrl: 'https://picsum.photos/seed/art2/800/600',
    votes: 18,
    submittedAt: '2026-04-21T14:30:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-3',
    communityId: 'tech-community',
    submitterId: 'user-3',
    submitterName: 'Marcus Johnson',
    imageUrl: 'https://picsum.photos/seed/art3/800/600',
    votes: 31,
    submittedAt: '2026-04-19T09:15:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-4',
    communityId: 'tech-community',
    submitterId: 'user-4',
    submitterName: 'Emma Davis',
    imageUrl: 'https://picsum.photos/seed/art4/800/600',
    votes: 12,
    submittedAt: '2026-04-22T16:45:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-5',
    communityId: 'art-community',
    submitterId: 'user-5',
    submitterName: 'James Liu',
    imageUrl: 'https://picsum.photos/seed/art5/800/600',
    votes: 45,
    submittedAt: '2026-04-18T11:20:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-6',
    communityId: 'art-community',
    submitterId: 'user-6',
    submitterName: 'Lisa Wang',
    imageUrl: 'https://picsum.photos/seed/art6/800/600',
    votes: 38,
    submittedAt: '2026-04-20T08:00:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-7',
    communityId: 'music-community',
    submitterId: 'user-7',
    submitterName: 'David Park',
    imageUrl: 'https://picsum.photos/seed/art7/800/600',
    votes: 22,
    submittedAt: '2026-04-21T13:00:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
  {
    id: 'artwork-8',
    communityId: 'music-community',
    submitterId: 'user-8',
    submitterName: 'Nina Rodriguez',
    imageUrl: 'https://picsum.photos/seed/art8/800/600',
    votes: 29,
    submittedAt: '2026-04-19T17:30:00Z',
    weekNumber: 17,
    year: 2026,
    status: 'pending',
  },
];

export function getWeekNumber(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
}

export function getCurrentWeekYear(): { week: number; year: number } {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

export function getDefaultArtwork(communityId: string): Artwork | null {
  const community = DEFAULT_COMMUNITIES.find(c => c.id === communityId);
  if (!community) return null;
  
  return {
    id: `default-${communityId}`,
    communityId,
    submitterId: 'system',
    submitterName: 'Community Default',
    imageUrl: `https://picsum.photos/seed/${communityId}/800/600`,
    votes: 0,
    submittedAt: '2026-01-01T00:00:00Z',
    weekNumber: getWeekNumber(),
    year: new Date().getFullYear(),
    status: 'active',
  };
}

export function getCommunities(): Community[] {
  if (typeof window === 'undefined') return DEFAULT_COMMUNITIES;
  
  const stored = localStorage.getItem(STORAGE_KEYS.COMMUNITIES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.COMMUNITIES, JSON.stringify(DEFAULT_COMMUNITIES));
    return DEFAULT_COMMUNITIES;
  }
  
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_COMMUNITIES;
  }
}

export function getCommunity(id: string): Community | null {
  const communities = getCommunities();
  return communities.find(c => c.id === id) || null;
}

export function getArtworks(communityId: string, week?: number, year?: number): Artwork[] {
  if (typeof window === 'undefined') return SAMPLE_ARTWORKS.filter(a => a.communityId === communityId);
  
  const { week: currentWeek, year: currentYear } = getCurrentWeekYear();
  const targetWeek = week || currentWeek;
  const targetYear = year || currentYear;
  
  const stored = localStorage.getItem(STORAGE_KEYS.ARTWORKS);
  const localArtworks: Artwork[] = stored ? JSON.parse(stored) : [];
  
  const sampleArtworks = SAMPLE_ARTWORKS.filter(
    a => a.communityId === communityId && a.weekNumber === targetWeek && a.year === targetYear
  );
  
  const communityArtworks = localArtworks.filter(
    a => a.communityId === communityId && a.weekNumber === targetWeek && a.year === targetYear
  );
  
  return [...sampleArtworks, ...communityArtworks].sort((a, b) => b.votes - a.votes);
}

export function getCurrentArtwork(communityId: string): Artwork | null {
  const communities = getCommunities();
  const community = communities.find(c => c.id === communityId);
  return community?.currentArtwork || getDefaultArtwork(communityId);
}

export function getVoters(artworkId: string): string[] {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(STORAGE_KEYS.VOTES);
  if (!stored) return [];
  
  try {
    const votes: Vote[] = JSON.parse(stored);
    return votes.filter(v => v.artworkId === artworkId).map(v => v.voterId);
  } catch {
    return [];
  }
}

export function hasVoted(artworkId: string, userId: string): boolean {
  return getVoters(artworkId).includes(userId);
}

export function submitArtwork(
  communityId: string,
  userId: string,
  userName: string,
  imageUrl: string
): Artwork {
  const { week, year } = getCurrentWeekYear();
  
  const artwork: Artwork = {
    id: `artwork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    communityId,
    submitterId: userId,
    submitterName: userName,
    imageUrl,
    votes: 0,
    submittedAt: new Date().toISOString(),
    weekNumber: week,
    year,
    status: 'pending',
  };
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.ARTWORKS);
    const artworks: Artwork[] = stored ? JSON.parse(stored) : [];
    artworks.push(artwork);
    localStorage.setItem(STORAGE_KEYS.ARTWORKS, JSON.stringify(artworks));
  }
  
  return artwork;
}

export function voteForArtwork(artworkId: string, voterId: string): boolean {
  if (hasVoted(artworkId, voterId)) return false;
  
  const vote: Vote = {
    artworkId,
    voterId,
    votedAt: new Date().toISOString(),
  };
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.VOTES);
    const votes: Vote[] = stored ? JSON.parse(stored) : [];
    votes.push(vote);
    localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
    
    const artworksStored = localStorage.getItem(STORAGE_KEYS.ARTWORKS);
    const artworks: Artwork[] = artworksStored ? JSON.parse(artworksStored) : [];
    const artworkIndex = artworks.findIndex(a => a.id === artworkId);
    if (artworkIndex >= 0) {
      artworks[artworkIndex].votes++;
      localStorage.setItem(STORAGE_KEYS.ARTWORKS, JSON.stringify(artworks));
    }
  }
  
  return true;
}

export function processWeeklyWinner(communityId: string): Artwork | null {
  const artworks = getArtworks(communityId);
  
  if (artworks.length === 0) {
    return getDefaultArtwork(communityId);
  }
  
  const sortedArtworks = [...artworks].sort((a, b) => b.votes - a.votes);
  const maxVotes = sortedArtworks[0].votes;
  
  const topVoted = sortedArtworks.filter(a => a.votes === maxVotes);
  
  if (topVoted.length > 1) {
    return null;
  }
  
  return sortedArtworks[0];
}

export function updateCommunityCurrentArtwork(communityId: string, artwork: Artwork | null) {
  const communities = getCommunities();
  const index = communities.findIndex(c => c.id === communityId);
  
  if (index >= 0) {
    communities[index].currentArtwork = artwork;
    localStorage.setItem(STORAGE_KEYS.COMMUNITIES, JSON.stringify(communities));
  }
}