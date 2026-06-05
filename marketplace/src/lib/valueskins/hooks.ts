import { useState, useCallback, useEffect, useRef } from 'react';

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
 * WITH REAL-TIME POLLING — automatically syncs changes from other users
 */
export function useDefaultValueSkin(userId: string | null, autoRefresh: boolean = true) {
  const [data, setData] = useState<DefaultValueSkin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/valueskins/get-default?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch default ValueSkin');
      }
      const result = await response.json();

      // Only update if data has changed (prevent unnecessary re-renders)
      const newData = result.defaultValueSkin;
      const updateHash = JSON.stringify(newData);

      if (updateHash !== lastUpdateRef.current) {
        lastUpdateRef.current = updateHash;
        setData(newData);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [userId, fetchData]);

  // Set up polling for real-time updates (every 2 seconds)
  useEffect(() => {
    if (!userId || !autoRefresh) return;

    // Start polling
    pollingIntervalRef.current = setInterval(() => {
      fetchData();
    }, 2000); // Poll every 2 seconds for real-time updates

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [userId, autoRefresh, fetchData]);

  const manualRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: manualRefresh };
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

/**
 * Hook to fetch CURRENT USER's default ValueSkin with real-time polling
 * Automatically syncs changes made in other sessions/browsers
 */
export function useMyDefaultValueSkinRealTime() {
  const [data, setData] = useState<DefaultValueSkin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  // Step 1: Get current user's ID from session
  useEffect(() => {
    const fetchSessionUser = async () => {
      try {
        const response = await fetch('/api/auth/check', { credentials: 'include' });
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.user_id) {
            setSessionUserId(sessionData.user_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch session:', err);
      }
    };

    fetchSessionUser();
  }, []);

  // Step 2: Fetch and poll the user's default ValueSkin
  const fetchMyValueSkin = useCallback(async () => {
    if (!sessionUserId) return;

    try {
      const response = await fetch(`/api/valueskins/get-default?userId=${sessionUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ValueSkin');
      }
      const result = await response.json();

      // Only update if changed
      const updateHash = JSON.stringify(result.defaultValueSkin);
      if (updateHash !== lastUpdateRef.current) {
        lastUpdateRef.current = updateHash;
        setData(result.defaultValueSkin);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [sessionUserId]);

  // Initial fetch
  useEffect(() => {
    if (!sessionUserId) return;

    setLoading(true);
    fetchMyValueSkin().finally(() => setLoading(false));
  }, [sessionUserId, fetchMyValueSkin]);

  // Start polling (every 2 seconds for real-time updates)
  useEffect(() => {
    if (!sessionUserId) return;

    pollingIntervalRef.current = setInterval(() => {
      fetchMyValueSkin();
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionUserId, fetchMyValueSkin]);

  return { data, loading, error };
}
