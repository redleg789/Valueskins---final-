import { useState, useEffect, useCallback } from 'react';

export interface Opportunity {
  id: string;
  platform: string;
  brand_id: string;
  brand_name: string;
  title: string;
  description: string;
  category: string;
  deal_type: string;
  budget_min: number;
  budget_max: number;
  timeline_days: number;
  deliverables: string;
  brief_url?: string;
  script_required: boolean;
  script_mode?: string;
  script_text?: string;
  required_professions: string[];
  required_followers_min?: number;
  status: string;
  applications_count: number;
  created_at: string;
  deadline_at: string;
}

export interface OpportunityListResponse {
  opportunities: Opportunity[];
  total: number;
}

interface UseOpportunitiesOptions {
  platform: string;
  profession?: string;
  minBudget?: number;
  maxBudget?: number;
  dealType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Hook to search opportunities from backend
 * Replaces hardcoded opportunities in demo pages with real API calls
 */
export function useOpportunities(options: UseOpportunitiesOptions) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        platform: options.platform,
        limit: String(options.limit || 20),
        offset: String(options.offset || 0),
        status: options.status || 'open',
      });

      if (options.profession) {
        params.append('profession', options.profession);
      }
      if (options.minBudget) {
        params.append('min_budget', String(options.minBudget));
      }
      if (options.maxBudget) {
        params.append('max_budget', String(options.maxBudget));
      }
      if (options.dealType) {
        params.append('deal_type', options.dealType);
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
      const response = await fetch(`${apiUrl}/api/v1/opportunities/search?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
      }

      const data: OpportunityListResponse = await response.json();
      setOpportunities(data.opportunities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [
    options.platform,
    options.profession,
    options.minBudget,
    options.maxBudget,
    options.dealType,
    options.status,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  return { opportunities, loading, error, refetch: fetchOpportunities };
}

/**
 * Hook to get a single opportunity by ID
 */
export function useOpportunity(opportunityId: string) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
        const response = await fetch(
          `${apiUrl}/api/v1/opportunities/${opportunityId}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Opportunity not found`);
        }

        const data: Opportunity = await response.json();
        setOpportunity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setOpportunity(null);
      } finally {
        setLoading(false);
      }
    };

    if (opportunityId) {
      fetchOpportunity();
    }
  }, [opportunityId]);

  return { opportunity, loading, error };
}

/**
 * Hook to get opportunities by brand
 */
export function useOpportunitiesByBrand(brandId: string, limit = 50) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
        const response = await fetch(
          `${apiUrl}/api/v1/opportunities/brand/${brandId}?limit=${limit}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch brand opportunities`);
        }

        const data: OpportunityListResponse = await response.json();
        setOpportunities(data.opportunities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      fetchOpportunities();
    }
  }, [brandId, limit]);

  return { opportunities, loading, error };
}
