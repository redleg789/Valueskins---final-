import { useState, useCallback } from 'react';

export interface DefaultValueSkin {
  id: string;
  name: string;
  description: string;
  pitch: string;
  video: string;
  xp: number;
  level: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Hook to fetch a user's default ValueSkin (public data)
 */
export function useDefaultValueSkin(userId: string | null) {
  const [data, setData] = useState<DefaultValueSkin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/valueskins/get-default?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch default ValueSkin');
      }
      const result = await response.json();
      setData(result.defaultValueSkin);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { data, loading, error, fetch };
}

/**
 * Hook to update a user's ValueSkin (for own profile only)
 */
export function useUpdateValueSkin(valueSkinId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (updates: {
      profession?: string;
      aboutMe?: string;
      pitchText?: string;
      pitchVideo?: string;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/valueskins/${valueSkinId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to update ValueSkin');
        }

        const result = await response.json();
        return result;
      } catch (err: any) {
        const message = err.message || 'Failed to update ValueSkin';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [valueSkinId]
  );

  return { update, loading, error };
}

/**
 * Hook to initialize a default ValueSkin on registration
 */
export function useInitializeDefaultValueSkin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/valueskins/initialize-default', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to initialize default ValueSkin');
      }

      const result = await response.json();
      return result.defaultValueSkin;
    } catch (err: any) {
      const message = err.message || 'Failed to initialize ValueSkin';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { initialize, loading, error };
}
