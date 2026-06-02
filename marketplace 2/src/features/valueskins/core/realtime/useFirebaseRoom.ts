import { useState, useEffect } from 'react';

function normalizeCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value as Record<string, T>);
  return [];
}

function normalizeState(raw: any) {
  return {
    deals: raw?.deals && typeof raw.deals === 'object' ? raw.deals : {},
    campaigns: normalizeCollection(raw?.campaigns),
    messages: raw?.messages && typeof raw.messages === 'object' ? raw.messages : {},
    applications: normalizeCollection(raw?.applications),
    notifications: normalizeCollection(raw?.notifications),
  };
}

export const useFirebaseRoom = (userId: string | null, roomId: string | null, userId2: string) => {
  const [state, setState] = useState<any>({ deals: {}, campaigns: [], messages: {}, applications: [], notifications: [] });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('firebase_room_state');
    if (stored) {
      try {
        setState(normalizeState(JSON.parse(stored)));
      } catch (e) {
        setState({ deals: {}, campaigns: [], messages: {}, applications: [], notifications: [] });
      }
    }
  }, []);

  const createCampaign = (campaign: any) => {
    setState(prev => {
      const campaigns = normalizeCollection(prev.campaigns);
      const updated = {
        ...prev,
        campaigns: [...campaigns.filter((entry: any) => entry?.id !== campaign.id), campaign],
      };
      localStorage.setItem('firebase_room_state', JSON.stringify(updated));
      return updated;
    });
  };

  const updateDeal = (dealId: string, updates: any) => {
    setState(prev => {
      const updated = {
        ...prev,
        deals: { ...prev.deals, [dealId]: { ...prev.deals[dealId], ...updates } }
      };
      localStorage.setItem('firebase_room_state', JSON.stringify(updated));
      return updated;
    });
  };

  const addMessage = (dealId: string, message: any) => {
    setState(prev => {
      const updated = {
        ...prev,
        messages: {
          ...prev.messages,
          [dealId]: [...(prev.messages[dealId] || []), message]
        }
      };
      localStorage.setItem('firebase_room_state', JSON.stringify(updated));
      return updated;
    });
  };

  const sendNotification = (recipient: string, type: string, message: string) => {
    setState(prev => {
      const notifications = normalizeCollection(prev.notifications);
      const updated = {
        ...prev,
        notifications: [
          {
            id: Date.now(),
            recipient,
            type,
            message,
            createdAt: new Date().toISOString(),
            read: false,
          },
          ...notifications,
        ].slice(0, 100),
      };
      localStorage.setItem('firebase_room_state', JSON.stringify(updated));
      return updated;
    });
  };

  const createApplication = (application: any) => {
    setState(prev => {
      const applications = normalizeCollection(prev.applications);
      const updated = {
        ...prev,
        applications: [...applications.filter((entry: any) => entry?.id !== application.id), application],
      };
      localStorage.setItem('firebase_room_state', JSON.stringify(updated));
      return updated;
    });
  };

  return {
    state,
    syncing,
    createCampaign,
    updateDeal,
    addMessage,
    sendNotification,
    createApplication
  };
};
