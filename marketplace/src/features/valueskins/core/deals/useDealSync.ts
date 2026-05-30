/**
 * ARCHITECTURE: See ARCHITECTURE_GUIDE.txt for codebase overview
 * FILE PURPOSE: Core state management hook for deal negotiation
 * ROLE IN SYSTEM: Central place where all deal data lives (offers, scripts, chat, etc)
 * WHAT IT DOES:
 *   - Manages deal state using React hooks
 *   - Syncs with localStorage (offline support)
 *   - Syncs with Firebase (real-time notifications)
 *   - Syncs across browser tabs via BroadcastChannel
 * CONSUMED BY: instagram/page.tsx, tiktok/page.tsx, youtube/page.tsx, linkedin/page.tsx
 *
 * Deal synchronization hook — bridges localStorage state with backend API.
 *
 * Strategy:
 * 1. On mount, attempt to load deal rooms from backend API
 * 2. If backend is reachable, use it as source of truth and sync to localStorage
 * 3. If backend is unreachable, fall back to localStorage (offline mode)
 * 4. All mutations attempt API first, then update localStorage
 * 5. BroadcastChannel keeps multiple tabs in sync
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

// ---- Types matching the demo page's DealState ----

export type DealRoomPhase = 'brief' | 'offer' | 'pending' | 'counter' | 'brand_considering' | 'brand_countered' | 'brand_rejected' | 'brand_reviewing' | 'last_offer' | 'rejected' | 'chatroom' | 'formal_offer' | 'checklist' | 'accepted' | 'softhold';

export type PaymentMilestoneStatus = 'pending' | 'released';

export type DealState = {
  phase: DealRoomPhase;
  intent: 'explore' | 'campaign' | 'long-term';
  briefFilled: boolean;
  briefTitle: string;
  offerAmount: string;
  counterAmount: string;
  brandResponseAmount: string; // amount brand counter-offered back after creator countered
  agreementAmount?: string; // final agreed amount after negotiation
  chatMessages: ChatMessage[];
  chatInput: string;
  performanceClause: boolean;
  advancePercent: number;
  uploadPercent: number;
  approvalPercent: number;
  // Payment milestone tracking — synced real-time
  paymentMilestones?: Record<'advance' | 'upload' | 'approval', PaymentMilestoneStatus>;
  creatorDealLifecycle?: 'checklist' | 'scripting' | 'deliverables' | 'submitted' | 'approved'; // Creator side
  // Script workflow: both parties negotiate, edit, and approve script before deliverables
  scriptMode?: 'non_negotiable' | 'discussion' | 'creator_freedom';
  brandScriptText?: string; // Non-negotiable mode: fixed script from brand
  scriptDraft?: string; // Current working script (real-time edits)
  scriptVersion?: number; // Incremented each time a revision is submitted
  scriptStatus?: 'draft' | 'submitted' | 'pending_revision' | 'approved'; // Approval state
  scriptFeedback?: string; // Revision feedback from approver
  scriptApprovedAt?: string; // ISO timestamp when both parties approved
  creatorScriptApproved?: boolean; // Creator clicked "I approve"
  brandScriptApproved?: boolean; // Brand clicked "I approve"
  scriptVersionHistory?: Array<{
    version: number;
    text: string;
    editedBy: 'creator' | 'brand';
    editedAt: string; // ISO timestamp
    reason?: string; // Why they edited (optional)
  }>;
  // Webhook simulation logs (MVP)
  publishEvents?: Array<{ id: number; type: 'video_published' | 'milestone_released'; message: string; at: string }>;
  deliverableStatuses?: Record<number, 'pending' | 'linking' | 'uploaded' | 'approved'>; // Per-deliverable status
  // Brand-side state — persisted so role-switching preserves progress
  brandPhase?: string;          // BrandDealPhase
  brandApprovalPhase?: string;  // BrandApprovalPhase
  formalOfferSentByCreator?: boolean;
  deliverableLinks?: Record<number, string>; // Instagram URLs per deliverable index
  // Backend IDs — populated when synced with API
  backendDealRoomId?: number;
  backendLastMessageId?: number;
  // Deal type differentiation — determines workflow (escrow vs goods vs content tracking)
  dealType?: 'paid' | 'barter' | 'c2c_paid' | 'c2c_collab';
  type?: string; // Generic type field for deal display
  // Barter-only: goods lifecycle and tracking number
  goodsTrackerStatus?: 'goods_preparing' | 'goods_shipped' | 'goods_delivered' | 'content_due' | 'content_submitted' | 'content_approved';
  goodsTrackingNumber?: string;
  // C2C collab (unpaid) only: content lifecycle
  c2cContentStatus?: 'content_creating' | 'content_submitted' | 'content_approved';
  // International deal flags and compliance acknowledgments
  isInternationalDeal?: boolean;
  customsComplianceAcknowledged?: boolean;
  // Escrow state — synced between brand (funder) and creator (receiver)
  escrowFunded?: boolean;
  // Payment milestone tracking — which stages have been released to creator
  milestoneAdvanceReleased?: boolean;
  milestoneUploadReleased?: boolean;
  milestoneApprovalReleased?: boolean;
  // Tip system — brand can tip after deal completion
  tipsReceived?: Array<{ amount: string; from: string; timestamp: string; message?: string }>;
  // Dispute tracking
  disputes?: Array<{
    id: number;
    type: 'late_delivery' | 'quality_issue' | 'payment' | 'other';
    description: string;
    filledBy: 'creator' | 'brand';
    timestamp: string;
    status: 'open' | 'resolved';
  }>;
  // Point of Contact — set at campaign creation, shown to both parties
  poc?: { name: string; contactHandle: string; role: string };
  // Campaign linkage — connects deal to its originating campaign for Sent Deals tracking
  campaignId?: number;
  campaignTitle?: string;
  // Deal context — ensures both parties can find the same deal
  // creatorName|creatorSkin is the deal key itself, but we also store context for reference
  creatorMarketplaceIndex?: number; // BRAND_MARKETPLACE_CREATORS array index
  opportunityIndex?: number;        // activeOpportunities array index (creator side)
  creatorName?: string;             // Name of creator from BRAND_MARKETPLACE_CREATORS
  creatorSkin?: string;             // ValueSkin (profession) of creator
  // Ratings and reviews — both sides rate each other after deal completion
  creatorRating?: number;           // 1-5 stars from creator to brand
  creatorRatingComment?: string;    // Creator's review comment
  displayCreatorRating?: boolean;   // Creator chose to show on profile
  brandRating?: number;             // 1-5 stars from brand to creator
  brandRatingComment?: string;      // Brand's review comment
  displayBrandRating?: boolean;     // Brand chose to show on profile
};

export type ChatMessage = {
  id: number;
  sender: 'me' | 'brand' | 'creator';
  text: string;
  time: string;       // display time (e.g. "2:34 PM")
  isoTime: string;    // full ISO timestamp for audit log (e.g. "2026-03-18T14:34:07.421Z")
  seen?: boolean;
  seenAt?: string;    // ISO timestamp of when the other party opened/read the message
};

// A single entry in the deal's immutable event ledger
export type DealEvent = {
  id: number;
  type: 'offer_sent' | 'offer_received' | 'counter_sent' | 'counter_received' | 'accepted' | 'rejected' | 'message_sent' | 'message_seen' | 'deal_signed' | 'content_submitted' | 'content_approved' | 'payment_released';
  actor: 'creator' | 'brand' | 'system';
  label: string;       // human-readable description
  isoTime: string;     // ISO timestamp
  hash: string;        // SHA-256 of (prevHash + type + actor + isoTime + label) — chain integrity
};

export type SharedApplication = {
  id: number;
  campaignId: number;
  campaignTitle: string;
  creatorProfession: string;
  creatorHandle: string;
  status: 'pending' | 'accepted' | 'rejected' | 'invited';
  appliedAt: string;
  opportunityIndex?: number; // Index in activeOpportunities for deal key lookup
  // Creator insights — visible to brand when reviewing application
  creatorName?: string;
  creatorFollowers?: string;
  creatorEngagement?: string;
  creatorLevel?: number;
  creatorMatchScore?: string;
  creatorRate?: string;
  creatorDealCompletionRate?: number;
  creatorPortfolio?: string[];
  creatorAudienceLocation?: string;
  creatorAudienceAge?: string;
  creatorResponseTimeHrs?: number;
  creatorInstagramUrl?: string;
  creatorWebsiteUrl?: string;
};

export type Campaign = {
  id: number;
  brandName?: string;
  brandProfession: string;
  title: string;
  description: string;
  about?: string;
  requiredProfessions: string[];
  minLevel: number;
  maxLevel: number;
  budget: string;
  deadline: string;
  location: string;
  nonNegotiables: string[];
  deliverables: string;
  compensationType?: string;
  exclusivity?: string;
  usageRights?: string;
  revisionLimit?: number;
  audienceTarget?: string;
  requirements?: string[];
  scriptMode?: 'non_negotiable' | 'discussion' | 'creator_freedom';
  scriptText?: string;
  allowContentApprovalPayment?: boolean; // If true, brand must approve content for final 30% payout
  status: 'open' | 'closed' | 'expired';
  applicants: number;
  creatorCount?: number;       // how many creators brand intends to hire
  escrowFunded?: boolean;      // brand has deposited total escrow
  escrowPool?: number;         // total amount deposited (budget × creatorCount)
  escrowAllocated?: number;    // amount allocated to accepted deals so far
  // Point of Contact for this campaign — set at creation, visible in all deal rooms
  poc?: { name: string; contactHandle: string; role: string };
};

// ---- Storage keys ----
const STORAGE_DEALS = 'vs_demo_deal_states';
const STORAGE_APPLICATIONS = 'vs_demo_applications';
const STORAGE_CAMPAIGNS = 'vs_demo_campaigns';
const BC_NAME = 'vs_demo_sync';
const STORAGE_VERSION_KEY = 'vs_demo_data_version';
const CURRENT_DATA_VERSION = '4'; // bump to clear old mock data

// One-time purge of stale mock data from previous sessions
if (typeof window !== 'undefined') {
  const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
  if (storedVersion !== CURRENT_DATA_VERSION) {
    localStorage.removeItem(STORAGE_DEALS);
    localStorage.removeItem(STORAGE_APPLICATIONS);
    localStorage.removeItem(STORAGE_CAMPAIGNS);
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_DATA_VERSION);
  }
}

// ---- Backend connectivity check ----
let backendOnline: boolean | null = null;
let lastCheck = 0;
const CHECK_INTERVAL = 30_000; // re-check every 30s

async function isBackendOnline(): Promise<boolean> {
  const now = Date.now();
  if (backendOnline !== null && now - lastCheck < CHECK_INTERVAL) {
    return backendOnline;
  }
  try {
    const res = await api.system.health();
    backendOnline = !res.error;
  } catch {
    backendOnline = false;
  }
  lastCheck = now;
  return backendOnline ?? false;
}

// ---- localStorage helpers ----
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded — safe to ignore */ }
}

function broadcastSync(): void {
  try {
    new BroadcastChannel(BC_NAME).postMessage('sync');
  } catch { /* unsupported — safe to ignore */ }
}

// ---- Main hook ----

export function useDealSync() {
  const [dealStates, setDealStates] = useState<Record<string, DealState>>({});
  const [applications, setApplications] = useState<SharedApplication[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const syncInProgress = useRef(false);

  // Initial load — try backend, fall back to localStorage
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const backendUp = await isBackendOnline();
      if (cancelled) return;
      setOnline(backendUp);

      if (backendUp) {
        // Try to load deal rooms from backend
        try {
          const roomsRes = await api.dealRooms.listMyRooms();
          if (!cancelled && roomsRes.data?.deal_rooms) {
            const backendDeals: Record<string, DealState> = {};
            for (const room of roomsRes.data.deal_rooms) {
              const key = `${room.opportunity_title || 'deal'}:${room.id}`;
              backendDeals[key] = {
                phase: mapStatusToPhase(room.status),
                intent: 'campaign',
                briefFilled: true,
                briefTitle: room.opportunity_title || '',
                offerAmount: '',
                counterAmount: '',
                brandResponseAmount: '',
                chatMessages: [],
                chatInput: '',
                performanceClause: false,
                advancePercent: 30,
                uploadPercent: 40,
                approvalPercent: 30,
                backendDealRoomId: room.id,
              };
            }
            // Merge with localStorage (localStorage has UI state not in backend)
            const localDeals = loadFromStorage<Record<string, DealState>>(STORAGE_DEALS, {});
            const merged = { ...localDeals, ...backendDeals };
            setDealStates(merged);
            saveToStorage(STORAGE_DEALS, merged);
          }
        } catch {
          // Backend returned error — load from localStorage
          setDealStates(loadFromStorage(STORAGE_DEALS, {}));
        }

        // Try to load applications from backend
        try {
          const appsRes = await api.marketplace.getMyApplications();
          if (!cancelled && appsRes.data?.applications) {
            const backendApps: SharedApplication[] = appsRes.data.applications.map(a => ({
              id: a.id,
              campaignId: a.opportunity_id,
              campaignTitle: a.opportunity_title || '',
              creatorProfession: '',
              creatorHandle: a.username || '',
              status: (a.status === 'applied' ? 'pending' : a.status) as SharedApplication['status'],
              appliedAt: a.created_at || new Date().toISOString(),
            }));
            const localApps = loadFromStorage<SharedApplication[]>(STORAGE_APPLICATIONS, []);
            // Merge: backend wins for matching IDs, keep local-only entries
            const backendIds = new Set(backendApps.map(a => a.id));
            const localOnly = localApps.filter(a => !backendIds.has(a.id));
            const merged = [...backendApps, ...localOnly];
            setApplications(merged);
            saveToStorage(STORAGE_APPLICATIONS, merged);
          }
        } catch {
          setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
        }
      } else {
        // Offline mode — load everything from localStorage
        setDealStates(loadFromStorage(STORAGE_DEALS, {}));
        setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
      }

      setCampaigns(loadFromStorage(STORAGE_CAMPAIGNS, []));
      if (!cancelled) setLoaded(true);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Persist deals to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_DEALS, dealStates);
    broadcastSync();
  }, [dealStates, loaded]);

  // Persist applications to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_APPLICATIONS, applications);
    broadcastSync();
  }, [applications, loaded]);

  // Persist campaigns to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_CAMPAIGNS, campaigns);
    broadcastSync();
  }, [campaigns, loaded]);

  // Listen for cross-tab sync
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = () => {
        setDealStates(loadFromStorage(STORAGE_DEALS, {}));
        setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
        setCampaigns(loadFromStorage(STORAGE_CAMPAIGNS, []));
      };
    } catch { /* unsupported */ }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_DEALS) setDealStates(loadFromStorage(STORAGE_DEALS, {}));
      if (e.key === STORAGE_APPLICATIONS) setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
      if (e.key === STORAGE_CAMPAIGNS) setCampaigns(loadFromStorage(STORAGE_CAMPAIGNS, []));
    };
    window.addEventListener('storage', onStorage);
    return () => {
      bc?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // ---- Deal state helpers ----

  const getOrCreateDeal = useCallback((key: string): DealState => {
    return dealStates[key] ?? {
      phase: 'brief' as const,
      intent: 'campaign' as const,
      briefFilled: false,
      briefTitle: '',
      offerAmount: '',
      counterAmount: '',
      brandResponseAmount: '',
      chatMessages: [
        { id: 1, sender: 'brand' as const, text: 'Hey! Excited to work together on this campaign.', time: 'just now', isoTime: new Date().toISOString(), seen: false },
      ],
      chatInput: '',
      performanceClause: false,
      advancePercent: 70,
      uploadPercent: 0,
      approvalPercent: 0,
      dealType: undefined,
      goodsTrackerStatus: undefined,
      goodsTrackingNumber: undefined,
      c2cContentStatus: undefined,
      isInternationalDeal: false,
      customsComplianceAcknowledged: false,
      poc: undefined,
    };
  }, [dealStates]);

  const updateDeal = useCallback((key: string, patch: Partial<DealState>) => {
    setDealStates(prev => {
      const existing = prev[key] ?? {
        phase: 'brief' as const,
        intent: 'campaign' as const,
        briefFilled: false,
        briefTitle: '',
        offerAmount: '',
        counterAmount: '',
        chatMessages: [
          { id: 1, sender: 'brand' as const, text: 'Hey! Excited to work together on this campaign.', time: 'just now', isoTime: new Date().toISOString(), seen: false },
        ],
        chatInput: '',
        performanceClause: false,
        advancePercent: 70,
        uploadPercent: 0,
        approvalPercent: 0,
        dealType: undefined,
        goodsTrackerStatus: undefined,
        goodsTrackingNumber: undefined,
        c2cContentStatus: undefined,
        isInternationalDeal: false,
        customsComplianceAcknowledged: false,
        poc: undefined,
      };
      return { ...prev, [key]: { ...existing, ...prev[key], ...patch } };
    });
  }, []);

  // ---- API-backed mutations ----

  /** Open a deal room — tries backend first, falls back to localStorage-only */
  const openDealRoom = useCallback(async (
    key: string,
    creatorPersonaId: number,
    briefData: {
      intent: string;
      title: string;
      description: string;
      deliverables: string;
      campaignType: string;
      compensationType?: string;
    }
  ) => {
    const backendUp = await isBackendOnline();

    if (backendUp) {
      try {
        const res = await api.dealRooms.openDealRoom({
          creator_persona_id: creatorPersonaId,
          intent: briefData.intent,
          brief_title: briefData.title,
          brief_description: briefData.description,
          brief_deliverables: briefData.deliverables,
          brief_campaign_type: briefData.campaignType,
          compensation_type: briefData.compensationType,
        });
        if (res.data?.deal_room_id) {
          updateDeal(key, {
            phase: 'offer',
            intent: briefData.intent as DealState['intent'],
            briefFilled: true,
            briefTitle: briefData.title,
            backendDealRoomId: res.data.deal_room_id,
          });
          return res.data.deal_room_id;
        }
      } catch { /* fall through to localStorage */ }
    }

    // Offline fallback
    updateDeal(key, {
      phase: 'offer',
      intent: briefData.intent as DealState['intent'],
      briefFilled: true,
      briefTitle: briefData.title,
    });
    return null;
  }, [updateDeal]);

  /** Send a chat message — tries backend first, always updates localStorage */
  const sendMessage = useCallback(async (
    key: string,
    text: string,
    sender: 'me' | 'brand' = 'me'
  ) => {
    const deal = dealStates[key];
    const backendRoomId = deal?.backendDealRoomId;
    const newMsg: ChatMessage = {
      id: Date.now(),
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isoTime: new Date().toISOString(),
      seen: false,
    };

    // Update locally immediately (optimistic)
    setDealStates(prev => {
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          chatMessages: [...existing.chatMessages, newMsg],
          chatInput: '',
        },
      };
    });

    // Try backend
    if (backendRoomId) {
      try {
        await api.dealRooms.sendMessage(backendRoomId, text, 'text');
      } catch { /* message saved locally, will sync later */ }
    }
  }, [dealStates]);

  /** Make an offer — tries backend, falls back to local */
  const makeOffer = useCallback(async (
    key: string,
    amountCents: number,
    note?: string
  ) => {
    const deal = dealStates[key];
    const backendRoomId = deal?.backendDealRoomId;

    if (backendRoomId) {
      try {
        const res = await api.marketplace.postMessage(backendRoomId, {
          content: `Offer: $${(amountCents / 100).toFixed(0)}${note ? ` - ${note}` : ''}`,
          message_type: 'offer_made',
        });
        if (res.data) {
          updateDeal(key, { phase: 'counter', offerAmount: String(amountCents / 100) });
          return;
        }
      } catch { /* fall through */ }
    }

    // Offline fallback
    updateDeal(key, { phase: 'counter', offerAmount: String(amountCents / 100) });
  }, [dealStates, updateDeal]);

  /** Submit application — tries backend first */
  const submitApplication = useCallback(async (
    opportunityId: number,
    personaId: number,
    pitch: string,
    appData: Omit<SharedApplication, 'id'>
  ) => {
    const backendUp = await isBackendOnline();
    let appId = Date.now();

    if (backendUp) {
      try {
        const res = await api.marketplace.applyToOpportunity(opportunityId, personaId, pitch);
        if (res.data?.application_id) {
          appId = res.data.application_id;
        }
      } catch { /* fall through to localStorage */ }
    }

    const newApp: SharedApplication = { ...appData, id: appId };
    setApplications(prev => [...prev, newApp]);
  }, []);

  /** Accept application (brand side) — tries backend first */
  const acceptApplication = useCallback(async (
    applicationId: number,
    opportunityId: number,
    personaId: number
  ) => {
    const backendUp = await isBackendOnline();

    if (backendUp) {
      try {
        await api.brand.acceptApplication(opportunityId, personaId);
      } catch { /* fall through */ }
    }

    setApplications(prev =>
      prev.map(a => a.id === applicationId ? { ...a, status: 'accepted' as const } : a)
    );
  }, []);

  /** Create campaign (brand side) — tries backend first */
  const createCampaign = useCallback(async (campaign: Omit<Campaign, 'id'>) => {
    const backendUp = await isBackendOnline();
    let campId = Date.now();

    if (backendUp) {
      try {
        const res = await api.brand.createOpportunity({
          title: campaign.title,
          description: campaign.description,
          category: campaign.brandProfession,
          required_profession_id: 0,
          required_level: campaign.minLevel,
          reward_amount: campaign.budget,
          duration_days: 30,
        });
        if (res.data?.opportunity_id) {
          campId = res.data.opportunity_id;
        }
      } catch { /* fall through */ }
    }

    const newCampaign: Campaign = { ...campaign, id: campId };
    setCampaigns(prev => [...prev, newCampaign]);
  }, []);

  /** Finalize deal — tries backend first */
  const finalizeDeal = useCallback(async (key: string) => {
    const deal = dealStates[key];
    const backendRoomId = deal?.backendDealRoomId;

    if (backendRoomId) {
      try {
        await api.dealRooms.finalizeDeal(backendRoomId, 'Deal completed');
      } catch { /* fall through */ }
    }

    updateDeal(key, { phase: 'accepted' });
  }, [dealStates, updateDeal]);

  /** Background sync — periodically pushes local state to backend */
  const syncToBackend = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      const backendUp = await isBackendOnline();
      if (!backendUp) return;
      setOnline(true);

      // Sync deals that have local state but no backend ID
      for (const [key, deal] of Object.entries(dealStates)) {
        if (deal.backendDealRoomId || deal.phase === 'brief') continue;

        // This deal exists locally but not on backend — create it
        try {
          const res = await api.dealRooms.openDealRoom({
            creator_persona_id: 1, // placeholder — real ID needed
            intent: deal.intent,
            brief_title: deal.briefTitle || key.split(':')[0],
            brief_description: 'Synced from local state',
            brief_deliverables: '',
            brief_campaign_type: 'Product Review',
          });
          if (res.data?.deal_room_id) {
            updateDeal(key, { backendDealRoomId: res.data.deal_room_id });
          }
        } catch { /* skip this deal */ }
      }
    } finally {
      syncInProgress.current = false;
    }
  }, [dealStates, updateDeal]);

  // Run background sync every 60 seconds
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(syncToBackend, 60_000);
    return () => clearInterval(interval);
  }, [loaded, syncToBackend]);

  return {
    // State
    dealStates,
    setDealStates,
    applications,
    setApplications,
    campaigns,
    setCampaigns,
    loaded,
    online,

    // Deal helpers
    getOrCreateDeal,
    updateDeal,

    // API-backed mutations
    openDealRoom,
    sendMessage,
    makeOffer,
    submitApplication,
    acceptApplication,
    createCampaign,
    finalizeDeal,
    syncToBackend,
  };
}

// ---- Helpers ----

function mapStatusToPhase(status: string): DealRoomPhase {
  switch (status) {
    case 'active': return 'chatroom';
    case 'accepted': return 'accepted';
    case 'completed': return 'accepted';
    case 'cancelled':
    case 'expired':
    case 'rejected': return 'brief';
    default: return 'brief';
  }
}
