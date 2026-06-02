'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export interface ThirdPartyValueskinCandidate {
  personaId: number;
  userId: number;
  name: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  followersCount: number;
  descriptor: string;
  valueskins: string[];
  primaryProfession: string | null;
  cursor: string;
}

export function useThirdPartyValueskinCandidates(search: string) {
  const [candidates, setCandidates] = useState<ThirdPartyValueskinCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void loadCandidates();
    }, 300);

    async function loadCandidates() {
      const query = search.trim().toLowerCase();
      if (query.length < 2) {
        setCandidates([]);
        setError('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      const result = await api.valueskins.search({ q: search.trim(), limit: 10 });
      if (cancelled) return;

      if (!result.data) {
        setCandidates([]);
        setError(result.error || 'Unable to search ValueSkin profiles.');
        setIsLoading(false);
        return;
      }

      const enriched = result.data.results.map((candidate) => ({
        personaId: candidate.persona_id,
        userId: candidate.user_id,
        name: candidate.name,
        handle: candidate.handle,
        avatarUrl: candidate.avatar_url,
        verified: candidate.verified,
        followersCount: candidate.followers_count,
        descriptor: candidate.descriptor,
        valueskins: candidate.professions,
        primaryProfession: candidate.primary_profession,
        cursor: candidate.cursor,
      }));

      setCandidates(enriched);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search]);

  return useMemo(
    () => ({
      candidates,
      isLoading,
      error,
    }),
    [candidates, error, isLoading]
  );
}
