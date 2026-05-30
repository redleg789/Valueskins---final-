'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from './professions';

export interface PlatformContextType {
  activePlatform: Platform;
  setPlatform: (platform: Platform) => void;
  availablePlatforms: Platform[];
  isAcrossModeAvailable: boolean;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [activePlatform, setActivePlatform] = useState<Platform>('meta');
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('valueskins_platform');
    if (saved && ['meta', 'linkedin', 'youtube', 'across'].includes(saved)) {
      setActivePlatform(saved as Platform);
    }
    setMounted(true);
  }, []);

  const handleSetPlatform = (platform: Platform) => {
    setActivePlatform(platform);
    localStorage.setItem('valueskins_platform', platform);
  };

  const value: PlatformContextType = {
    activePlatform: mounted ? activePlatform : 'meta',
    setPlatform: handleSetPlatform,
    availablePlatforms: ['meta', 'linkedin', 'youtube', 'across'] as Platform[],
    isAcrossModeAvailable: activePlatform === 'across',
  };

  if (!mounted) return <>{children}</>;

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextType {
  const context = useContext(PlatformContext);
  if (!context) {
    // Return default value for SSR/prerendering
    return {
      activePlatform: 'meta',
      setPlatform: () => {},
      availablePlatforms: ['meta', 'linkedin', 'youtube', 'across'],
      isAcrossModeAvailable: false,
    };
  }
  return context;
}
