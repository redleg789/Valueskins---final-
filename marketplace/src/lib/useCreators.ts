import { useState, useEffect, useCallback } from 'react';

export interface Creator {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  followers_count: number;
  engagement_rate: number;
  bio: string;
  profile_image_url: string;
  verified: boolean;
  value_skin: string;
  profession: string;
  estimated_rate_usd: number;
}

export interface CreatorListResponse {
  creators: Creator[];
  total: number;
  data_source: string;
  is_mock: boolean;
}

interface UseCreatorsOptions {
  platform: string;
  profession?: string;
  minFollowers?: number;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export function useCreators(options: UseCreatorsOptions) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<{ name: string; isMock: boolean } | null>(null);

  const fetchCreators = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        platform: options.platform,
        limit: String(options.limit || 20),
        offset: String(options.offset || 0),
      });

      if (options.profession) {
        params.append('profession', options.profession);
      }
      if (options.minFollowers) {
        params.append('min_followers', String(options.minFollowers));
      }
      if (options.verifiedOnly) {
        params.append('verified_only', 'true');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
      const response = await fetch(`${apiUrl}/api/v1/creators/search?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch creators: ${response.statusText}`);
      }

      const data: CreatorListResponse = await response.json();
      setCreators(data.creators);
      setSource({ name: data.data_source, isMock: data.is_mock });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Fallback to empty list on error
      setCreators([]);
    } finally {
      setLoading(false);
    }
  }, [
    options.platform,
    options.profession,
    options.minFollowers,
    options.verifiedOnly,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  return { creators, loading, error, source, refetch: fetchCreators };
}

/**
 * Hook to get a single creator by ID
 */
export function useCreator(platform: string, creatorId: string) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreator = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
        const response = await fetch(
          `${apiUrl}/api/v1/creators/${platform}/${creatorId}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Creator not found`);
        }

        const data: Creator = await response.json();
        setCreator(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setCreator(null);
      } finally {
        setLoading(false);
      }
    };

    if (platform && creatorId) {
      fetchCreator();
    }
  }, [platform, creatorId]);

  return { creator, loading, error };
}

/**
 * Hook to get creators by profession
 */
export function useCreatorsByProfession(platform: string, profession: string, limit = 20) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
        const response = await fetch(
          `${apiUrl}/api/v1/creators/${platform}/profession/${profession}?limit=${limit}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch creators`);
        }

        const data: CreatorListResponse = await response.json();
        setCreators(data.creators);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setCreators([]);
      } finally {
        setLoading(false);
      }
    };

    if (platform && profession) {
      fetchCreators();
    }
  }, [platform, profession, limit]);

  return { creators, loading, error };
}
