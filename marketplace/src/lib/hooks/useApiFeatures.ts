/**
 * Production React hooks for all API features
 * Handles loading states, errors, retries, and real-time updates
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../api-service';

// ──────────────────────────────────────────────────────────────────────────────
// Type definitions
// ──────────────────────────────────────────────────────────────────────────────

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: any;
  retry: () => Promise<void>;
}

interface UseAsyncOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  retries?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic async hook (base for all features)
// ──────────────────────────────────────────────────────────────────────────────

function useAsync<T>(
  asyncFunction: () => Promise<any>,
  immediate = true,
  options?: UseAsyncOptions
): UseAsyncState<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
    retry: async () => {},
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await asyncFunction();
      if (response.error) {
        throw response.error;
      }
      setState(prev => ({ ...prev, data: response.data, loading: false }));
      options?.onSuccess?.(response.data);
    } catch (error) {
      setState(prev => ({ ...prev, error, loading: false }));
      options?.onError?.(error);
    }
  }, [asyncFunction, options]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  const retry = useCallback(() => execute(), [execute]);

  return { ...state, retry };
}

// ──────────────────────────────────────────────────────────────────────────────
// Feature hooks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Hook: Get creator profile
 */
export function useCreator(creatorId: number | null) {
  return useAsync(
    () => (creatorId ? api.creators.get(creatorId) : Promise.resolve({ data: null })),
    !!creatorId
  );
}

/**
 * Hook: List creators with optional filters
 */
export function useCreators(filters?: any) {
  return useAsync(() => api.creators.list(filters), true);
}

/**
 * Hook: Search creators by query
 */
export function useSearchCreators(query: string) {
  return useAsync(
    () => (query ? api.creators.search(query) : Promise.resolve({ data: [] })),
    !!query
  );
}

/**
 * Hook: Match creators by brand value skin
 */
export function useMatchedCreators(brandValueSkin: string | null, limit = 50) {
  return useAsync(
    () =>
      brandValueSkin
        ? api.creators.match(brandValueSkin, limit)
        : Promise.resolve({ data: [] }),
    !!brandValueSkin
  );
}

/**
 * Hook: Create creator profile
 */
export function useCreateCreator(options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const create = useCallback(
    async (data: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.creators.create(data);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [options]
  );

  return { ...state, create };
}

/**
 * Hook: Get campaign details
 */
export function useCampaign(campaignId: number | null) {
  return useAsync(
    () =>
      campaignId ? api.campaigns.get(campaignId) : Promise.resolve({ data: null }),
    !!campaignId
  );
}

/**
 * Hook: List campaigns
 */
export function useCampaigns(filters?: any) {
  return useAsync(() => api.campaigns.list(filters), true);
}

/**
 * Hook: Create campaign
 */
export function useCreateCampaign(options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const create = useCallback(
    async (data: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.campaigns.create(data);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [options]
  );

  return { ...state, create };
}

/**
 * Hook: Update campaign
 */
export function useUpdateCampaign(campaignId: number, options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const update = useCallback(
    async (data: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.campaigns.update(campaignId, data);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [campaignId, options]
  );

  return { ...state, update };
}

/**
 * Hook: Get deal details
 */
export function useDeal(dealId: number | null) {
  return useAsync(
    () => (dealId ? api.deals.get(dealId) : Promise.resolve({ data: null })),
    !!dealId
  );
}

/**
 * Hook: List deals
 */
export function useDeals(filters?: any) {
  return useAsync(() => api.deals.list(filters), true);
}

/**
 * Hook: Create deal
 */
export function useCreateDeal(options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const create = useCallback(
    async (data: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.deals.create(data);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [options]
  );

  return { ...state, create };
}

/**
 * Hook: Update deal (send offer, counter, accept, etc.)
 */
export function useUpdateDeal(dealId: number, options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const update = useCallback(
    async (data: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.deals.update(dealId, data);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [dealId, options]
  );

  return { ...state, update };
}

/**
 * Hook: Get messages in deal room
 */
export function useDealMessages(dealId: number | null, limit = 50) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dealId) return;

    const loadMessages = async () => {
      setLoading(true);
      const response = await api.messages.list(dealId, limit);
      if (response.error) {
        setError(response.error);
      } else {
        setMessages(response.data || []);
      }
      setLoading(false);
    };

    loadMessages();
  }, [dealId, limit]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!dealId) return;
      setLoading(true);
      try {
        const response = await api.messages.send(dealId, text);
        if (response.error) throw response.error;
        setMessages(prev => [...prev, response.data]);
        return response.data;
      } catch (err) {
        setError(err as any);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  return { messages, loading, error, sendMessage };
}

/**
 * Hook: List applications
 */
export function useApplications(filters?: any) {
  return useAsync(() => api.applications.list(filters), true);
}

/**
 * Hook: Create application (apply to campaign)
 */
export function useCreateApplication(options?: UseAsyncOptions) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const apply = useCallback(
    async (campaignId: number, creatorId: number) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.applications.create(campaignId, creatorId);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        options?.onError?.(error);
        throw error;
      }
    },
    [options]
  );

  return { ...state, apply };
}

/**
 * Hook: Upload file/deliverable
 */
export function useUploadFile(dealId: number) {
  const [state, setState] = useState<UseAsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    retry: async () => {},
  });

  const upload = useCallback(
    async (file: File) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await api.files.upload(dealId, file);
        if (response.error) throw response.error;
        setState(prev => ({ ...prev, data: response.data, loading: false }));
        return response.data;
      } catch (error) {
        setState(prev => ({ ...prev, error, loading: false }));
        throw error;
      }
    },
    [dealId]
  );

  return { ...state, upload };
}

/**
 * Hook: Get notifications
 */
export function useNotifications() {
  return useAsync(() => api.notifications.list(), true);
}
