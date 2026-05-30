/**
 * ValueSkins API Client
 *
 * This client handles cross-platform API communication:
 * - Fetch deals from ValueSkins
 * - Submit creator applications
 * - Sync deal updates in real-time
 * - Handle payments and escrow
 */

const VALUESKINS_API_BASE = process.env.NEXT_PUBLIC_VALUESKINS_API || 'http://localhost:3001/api';

export interface Location {
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface ValueSkinsCreator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  followers: number;
  level: number;
  profession: string;
  platforms: string[];
  avgRating: number;
  totalDealsCompleted: number;
  locations?: Location[]; // Multi-location support
  primaryLocation?: Location;
}

export interface ValueSkinsDeal {
  id: string;
  brandId: string;
  brandName: string;
  brandLogo?: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  currency: string;
  requiredLevel: number;
  platforms: string[];
  deliverables: Array<{
    type: string;
    description: string;
    quantity: number;
    dueDate: string;
  }>;
  applicationDeadline: string;
  deliveryDeadline: string;
  status: 'draft' | 'active' | 'pending' | 'accepted' | 'funded' | 'in_progress' | 'submitted' | 'approved' | 'completed' | 'disputed' | 'cancelled';
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
  targetLocations?: Location[]; // Locations where brand wants creators
  requiredLocations?: boolean; // Whether location match is required
}

export interface ValueSkinsApplication {
  id: string;
  dealId: string;
  creatorId: string;
  pitch: string;
  portfolioLinks: string[];
  proposedRate?: number;
  status: 'pending' | 'accepted' | 'rejected';
  submittedAt: string;
}

export interface ValueSkinsPayout {
  id: string;
  dealId: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    country: string;
  };
  createdAt: string;
  completedAt?: string;
}

/**
 * Fetch all active deals from ValueSkins
 * Cross-company API call with authentication
 */
export async function fetchValueSkinsDeals(token: string, filters?: {
  platform?: string;
  minBudget?: number;
  maxBudget?: number;
  level?: number;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}): Promise<ValueSkinsDeal[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.platform) params.append('platform', filters.platform);
    if (filters?.minBudget) params.append('minBudget', filters.minBudget.toString());
    if (filters?.maxBudget) params.append('maxBudget', filters.maxBudget.toString());
    if (filters?.level) params.append('level', filters.level.toString());
    if (filters?.city) params.append('city', filters.city);
    if (filters?.country) params.append('country', filters.country);
    if (filters?.latitude) params.append('latitude', filters.latitude.toString());
    if (filters?.longitude) params.append('longitude', filters.longitude.toString());
    if (filters?.radiusKm) params.append('radiusKm', filters.radiusKm.toString());

    const response = await fetch(`${VALUESKINS_API_BASE}/deals?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Failed to fetch deals');
    return response.json();
  } catch (error) {
    console.error('ValueSkins API error:', error);
    return [];
  }
}

/**
 * Fetch single deal from ValueSkins
 */
export async function fetchValueSkinsDeal(token: string, dealId: string): Promise<ValueSkinsDeal | null> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/deals/${dealId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch deal:', error);
    return null;
  }
}

/**
 * Submit application for a ValueSkins deal
 */
export async function applyForValueSkinsDeal(
  token: string,
  dealId: string,
  creatorId: string,
  data: {
    pitch: string;
    portfolioLinks: string[];
    proposedRate?: number;
  }
): Promise<ValueSkinsApplication | null> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/deals/${dealId}/apply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creatorId,
        ...data,
      }),
    });

    if (!response.ok) throw new Error('Failed to apply');
    return response.json();
  } catch (error) {
    console.error('Failed to apply for deal:', error);
    return null;
  }
}

/**
 * Fetch creator's applications on ValueSkins
 */
export async function fetchCreatorApplications(token: string, creatorId: string): Promise<ValueSkinsApplication[]> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/creators/${creatorId}/applications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
      },
    });

    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.error('Failed to fetch applications:', error);
    return [];
  }
}

/**
 * Fetch creator profile from ValueSkins
 */
export async function fetchValueSkinsCreator(token: string, creatorId: string): Promise<ValueSkinsCreator | null> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/creators/${creatorId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch creator:', error);
    return null;
  }
}

/**
 * Submit deliverables for a deal
 */
export async function submitDeliverables(
  token: string,
  dealId: string,
  creatorId: string,
  deliverables: Array<{
    deliverableId: string;
    submissionUrl: string;
    notes?: string;
  }>
): Promise<boolean> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/deals/${dealId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creatorId,
        deliverables,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to submit deliverables:', error);
    return false;
  }
}

/**
 * Request payout from ValueSkins
 */
export async function requestPayout(
  token: string,
  dealId: string,
  creatorId: string,
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    country: string;
  }
): Promise<ValueSkinsPayout | null> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealId,
        creatorId,
        bankDetails,
      }),
    });

    if (!response.ok) throw new Error('Failed to request payout');
    return response.json();
  } catch (error) {
    console.error('Failed to request payout:', error);
    return null;
  }
}

/**
 * Listen for ValueSkins deal updates in real-time
 */
export function subscribeToValueSkinsDealUpdates(
  token: string,
  dealId: string,
  onUpdate: (deal: ValueSkinsDeal) => void
): () => void {
  const eventSource = new EventSource(
    `${VALUESKINS_API_BASE}/deals/${dealId}/subscribe?token=${encodeURIComponent(token)}&platform=valueskins`
  );

  eventSource.onmessage = (event) => {
    try {
      const deal = JSON.parse(event.data);
      onUpdate(deal);
    } catch (error) {
      console.error('Failed to parse deal update:', error);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
  };

  return () => eventSource.close();
}

/**
 * Get creator's earnings summary from ValueSkins
 */
export async function fetchCreatorEarnings(token: string, creatorId: string): Promise<{
  totalEarned: number;
  totalDealsCompleted: number;
  avgDealValue: number;
  pendingPayouts: number;
  nextPayoutDate?: string;
} | null> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/creators/${creatorId}/earnings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch earnings:', error);
    return null;
  }
}

/**
 * Search creators by location for brands
 * Enhanced brand search with multi-location filtering
 */
export async function searchCreatorsByLocation(
  token: string,
  filters: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    minFollowers?: number;
    maxFollowers?: number;
    minLevel?: number;
    platforms?: string[];
    profession?: string;
    verified?: boolean;
  }
): Promise<ValueSkinsCreator[]> {
  try {
    const params = new URLSearchParams();
    if (filters.city) params.append('city', filters.city);
    if (filters.country) params.append('country', filters.country);
    if (filters.latitude) params.append('latitude', filters.latitude.toString());
    if (filters.longitude) params.append('longitude', filters.longitude.toString());
    if (filters.radiusKm) params.append('radiusKm', filters.radiusKm.toString());
    if (filters.minFollowers) params.append('minFollowers', filters.minFollowers.toString());
    if (filters.maxFollowers) params.append('maxFollowers', filters.maxFollowers.toString());
    if (filters.minLevel) params.append('minLevel', filters.minLevel.toString());
    if (filters.platforms) params.append('platforms', filters.platforms.join(','));
    if (filters.profession) params.append('profession', filters.profession);
    if (filters.verified !== undefined) params.append('verified', filters.verified.toString());

    const response = await fetch(`${VALUESKINS_API_BASE}/creators/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.error('Failed to search creators:', error);
    return [];
  }
}

/**
 * Get creators near a specific location
 * Returns creators sorted by distance
 */
export async function getCreatorsNearby(
  token: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 50,
  limit: number = 50
): Promise<Array<ValueSkinsCreator & { distance?: number }>> {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radiusKm: radiusKm.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${VALUESKINS_API_BASE}/creators/nearby?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
      },
    });

    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.error('Failed to fetch nearby creators:', error);
    return [];
  }
}

/**
 * Sync user profile to ValueSkins
 * One-way sync: whenever user updates profile, push to ValueSkins
 */
export async function syncProfileToValueSkins(
  token: string,
  userId: string,
  profileData: {
    name: string;
    handle: string;
    avatar: string;
    bio: string;
    verified: boolean;
    followers: number;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`${VALUESKINS_API_BASE}/sync/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'valueskins',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        profileData,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to sync profile:', error);
    return false;
  }
}
