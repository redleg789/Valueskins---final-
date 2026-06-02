/**
 * Hook that syncs real-time updates into deal state
 * When another device updates a deal/campaign, this hook broadcasts it locally
 */

import { useEffect, useCallback } from 'react';
import { useRealtime, RealtimeMessage } from './realtime-client';
import { useDealSync, type DealState, type Campaign, type SharedApplication } from '@/features/valueskins/core/deals/useDealSync';

export function useRealtimeSync(userId: number) {
  const { isConnected, subscribe } = useRealtime(userId);
  const {
    setDealStates,
    setCampaigns,
    setApplications,
  } = useDealSync();

  // Handle deal_created event
  useEffect(() => {
    const unsubscribe = subscribe('deal_created', (msg: RealtimeMessage) => {
      console.log('[RealtimeSync] Deal created:', msg.data);
      const deal: DealState = msg.data as DealState;
      if (deal) {
        setDealStates(prev => ({
          ...prev,
          [msg.data.dealKey || `deal_${Date.now()}`]: deal,
        }));
      }
    });
    return unsubscribe;
  }, [subscribe, setDealStates]);

  // Handle deal_updated event
  useEffect(() => {
    const unsubscribe = subscribe('deal_updated', (msg: RealtimeMessage) => {
      console.log('[RealtimeSync] Deal updated:', msg.data);
      const { dealKey, updates } = msg.data as {
        dealKey: string;
        updates: Partial<DealState>;
      };
      if (dealKey) {
        setDealStates(prev => ({
          ...prev,
          [dealKey]: {
            ...prev[dealKey],
            ...updates,
          },
        }));
      }
    });
    return unsubscribe;
  }, [subscribe, setDealStates]);

  // Handle campaign_created event
  useEffect(() => {
    const unsubscribe = subscribe('campaign_created', (msg: RealtimeMessage) => {
      console.log('[RealtimeSync] Campaign created:', msg.data);
      const campaign: Campaign = msg.data as Campaign;
      if (campaign) {
        setCampaigns(prev => [...prev, campaign]);
      }
    });
    return unsubscribe;
  }, [subscribe, setCampaigns]);

  // Handle campaign_updated event
  useEffect(() => {
    const unsubscribe = subscribe('campaign_updated', (msg: RealtimeMessage) => {
      console.log('[RealtimeSync] Campaign updated:', msg.data);
      const { campaignId, updates } = msg.data as {
        campaignId: number;
        updates: Partial<Campaign>;
      };
      if (campaignId) {
        setCampaigns(prev =>
          prev.map(c =>
            c.id === campaignId ? { ...c, ...updates } : c
          )
        );
      }
    });
    return unsubscribe;
  }, [subscribe, setCampaigns]);

  // Handle application_received event
  useEffect(() => {
    const unsubscribe = subscribe('application_received', (msg: RealtimeMessage) => {
      console.log('[RealtimeSync] Application received:', msg.data);
      const app: SharedApplication = msg.data as SharedApplication;
      if (app) {
        setApplications(prev => [...prev, app]);
      }
    });
    return unsubscribe;
  }, [subscribe, setApplications]);

  return { isConnected };
}
