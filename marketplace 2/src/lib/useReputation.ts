import { useState, useEffect } from 'react';

export interface ReputationScore {
  score: number; // 0-100
  risk_tier: string; // A, B, C, D
  on_time_rate: number; // 0-1.0
  avg_rating: number; // 0-5.0
  response_score: number; // 0-1.0
  revision_efficiency: number; // 0-1.0
  repeat_brand_rate: number; // 0-1.0
  max_deal_size: number; // USD
  completed_deals: number;
  dispute_count: number;
}

/**
 * Hook to get real creator reputation score
 * Replaces hardcoded MOCK_REPUTATION values
 * Calculates from actual deal history
 */
export function useReputation(creatorId: string) {
  const [reputation, setReputation] = useState<ReputationScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReputation = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.valueskins.com';
        const response = await fetch(
          `${apiUrl}/api/v1/creators/${creatorId}/reputation`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch reputation: ${response.statusText}`);
        }

        const data: ReputationScore = await response.json();
        setReputation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Return neutral reputation on error instead of null
        setReputation({
          score: 50,
          risk_tier: 'C',
          on_time_rate: 0.5,
          avg_rating: 2.5,
          response_score: 0.5,
          revision_efficiency: 0.5,
          repeat_brand_rate: 0.0,
          max_deal_size: 0,
          completed_deals: 0,
          dispute_count: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchReputation();
    }
  }, [creatorId]);

  return { reputation, loading, error };
}

/**
 * Helper to get color for reputation tier
 */
export function getTierColor(tier: string): string {
  switch (tier) {
    case 'A':
      return '#10b981'; // green
    case 'B':
      return '#3b82f6'; // blue
    case 'C':
      return '#f59e0b'; // amber
    case 'D':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Helper to get score interpretation
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}
