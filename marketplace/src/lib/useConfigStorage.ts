import { useState, useEffect } from 'react';

const LEVELS_STORAGE_KEY = 'valueskins_levels_config';
const REPUTATION_STORAGE_KEY = 'valueskins_reputation_config';

export const DEFAULT_LEVELS = {
  1: {
    name: 'Newcomer',
    followers: 0,
    engagement: 0,
    dealValue: 0,
  },
  2: {
    name: 'Rising Creator',
    followers: 10000,
    engagement: 2,
    dealValue: 500,
  },
  3: {
    name: 'Established Creator',
    followers: 50000,
    engagement: 3.5,
    dealValue: 5000,
  },
  4: {
    name: 'Top Tier Creator',
    followers: 250000,
    engagement: 5,
    dealValue: 25000,
  },
  5: {
    name: 'Elite Creator',
    followers: 1000000,
    engagement: 7,
    dealValue: 100000,
  },
};

export const DEFAULT_REPUTATION_FACTORS = [
  { name: 'Deal Completion Rate', weight: 25, maxPoints: 250 },
  { name: 'On-Time Delivery', weight: 20, maxPoints: 200 },
  { name: 'Brand Ratings', weight: 20, maxPoints: 200 },
  { name: 'Engagement Quality', weight: 15, maxPoints: 150 },
  { name: 'Creator Level', weight: 10, maxPoints: 100 },
  { name: 'Community Contribution', weight: 10, maxPoints: 100 },
];

export function useLevelConfig() {
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage on client side
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LEVELS_STORAGE_KEY);
      if (stored) {
        try {
          setLevels(JSON.parse(stored));
        } catch (e) {
          setLevels(DEFAULT_LEVELS);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  const updateLevels = (newLevels: typeof DEFAULT_LEVELS) => {
    setLevels(newLevels);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(newLevels));
    }
  };

  return { levels, updateLevels, isLoaded };
}

export function useReputationConfig() {
  const [factors, setFactors] = useState(DEFAULT_REPUTATION_FACTORS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage on client side
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(REPUTATION_STORAGE_KEY);
      if (stored) {
        try {
          setFactors(JSON.parse(stored));
        } catch (e) {
          setFactors(DEFAULT_REPUTATION_FACTORS);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  const updateFactors = (newFactors: typeof DEFAULT_REPUTATION_FACTORS) => {
    setFactors(newFactors);
    if (typeof window !== 'undefined') {
      localStorage.setItem(REPUTATION_STORAGE_KEY, JSON.stringify(newFactors));
    }
  };

  return { factors, updateFactors, isLoaded };
}
