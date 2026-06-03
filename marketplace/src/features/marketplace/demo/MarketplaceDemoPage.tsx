'use client';
// ARCHITECTURE: See ARCHITECTURE_GUIDE.txt for codebase overview
// FILE PURPOSE: Creator-Brand Marketplace demo page - shows creator & brand workflow
// ROLE IN SYSTEM: Frontend UI component that displays marketplace, deals, chat, script negotiation
// DATA SOURCE: useDealSync.ts (local state) + api.ts (backend calls) + Firebase (real-time)
// OUTPUT: Interactive UI where creators browse offers and negotiate with brands

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useLevelConfig, useReputationConfig } from '@/lib/useConfigStorage';
import { useDealSync, type DealState, type DealRoomPhase, type SharedApplication, type Campaign, type ChatMessage } from '@/features/valueskins/core/deals/useDealSync';
import { useFirebaseRoom } from '@/features/valueskins/core/realtime/useFirebaseRoom';
import { autoMatchCreators, type AutoMatchResult } from '@/lib/autoMatch';
import EventManagementPage from '@/features/events/EventManagementPage';
import { sendAutoMatchNotifications } from '@/lib/autoMatchNotifications';
import {
  type ValueSkinMap,
  type ValueSkinSlot,
  SLOT_LABELS,
  SLOT_COLORS,
  ValueSkinStickers,
  ValueskinAvatarToggle,
  ProfilePhotoWithLongPress,
  PROFESSION_BADGES,
  defaultAboutMe,
} from '@/features/valueskins/core/identity/AvatarOptions';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';
import { TimelineView, DeliverablesView, InvoiceView, ContractView } from '@/components/DealPhaseExtensions';

/** Get sticker image path for any profession — checks PROFESSION_BADGES first, then auto-generated manifest */
function getStickerForProfession(profession: string): string | undefined {
  return PROFESSION_BADGES[profession]?.stickerImage || STICKER_MANIFEST[profession];
}

const C = { // Marketplace neutral theme
  primary: '#2563EB',
  primaryGradient: 'linear-gradient(135deg, #2563EB, #1e40af)',
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  card: '#f3f4f6',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  // Semantic — use these instead of random hex colors
  success: '#00D46A',
  successBg: 'rgba(0,212,106,0.08)',
  successBorder: 'rgba(0,212,106,0.25)',
  warning: '#FFAB00',
  warningBg: 'rgba(255,171,0,0.08)',
  warningBorder: 'rgba(255,171,0,0.25)',
  danger: '#ED4956',
  dangerBg: 'rgba(237,73,86,0.08)',
  dangerBorder: 'rgba(237,73,86,0.25)',
  accent: '#3B82F6',
  accentBg: 'rgba(59,130,246,0.08)',
  accentBorder: 'rgba(59,130,246,0.25)',
};

// ---- Deal type helpers ----

function resolveDealType(compensationType: string): DealState['dealType'] {
  const ct = (compensationType || '').toLowerCase();
  if (ct.includes('barter') || ct.includes('gifted') || ct.includes('product')) return 'barter';
  return 'paid';
}

function isInternationalDeal(creatorLocation: string, campaignLocation: string): boolean {
  if (!campaignLocation || ['remote','global','worldwide',''].includes(campaignLocation.toLowerCase())) return false;
  return creatorLocation.toLowerCase() !== campaignLocation.toLowerCase();
}

const DEAL_LABELS = {
  paid:       { proposer: 'Brand', receiver: 'Creator' },
  barter:     { proposer: 'Brand', receiver: 'Creator' },
  c2c_paid:   { proposer: 'Proposer', receiver: 'Collaborator' },
  c2c_collab: { proposer: 'Initiator', receiver: 'Collaborator' },
} as const;

const PROFESSIONS = {
  'Fashion':        { name: 'Fashion',        subProfessions: ['Fashion Influencer','Stylist','Fashion Designer','Model','Personal Shopper','Fashion Photographer','Streetwear Creator','Sustainable Fashion Advocate'] },
  'Beauty':         { name: 'Beauty',         subProfessions: ['Makeup Artist','Skincare Specialist','Hair Stylist','Nail Artist','Beauty Reviewer','Fragrance Enthusiast','Esthetician','Beauty Educator'] },
  'Travel':         { name: 'Travel',         subProfessions: ['Travel Blogger','Adventure Creator','Luxury Travel','Budget Travel','Solo Travel','Travel Photographer','Digital Nomad','Hotel Reviewer'] },
  'Food & Beverage':{ name: 'Food & Beverage',subProfessions: ['Chef','Food Photographer','Recipe Creator','Restaurant Reviewer','Pastry Chef','Nutritionist','Food Stylist','Culinary Student'] },
  'Fitness':        { name: 'Fitness',        subProfessions: ['Personal Trainer','Yoga Instructor','Fitness Coach','CrossFit Athlete','Pilates Instructor','Bodybuilder','Marathon Runner','Sports Nutritionist'] },
  'Lifestyle':      { name: 'Lifestyle',      subProfessions: ['Lifestyle Blogger','Minimalist','Wellness Coach','Self-Care Advocate','Productivity Creator','Journal Creator','Morning Routine Creator','Slow Living Advocate'] },
  'Photography':    { name: 'Photography',    subProfessions: ['Portrait Photographer','Street Photographer','Landscape Photographer','Product Photographer','Wedding Photographer','Drone Photographer','Photo Editor','Analog Film Creator'] },
  'Interior Design':{ name: 'Interior Design',subProfessions: ['Interior Designer','Home Decor Creator','DIY Home','Minimalist Home','Plant Parent','Organization Expert','Furniture Designer','Renovation Creator'] },
  'Technology':     { name: 'Technology',     subProfessions: ['Software Engineer','Full Stack Developer','Data Scientist','Product Manager','DevOps Engineer','UX/UI Designer','Tech Entrepreneur','AI/ML Specialist'] },
  'Entertainment':  { name: 'Entertainment',  subProfessions: ['Actor','Comedian','Musician','Producer','Director','Screenwriter','Animator','Voice Actor','Podcast Host','DJ','Streamer','Stunt Performer'] },
  'Sports':         { name: 'Sports',         subProfessions: ['Professional Athlete','Fitness Coach','Sports Coach','Yoga Instructor','Nutritionist','Sports Analyst','Personal Trainer','Physical Therapist'] },
  'Business':       { name: 'Business',       subProfessions: ['CEO','Entrepreneur','Consultant','Sales Manager','HR Manager','Operations Manager','Marketing Manager','Business Analyst'] },
};

// Creator data is now fetched from backend via /api/creators/match
// No hardcoded creators - all creator data comes from the backend API
const BRAND_MARKETPLACE_CREATORS: any[] = [];

const BRAND_CATEGORIES: Record<string, { name: string; subCategories: string[] }> = {
  'Company Size':  { name: 'Company Size',  subCategories: ['Startup', 'SMB', 'Mid-Market', 'Enterprise', 'Agency', 'Solo Brand', 'Non-Profit', 'Government'] },
  'Campaign Type': { name: 'Campaign Type', subCategories: ['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage', 'Affiliate', 'Whitelabel', 'UGC', 'Podcast'] },
  'Budget Tier':   { name: 'Budget Tier',   subCategories: ['Micro ($500-2K)', 'Standard ($2K-10K)', 'Premium ($10K-50K)', 'Enterprise ($50K+)'] },
};

const CAMPAIGN_TYPES = ['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage', 'Affiliate', 'Whitelabel', 'UGC', 'Podcast'];

// Sensitive content categories requiring explicit disclaimers
const SENSITIVE_CONTENT_KEYWORDS = [
  'health', 'skincare', 'medical', 'doctor', 'dermatolog', 'nutrition', 'diet', 'fitness',
  'mental health', 'therapy', 'supplement', 'vitamin', 'weight loss', 'workout', 'exercise',
  'legal', 'law', 'attorney', 'financial', 'investment', 'crypto', 'tax', 'insurance',
  'beauty', 'cosmetic', 'acne', 'skin condition', 'allerg', 'pharmaceutical'
];

// Helper to detect if content is sensitive
const isSensitiveContent = (text: string): boolean => {
  const lowerText = (text || '').toLowerCase();
  return SENSITIVE_CONTENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

// Opportunity type with full brand brief
type Opportunity = {
  brand: string;
  brandWebsiteUrl?: string;
  type: string;
  match: string;
  featured: boolean;
  willingToBarter: boolean;
  // Brand brief — what the "Ask" button reveals
  about: string;
  budget: string;
  deadline: string;
  deliverables: { format: string; count: number }[];
  requirements: string[];
  exclusivity: string;
  usageRights: string;
  revisionLimit: number;
  compensationType: string;
  location: string;
  audienceTarget: string;
  escrowFunded?: boolean;
  escrowPool?: number;
  creatorCount?: number;
  // Point of Contact for the campaign
  poc?: { name: string; contactHandle: string; role: string };
};

// Opportunities vary by profession — different brands want different skills
// No hardcoded opportunities — only real brand-created campaigns from Firebase appear

const SLOTS: ValueSkinSlot[] = ['profession', 'passion', 'hobby'];

// Channels — skin-gated group DMs. These appear alongside regular DMs with a ValueSkin badge.
const CHANNELS: { id: number; name: string; avatarColor: string; avatarAbbr: string; description: string; visibility: 'public' | 'private'; gateType: 'any_valueskin' | 'specific'; requiredSkin: string | null; allowedProfessions: string[]; memberCount: number; lastMessage: { author: string; text: string; time: string }; messages: { id: number; author: string; handle: string; text: string; time: string }[] }[] = [
  {
    id: 0, name: 'SWE Underground', avatarColor: '#0066CC', avatarAbbr: 'SWE',
    description: 'Side projects, job referrals, and raw opinions without the LinkedIn polish.',
    visibility: 'public', gateType: 'specific', requiredSkin: 'Software Engineer',
    allowedProfessions: ['Software Engineer', 'DevOps Engineer', 'AI/ML Specialist'],
    memberCount: 2847,
    lastMessage: { author: 'Alex R.', text: 'Rust > Go for anything that matters. Fight me.', time: '2h' },
    messages: [
      { id: 0, author: 'Marcus T.', handle: '@ml_marcus', text: 'Just shipped a RAG pipeline that cut hallucination rate by 60%. Happy to share the architecture.', time: '4h ago' },
      { id: 1, author: 'Priya S.', handle: '@priya_builds', text: 'Monthly hiring board is live — drop your referral links below.', time: '3h ago' },
      { id: 2, author: 'Alex R.', handle: '@alex_codes', text: 'Rust > Go for anything that matters. Fight me.', time: '2h ago' },
    ],
  },
  {
    id: 1, name: 'MD Lounge', avatarColor: '#00897B', avatarAbbr: 'MD',
    description: 'Verified doctors and surgeons only. Clinical discussions and career advice.',
    visibility: 'private', gateType: 'specific', requiredSkin: 'Doctor',
    allowedProfessions: ['Doctor', 'Surgeon', 'Nurse'],
    memberCount: 612,
    lastMessage: { author: 'Dr. Chen', text: '34F with atypical chest pain. What would your differential be?', time: '3h' },
    messages: [
      { id: 3, author: 'Dr. Chen', handle: '@drchen', text: 'Interesting presentation today — 34F with atypical chest pain. What would your differential be?', time: '3h ago' },
      { id: 4, author: 'Dr. Williams', handle: '@drwilliams', text: 'CME webinar this Friday at 6PM EST. See you there.', time: '2d ago' },
    ],
  },
  {
    id: 2, name: 'Founders Corner', avatarColor: '#37474F', avatarAbbr: 'FC',
    description: 'Any ValueSkin gets you in. About grit, not credentials.',
    visibility: 'public', gateType: 'any_valueskin', requiredSkin: null,
    allowedProfessions: [],
    memberCount: 5241,
    lastMessage: { author: 'Lin M.', text: 'We just crossed $1M ARR. Sharing the full breakdown next week.', time: '1h' },
    messages: [
      { id: 5, author: 'Sam K.', handle: '@samk_ceo', text: 'Lesson from year 3: hire for mindset, train for skill. Churn dropped 40%.', time: '5h ago' },
      { id: 6, author: 'Lin M.', handle: '@lin_builds', text: 'We just crossed $1M ARR. Sharing the full breakdown next week. AMA.', time: '1h ago' },
    ],
  },
];

const MOCK_REPUTATION = {
  score: 78,
  onTimeRate: 0.85,
  avgRating: 4.2,
  responseScore: 0.90,
  revisionEfficiency: 0.75,
  repeatBrandRate: 0.60,
  riskTier: 'B',
  maxDealSize: 2000,
};

export default function MarketplaceDemoPage() {
  const [activeView, setActiveView] = useState<'profile' | 'mim' | 'store' | 'admin' | 'messages' | 'settings' | 'explore' | 'notifications' | 'events'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/feed' || p === '/demo/marketplace' || p === '/') return 'mim';
      if (p === '/explore') return 'explore';
      if (p === '/store') return 'store';
      if (p === '/messages') return 'messages';
      if (p === '/notifications') return 'notifications';
      if (p === '/settings') return 'settings';
      if (p.startsWith('/profile')) return 'profile';
    }
    return 'mim';
  });
  const [isMobile, setIsMobile] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener('resize', check);
    setAuthStatus('authenticated');

    return () => window.removeEventListener('resize', check);
  }, []);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<number[]>([]);

  // Editable profile
  const [profileName, setProfileName] = useState('Your Name');
  const [profileBio, setProfileBio] = useState('Creator, builder, thinker. Tap Edit to make this yours.');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [portfolioImage, setPortfolioImage] = useState<string | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; text: string; time: string; read: boolean }>>([]);

  // Onboarding
  // Creator profile preview (from brand marketplace)
  const [previewCreator, setPreviewCreator] = useState<typeof BRAND_MARKETPLACE_CREATORS[0] | null>(null);

  // Explore
  const [exploreTab, setExploreTab] = useState<'trending' | 'skins' | 'creators'>('trending');

  // DM messages state — mutable copy so sending works
  const [dmMessages, setDmMessages] = useState<Record<number, Array<{ id: number; sender: 'me' | 'them'; text: string; time: string }>>>({
    1: [
      { id: 1, sender: 'them', text: 'Hey, saw your latest post. Really cool work on the API design!', time: '10:23 AM' },
      { id: 2, sender: 'me', text: 'Thanks! Spent a while getting the pagination right', time: '10:25 AM' },
      { id: 3, sender: 'them', text: 'The cursor-based approach is solid. We switched to that too last quarter', time: '10:26 AM' },
      { id: 4, sender: 'me', text: 'Yeah offset pagination just falls apart at scale', time: '10:28 AM' },
    ],
    2: [
      { id: 1, sender: 'me', text: 'Hey Priya! How did the interview go?', time: '9:15 AM' },
      { id: 2, sender: 'them', text: 'Thanks for the referral! Got the interview.', time: '9:45 AM' },
      { id: 3, sender: 'them', text: 'System design round went really well. They liked my approach to the notification service', time: '9:46 AM' },
    ],
    3: [
      { id: 1, sender: 'them', text: 'Working on a new RAG pipeline. Want to see the architecture?', time: 'Yesterday' },
      { id: 2, sender: 'me', text: 'Definitely, send it over', time: 'Yesterday' },
      { id: 3, sender: 'them', text: 'Sent you the architecture diagram', time: '11:30 AM' },
    ],
    4: [{ id: 1, sender: 'them', text: 'Can we sync on the dataset tomorrow?', time: '2:00 PM' }],
    5: [
      { id: 1, sender: 'them', text: 'Found the issue — misconfigured env var in staging', time: '8:30 AM' },
      { id: 2, sender: 'me', text: 'Nice catch. Push when ready', time: '8:45 AM' },
      { id: 3, sender: 'them', text: 'Pipeline is green now. Pushed the fix.', time: '9:00 AM' },
    ],
    6: [{ id: 1, sender: 'them', text: 'Recipe collab sounds great, let me know the details', time: 'Yesterday' }],
    7: [
      { id: 1, sender: 'them', text: 'Check out this paper on multimodal embeddings', time: '2 days ago' },
      { id: 2, sender: 'me', text: 'Looks interesting, will read tonight', time: '2 days ago' },
    ],
  });

  // Community messages — mutable copy
  const [communityMessages, setCommunityMessages] = useState<Record<number, Array<{ id: number; author: string; handle: string; text: string; time: string }>>>({
    0: [
      { id: 0, author: 'Marcus T.', handle: '@ml_marcus', text: 'Just shipped a RAG pipeline that cut hallucination rate by 60%. Happy to share the architecture.', time: '4h ago' },
      { id: 1, author: 'Priya S.', handle: '@priya_builds', text: 'Monthly hiring board is live — drop your referral links below.', time: '3h ago' },
      { id: 2, author: 'Alex R.', handle: '@alex_codes', text: 'Rust > Go for anything that matters. Fight me.', time: '2h ago' },
    ],
    1: [
      { id: 3, author: 'Dr. Chen', handle: '@drchen', text: 'Interesting presentation today — 34F with atypical chest pain. What would your differential be?', time: '3h ago' },
      { id: 4, author: 'Dr. Williams', handle: '@drwilliams', text: 'CME webinar this Friday at 6PM EST. See you there.', time: '2d ago' },
    ],
    2: [
      { id: 5, author: 'Sam K.', handle: '@samk_ceo', text: 'Lesson from year 3: hire for mindset, train for skill. Churn dropped 40%.', time: '5h ago' },
      { id: 6, author: 'Lin M.', handle: '@lin_builds', text: 'We just crossed $1M ARR. Sharing the full breakdown next week. AMA.', time: '1h ago' },
    ],
  });

  // Skin XP for leveling — each skin levels independently
  // Level is driven purely by engagement signals: deal completions, community engagement, link/purchase activity
  // Followers and views are NOT factors — reach is a vanity metric, not a quality signal
  const [skinXP, setSkinXP] = useState<Record<string, number>>({});
  const getSkinLevel = (profession: string, _followerCount?: number, _totalSkins?: number) => {
    const xp = skinXP[profession] || 0;
    if (xp >= 1000) return 5;
    if (xp >= 500) return 4;
    if (xp >= 200) return 3;
    if (xp >= 50) return 2;
    return 1;
  };
  const getSkinXPProgress = (profession: string, _followerCount?: number, _totalSkins?: number) => {
    const xp = skinXP[profession] || 0;
    const thresholds = [0, 50, 200, 500, 1000];
    const level = getSkinLevel(profession);
    if (level >= 5) return 100;
    const current = xp - thresholds[level - 1];
    const needed = thresholds[level] - thresholds[level - 1];
    return Math.round((current / needed) * 100);
  };
  const addSkinXP = useCallback((profession: string, amount: number) => {
    setSkinXP(prev => ({ ...prev, [profession]: (prev[profession] || 0) + amount }));
  }, []);

  // 3-slot ValueSkin state — persisted to localStorage
  const [valueSkins, setValueSkins] = useState<ValueSkinMap>({});
  const [skinsLoaded, setSkinsLoaded] = useState(false);

  // Restore valueSkins from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vs_demo_value_skins');
      if (stored) setValueSkins(JSON.parse(stored));
    } catch (e) { /* ignore corrupted data */ }
    setSkinsLoaded(true);
  }, []);

  // Persist valueSkins to localStorage — only after initial load
  useEffect(() => {
    if (!skinsLoaded) return;
    try {
      localStorage.setItem('vs_demo_value_skins', JSON.stringify(valueSkins));
    } catch (e) { /* quota exceeded — safe to ignore */ }
  }, [valueSkins, skinsLoaded]);

  // Which slot is being assigned in the Store modal
  const [assigningSlot, setAssigningSlot] = useState<ValueSkinSlot | null>(null);

  const [valueskinAvatarEnabled, setValueskinAvatarEnabled] = useState(false);
  const [skinPositions, setSkinPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [draggingSkin, setDraggingSkin] = useState<string | null>(null);
  const draggingOffset = useRef<{x: number, y: number}>({x: 0, y: 0});
  const dragMoved = useRef(false);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);

  // ValueSkin hide/delete management — also persisted
  const [hiddenSkins, setHiddenSkins] = useState<Set<ValueSkinSlot>>(new Set());
  const [hiddenLoaded, setHiddenLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vs_demo_hidden_skins');
      if (stored) setHiddenSkins(new Set(JSON.parse(stored)));
    } catch (e) { /* ignore */ }
    setHiddenLoaded(true);
  }, []);

  useEffect(() => {
    if (!hiddenLoaded) return;
    try {
      localStorage.setItem('vs_demo_hidden_skins', JSON.stringify([...hiddenSkins]));
    } catch (e) { /* ignore */ }
  }, [hiddenSkins, hiddenLoaded]);

  // ── Persist key states to localStorage ───────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('vs_demo_persist');
      if (s) {
        const d = JSON.parse(s);
        if (d.marketplaceRole) setMarketplaceRole(d.marketplaceRole);
        if (d.brandValueSkins) setBrandValueSkins(d.brandValueSkins);
        if (d.activeBrandSkin) setActiveBrandSkin(d.activeBrandSkin);
        if (d.profileName) setProfileName(d.profileName);
        if (d.profileBio) setProfileBio(d.profileBio);
        if (d.profileAvatar) setProfileAvatar(d.profileAvatar);
        if (d.selectedCountry) setSelectedCountry(d.selectedCountry);
        if (d.selectedLanguages) setSelectedLanguages(d.selectedLanguages);
        if (d.rateCard) setRateCard(d.rateCard);
        if (d.profileDealTypes) setProfileDealTypes(d.profileDealTypes);
        if (d.willingToBarter !== undefined) setWillingToBarter(d.willingToBarter);
        if (d.notifications) setNotifications(d.notifications);
        if (d.joinedCommunities) setJoinedCommunities(d.joinedCommunities);
        if (d.dmMessages) setDmMessages(d.dmMessages);
        if (d.communityMessages) setCommunityMessages(d.communityMessages);
        if (d.skinXP) setSkinXP(d.skinXP);
        if (d.skinPitchTexts) setSkinPitchTexts(d.skinPitchTexts);
        if (d.skinPitchVideos) setSkinPitchVideos(d.skinPitchVideos);
        if (d.brandProfileSelections) setBrandProfileSelections(d.brandProfileSelections);
        if (d.creatorEnergy) setCreatorEnergy(d.creatorEnergy);
        if (d.metrics) setMetrics(d.metrics);
        if (d.skinPositions) setSkinPositions(d.skinPositions);
      }
    } catch (e) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showSkinManageModal, setShowSkinManageModal] = useState<ValueSkinSlot | null>(null);

  useLevelConfig();
  const { factors } = useReputationConfig();

  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showReputationModal, setShowReputationModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeCategory, setStoreCategory] = useState<string | null>(null);

  // Marketplace role & gate
  const [marketplaceRole, setMarketplaceRole] = useState<'none' | 'creator' | 'brand'>('none');
  const [brandValueSkins, setBrandValueSkins] = useState<string[]>([]);
  const [activeBrandSkin, setActiveBrandSkin] = useState<string | null>(null);

  // Fetch creators from backend API when brand skin changes
  useEffect(() => {
    if (!activeBrandSkin) {
      setBackendCreators([]);
      return;
    }
    setCreatorsLoading(true);
    fetch(`/api/creators/match?brandValueSkin=${encodeURIComponent(activeBrandSkin)}&limit=50`)
      .then(r => r.json())
      .then(d => {
        if (d.creators && Array.isArray(d.creators)) {
          setBackendCreators(d.creators.map((c: any, idx: number) => ({
            ...c,
            valueSkin: activeBrandSkin,
            _origIdx: idx,
            rate: c.rate || '$0',
            featured: false,
            willingToBarter: true,
          })));
        }
      })
      .catch(e => {
        console.error('Failed to fetch creators:', e);
        setBackendCreators([]);
      })
      .finally(() => setCreatorsLoading(false));
  }, [activeBrandSkin]);

  // Brand ValueSkin as marketing — brands can promote products/campaigns via their skin
  const [brandProfileSelections, setBrandProfileSelections] = useState<Record<string, string>>({});
  const [brandSkinMode, setBrandSkinMode] = useState<'static' | 'promo'>('static');
  const [brandPromoText, setBrandPromoText] = useState('');
  const [brandPromoUrl, setBrandPromoUrl] = useState('');

  // Creator ValueSkin showcase — creators can add a pitch video + text to their skin
  const [creatorSkinMode, setCreatorSkinMode] = useState<'static' | 'showcase'>('showcase');
  // Per-skin pitch text and video — keyed by profession name
  const [skinPitchTexts, setSkinPitchTexts] = useState<Record<string, string>>({});
  const [skinPitchVideos, setSkinPitchVideos] = useState<Record<string, { url: string; name: string }>>({});
  const [showSkinShowcaseModal, setShowSkinShowcaseModal] = useState<string | null>(null); // skin name when open
  // Accessors for the currently open skin showcase
  const creatorPitchText = showSkinShowcaseModal ? (skinPitchTexts[showSkinShowcaseModal] ?? '') : '';
  const setCreatorPitchText = (text: string) => { if (showSkinShowcaseModal) setSkinPitchTexts(prev => ({ ...prev, [showSkinShowcaseModal]: text })); };
  const creatorPitchVideoUrl = showSkinShowcaseModal ? (skinPitchVideos[showSkinShowcaseModal]?.url ?? '') : '';
  const creatorPitchVideoName = showSkinShowcaseModal ? (skinPitchVideos[showSkinShowcaseModal]?.name ?? '') : '';
  const setCreatorPitchVideoUrl = (url: string) => { if (showSkinShowcaseModal) setSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url, name: prev[showSkinShowcaseModal]?.name ?? '' } })); };
  const setCreatorPitchVideoName = (name: string) => { if (showSkinShowcaseModal) setSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url: prev[showSkinShowcaseModal]?.url ?? '', name } })); };

  // Ask modal — shows full brand brief for an opportunity
  const [askModalOpp, setAskModalOpp] = useState<Opportunity | null>(null);

  // Which ValueSkin the creator is viewing the marketplace for
  const [selectedMarketplaceSkin, setSelectedMarketplaceSkin] = useState<string | null>(null);
  const [creatorCampaignSearch, setCreatorCampaignSearch] = useState('');

  // Auto-select single skin if only one is owned
  useEffect(() => {
    const ownedProfessions = Object.values(valueSkins)
      .map(entry => entry?.profession)
      .filter(Boolean) as string[];

    if (ownedProfessions.length === 1 && !selectedMarketplaceSkin) {
      setSelectedMarketplaceSkin(ownedProfessions[0]);
    }
  }, [valueSkins, selectedMarketplaceSkin]);

  // Clear stale localStorage on version bump — reset all in-memory state
  useEffect(() => {
    const VERSION = 'v2';
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('vs_demo_version') !== VERSION) {
      localStorage.removeItem('vs_demo_value_skins');
      localStorage.removeItem('vs_demo_persist');
      localStorage.removeItem('vs_demo_deal_sync');
      localStorage.removeItem('vs_demo_hidden_skins');
      localStorage.setItem('vs_demo_version', VERSION);
      setValueSkins({});
      setMarketplaceRole('none');
      setBrandValueSkins([]);
      setActiveBrandSkin(null);
      setSelectedMarketplaceSkin(null);
    }
  }, []);

  // Negotiation state — tracks which opportunity/creator has opened negotiation
  const [negotiatingOpp, setNegotiatingOpp] = useState<number | null>(null);
  const [negotiatingCreator, setNegotiatingCreatorRaw] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem('vs_brand_negotiating_creator');
    return v !== null ? parseInt(v) : null;
  });
  const setNegotiatingCreator = (v: number | null) => { setNegotiatingCreatorRaw(v); if (v === null) localStorage.removeItem('vs_brand_negotiating_creator'); else localStorage.setItem('vs_brand_negotiating_creator', String(v)); };

  const [brandCurrentOppIndex, setBrandCurrentOppIndex] = useState(0);

  // Deal sync hook — bridges localStorage with backend API
  const dealSync = useDealSync();
  // Firebase sync — all users share one global namespace
  const { state: firebaseState, syncing: firebaseSyncing, createCampaign: firebaseCreateCampaign, updateDeal: firebaseUpdateDeal, addMessage: firebaseAddMessage, sendNotification: firebaseSendNotification, createApplication: firebaseCreateApplication } = useFirebaseRoom(null, null, '');
  const { dealStates, setDealStates, getOrCreateDeal, updateDeal: localUpdateDeal } = dealSync;

  // CRITICAL FIX: Sync Firebase state back to local state for real-time multi-device updates
  useEffect(() => {
    if (firebaseState.deals && Object.keys(firebaseState.deals).length > 0) {
      setDealStates(prev => {
        const updated: Record<string, DealState> = { ...prev };
        for (const [key, fbDeal] of Object.entries(firebaseState.deals)) {
          // Merge Firebase state with local state, Firebase takes precedence
          updated[key] = {
            ...(prev[key] || ({} as DealState)),
            ...((fbDeal as Partial<DealState>) || {}),
          };
        }
        return updated;
      });
    }
  }, [firebaseState.deals, setDealStates]);

  // Sync Firebase messages back to local deal state (using new key format: creatorName|creatorSkin)
  useEffect(() => {
    if (!firebaseState.messages) return;
    // Recompute deal key here to avoid block-scoping issues with later declarations
    let dealKey: string | null = null;
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp !== null) {
      const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        dealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}`;
      }
    } else if (marketplaceRole === 'brand' && negotiatingCreator !== null) {
      const creator = BRAND_MARKETPLACE_CREATORS[negotiatingCreator];
      if (creator) {
        dealKey = `${creator.name}|${creator.valueSkin}`;
      }
    }

    if (!dealKey) return;
    const fbMessages = firebaseState.messages[dealKey] || [];
    if (fbMessages.length > 0) {
      setDealStates(prev => ({
        ...prev,
        [dealKey]: {
          ...prev[dealKey],
          chatMessages: fbMessages as ChatMessage[],
        },
      }));
    }
  }, [firebaseState.messages, selectedMarketplaceSkin, negotiatingOpp, marketplaceRole, negotiatingCreator, setDealStates]);

  // Sync payment milestones + creator deal lifecycle from dealStates to local UI state (real-time)
  useEffect(() => {
    // Compute deal key inline to avoid block-scoping issues
    let dealKey: string | null = null;
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp !== null) {
      const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        dealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}`;
      }
    } else if (marketplaceRole === 'brand' && negotiatingCreator !== null) {
      const creator = BRAND_MARKETPLACE_CREATORS[negotiatingCreator];
      if (creator) {
        dealKey = `${creator.name}|${creator.valueSkin}`;
      }
    }

    if (!dealKey) return;
    const deal = dealStates[dealKey];
    if (!deal) return;
    // Payment milestones: sync from dealStates to local state so UI updates in real-time
    if (deal.paymentMilestones) {
      setPaymentMilestones(deal.paymentMilestones);
    }
    // Creator deal lifecycle: sync from dealStates
    if (deal.creatorDealLifecycle) {
      setCreatorDealLifecycle(deal.creatorDealLifecycle as CreatorDealLifecycle);
    }
    // Deliverable statuses: sync from dealStates
    if (deal.deliverableStatuses) {
      setDeliverableStatuses(deal.deliverableStatuses);
    }
    // Brand approval phase: sync from dealStates
    if (deal.brandApprovalPhase) {
      setBrandApprovalPhase(deal.brandApprovalPhase as BrandApprovalPhase);
    }
  }, [marketplaceRole, selectedMarketplaceSkin, negotiatingOpp, negotiatingCreator, dealStates]);

  const updateDeal = useCallback((key: string, updates: Partial<DealState>) => {
    localUpdateDeal(key, updates);
    firebaseUpdateDeal(key, updates);
  }, [localUpdateDeal, firebaseUpdateDeal]);
  const dealsLoaded = dealSync.loaded;

  // Active deal key — STABLE across creator/brand for two-device sync
  // In demo: creator always has a counterpart in BRAND_MARKETPLACE_CREATORS (matched by skin)
  // Use: creatorName|creatorSkin to enable cross-party deal lookup
  let activeDealKey: string | null = null;
  if (marketplaceRole === 'creator' && selectedMarketplaceSkin) {
    // Find the creator in BRAND_MARKETPLACE_CREATORS that matches this creator's skin
    // In the demo, we're simulating this creator interacting with opportunities
    const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
    if (matchingCreator) {
      // PRIMARY: if user explicitly selected an opp, use it (with opportunity index)
      if (negotiatingOpp !== null) {
        activeDealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}|${negotiatingOpp}`;
      }
      // FALLBACK: if no opp selected but there's an active deal with this creator, find it
      else {
        const prefix = `${matchingCreator.name}|${selectedMarketplaceSkin}|`;
        const activeDealKeyFound = Object.keys(dealStates).find(key => key.startsWith(prefix) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief');
        if (activeDealKeyFound) {
          activeDealKey = activeDealKeyFound;
        }
      }
    }
  }

  const activeDeal = activeDealKey ? getOrCreateDeal(activeDealKey) : null;

  // Convenience accessors for the active deal (backward compat with existing render code)
  const dealRoomPhase = activeDeal?.phase ?? 'brief';
  const setDealRoomPhase = (p: DealRoomPhase) => {
    if (activeDealKey) {
      updateDeal(activeDealKey, { phase: p });
      // Real-time notification: broadcast phase change to other device/user
      const opp = activeOpportunities[negotiatingOpp ?? 0];
      const phaseNames: Record<DealRoomPhase, string> = {
        brief: 'Deal initiated',
        offer: 'Brand sent offer',
        pending: 'Offer pending',
        counter: 'Creator countered',
        brand_considering: 'Brand reviewing',
        brand_countered: 'Brand countered',
        brand_rejected: 'Brand rejected',
        brand_reviewing: 'Brand reviewing',
        last_offer: 'Last offer',
        rejected: 'Rejected',
        chatroom: 'In negotiation',
        formal_offer: 'Formal offer sent',
        checklist: 'Terms checklist',
        accepted: 'Deal accepted',
        softhold: 'Escrow hold',
      };
      firebaseSendNotification(opp?.brand || 'Brand', 'application', `${phaseNames[p]} · ${opp?.brand} & you are now at: ${phaseNames[p]}`);
      setPurchaseToast(`Deal moved to: ${phaseNames[p]}`);
      setTimeout(() => setPurchaseToast(null), 2500);
    }
  };
  const dealIntent = activeDeal?.intent ?? 'campaign';
  const setDealIntent = (i: 'explore' | 'campaign' | 'long-term') => { if (activeDealKey) updateDeal(activeDealKey, { intent: i }); };
  const dealBriefFilled = activeDeal?.briefFilled ?? false;
  const setDealBriefFilled = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { briefFilled: v }); };
  const dealBriefTitle = activeDeal?.briefTitle ?? '';
  const setDealBriefTitle = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { briefTitle: v }); };
  const dealOfferAmount = activeDeal?.offerAmount ?? '';
  const setDealOfferAmount = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { offerAmount: v }); };
  const dealCounterAmount = activeDeal?.counterAmount ?? '';
  const setDealCounterAmount = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { counterAmount: v }); };
  const dealBrandResponseAmount = activeDeal?.brandResponseAmount ?? '';

  // Simulate brand reviewing a creator counter-offer.
  // Picks one of four realistic outcomes after a delay (3-6s).
  const simulateBrandResponse = (creatorCounter: number, brandOffer: number, key: string) => {
    const diff = creatorCounter - brandOffer;
    const pct = diff / brandOffer;
    // Determine outcome based on how far the counter is from the original offer
    const rand = Math.random();
    let outcome: 'accept' | 'counter' | 'last_offer' | 'reject';
    if (pct <= 0.05) {
      // Within 5% — brand almost always accepts
      outcome = rand < 0.85 ? 'accept' : 'counter';
    } else if (pct <= 0.2) {
      // 5-20% gap — brand likely counters back
      outcome = rand < 0.15 ? 'accept' : rand < 0.65 ? 'counter' : rand < 0.85 ? 'last_offer' : 'reject';
    } else {
      // >20% gap — brand more likely to push back hard or reject
      outcome = rand < 0.05 ? 'accept' : rand < 0.35 ? 'counter' : rand < 0.65 ? 'last_offer' : 'reject';
    }
    const delay = 3000 + Math.random() * 3000; // 3-6 seconds
    setTimeout(() => {
      if (outcome === 'accept') {
        updateDeal(key, { phase: 'accepted', brandResponseAmount: String(creatorCounter) });
      } else if (outcome === 'counter') {
        // Brand meets halfway
        const midpoint = Math.round((creatorCounter + brandOffer) / 2 / 50) * 50;
        updateDeal(key, { phase: 'brand_countered', brandResponseAmount: String(midpoint) });
      } else if (outcome === 'last_offer') {
        // Brand slightly above original but below midpoint
        const lastOffer = Math.round((brandOffer + (creatorCounter - brandOffer) * 0.25) / 50) * 50;
        updateDeal(key, { phase: 'brand_countered', brandResponseAmount: String(lastOffer) });
      } else {
        updateDeal(key, { phase: 'brand_rejected', brandResponseAmount: '' });
      }
    }, delay);
  };

  const chatMessages = activeDeal?.chatMessages ?? [];
  const setChatMessages = (fn: ((prev: DealState['chatMessages']) => DealState['chatMessages']) | DealState['chatMessages']) => {
    if (!activeDealKey) return;
    setDealStates(prev => {
      const deal = { ...getOrCreateDeal(activeDealKey), ...prev[activeDealKey] };
      const newMsgs = typeof fn === 'function' ? fn(deal.chatMessages) : fn;
      return { ...prev, [activeDealKey]: { ...deal, chatMessages: newMsgs } };
    });
  };
  const chatInput = activeDeal?.chatInput ?? '';
  const setChatInput = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { chatInput: v }); };
  const performanceClause = activeDeal?.performanceClause ?? false;
  const setPerformanceClause = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { performanceClause: v }); };
  const advancePercent = activeDeal?.advancePercent ?? 30;
  const uploadPercent = activeDeal?.uploadPercent ?? 40;
  const approvalPercent = activeDeal?.approvalPercent ?? 30;
  const setPaymentSplit = (advance: number, upload: number, approval: number) => {
    if (activeDealKey) updateDeal(activeDealKey, { advancePercent: advance, uploadPercent: upload, approvalPercent: approval });
  };

  // Deal type and workflow-specific accessors
  const dealType = activeDeal?.dealType ?? 'paid';
  const setDealType = (t: DealState['dealType']) => {
    if (activeDealKey) updateDeal(activeDealKey, { dealType: t });
  };
  const goodsTrackerStatus = activeDeal?.goodsTrackerStatus ?? 'goods_preparing';
  const setGoodsTrackerStatus = (s: DealState['goodsTrackerStatus']) => {
    if (activeDealKey) updateDeal(activeDealKey, { goodsTrackerStatus: s });
  };
  const c2cContentStatus = activeDeal?.c2cContentStatus ?? 'content_creating';
  const setC2cContentStatus = (s: DealState['c2cContentStatus']) => {
    if (activeDealKey) updateDeal(activeDealKey, { c2cContentStatus: s });
  };

  const offerExpiresLabel = '23h 47m';

  // Active deals indicator: count of in-progress deals across all skins
  const activeDeals = Object.entries(dealStates).filter(([, d]) => d.phase !== 'brief');

  // Tooltip state for intent/campaign type badges
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  // Energy state (creator)
  const [creatorEnergy, setCreatorEnergy] = useState<'available' | 'limited' | 'burnout' | 'pause'>('available');

  // Deal preference toggles (profile section)
  const [profileDealTypes, setProfileDealTypes] = useState<string[]>(['Paid']);
  const [profileExclusivity, setProfileExclusivity] = useState(false);
  const [profileNda, setProfileNda] = useState(false);
  const [profileUsageRights, setProfileUsageRights] = useState(false);
  const [profileOnCamera, setProfileOnCamera] = useState(true);

  // Not available dates (vacation / break)
  const [notAvailableFrom, setNotAvailableFrom] = useState('');
  const [notAvailableTo, setNotAvailableTo] = useState('');
  const [creatorSettingsOpen, setCreatorSettingsOpen] = useState<'location' | 'identity' | 'audience' | 'deals' | null>(null);
  // Soft hold active
  const [softHoldActive, setSoftHoldActive] = useState(false);

  // Creator pricing (editable in marketplace)
  const [creatorRate, setCreatorRate] = useState('5000');

  // Brand offer details (editable in marketplace)
  const [brandBudget, setBrandBudget] = useState('4000');
  const [brandCampaignDesc, setBrandCampaignDesc] = useState('Looking for authentic content creators to showcase our product');
  const [brandCampaignType, setBrandCampaignType] = useState('Product Review');

  // Brand-side deal room state — uses dealStates for real-time sync (was: localStorage-only)
  // Key format MUST match creator side: creatorName|creatorSkin
  const getBrandDealKey = useCallback(() => {
    if (negotiatingCreator === null) return null;
    const creator = BRAND_MARKETPLACE_CREATORS[negotiatingCreator];
    if (!creator) return null;
    // Format: creatorName|creatorSkin|oppIndex — includes opportunity context for multi-deal support
    return `${creator.name}|${creator.valueSkin}|${brandCurrentOppIndex}`;
  }, [negotiatingCreator, brandCurrentOppIndex]);

  const brandDealKey = getBrandDealKey();
  const brandDeal = brandDealKey ? getOrCreateDeal(brandDealKey) : null;

  // AUTO-SYNC: Brand side — when switching to brand role, sync to active deal from creator side
  useEffect(() => {
    if (marketplaceRole === 'brand' && negotiatingCreator === null && activeDealKey) {
      // Extract creator index and opp from activeDealKey when switching from creator to brand
      const parts = activeDealKey.split('|');
      if (parts.length === 3) {
        const creatorName = parts[0];
        const skinName = parts[1];
        const oppIdx = parseInt(parts[2]);
        const creatorIdx = BRAND_MARKETPLACE_CREATORS.findIndex(c => c.name === creatorName && c.valueSkin === skinName);
        if (creatorIdx >= 0) {
          setNegotiatingCreator(creatorIdx);
          setBrandCurrentOppIndex(oppIdx);
        }
      }
    }
  }, [marketplaceRole, activeDealKey, negotiatingCreator, dealStates]);

  // AUTO-SYNC: Creator side — auto-open active deal when navigating to marketplace
  useEffect(() => {
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp === null) {
      const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        // Find first active deal for this creator+skin combo (new format: creatorName|creatorSkin|oppIndex)
        const prefix = `${matchingCreator.name}|${selectedMarketplaceSkin}|`;
        const activeDealKey = Object.keys(dealStates).find(key => key.startsWith(prefix) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief');
        if (activeDealKey) {
          const oppIndex = parseInt(activeDealKey.split('|')[2] || '0');
          setNegotiatingOpp(oppIndex);
        }
      }
    }
  }, [marketplaceRole, selectedMarketplaceSkin, negotiatingOpp, dealStates]);

  // AUTO-SYNC: Brand side should find open deals if they reload without negotiatingCreator set
  useEffect(() => {
    if (marketplaceRole === 'brand' && negotiatingCreator === null) {
      // Search through all deals to find one that has been initiated by a creator
      for (const [key, deal] of Object.entries(dealStates)) {
        if (deal && deal.phase !== 'brief' && deal.creatorMarketplaceIndex !== undefined) {
          // Found an active deal, auto-switch to it
          setNegotiatingCreator(deal.creatorMarketplaceIndex);
          // Also restore the correct opportunity index from the deal key
          const oppIdx = parseInt(key.split('|')[2] || '0');
          setBrandCurrentOppIndex(oppIdx);
          break; // Only auto-open the first active deal
        }
      }
    }
  }, [dealStates, marketplaceRole, negotiatingCreator]);

  // Use dealStates phase, fallback to 'brief' if no deal yet
  const brandDealPhase = (brandDeal?.phase as any) || 'brief';
  const setBrandDealPhase = (p: DealRoomPhase) => {
    if (!brandDealKey) return;
    updateDeal(brandDealKey, { phase: p });
  };
  const [brandDealIntent, setBrandDealIntent] = useState<'explore' | 'campaign' | 'long-term'>('campaign');
  const [brandBriefTitle, setBrandBriefTitle] = useState('');
  const [brandBriefDeliverables, setBrandBriefDeliverables] = useState('');
  const [brandBriefAbout, setBrandBriefAbout] = useState('');
  const [brandBriefCampaignDesc, setBrandBriefCampaignDesc] = useState('');
  const [brandOfferNonNegotiable, setBrandOfferNonNegotiable] = useState(false);
  const [brandCounterAmount, setBrandCounterAmount] = useState('');
  const [brandChatInput, setBrandChatInput] = useState('');
  const [brandSoftHoldHours, setBrandSoftHoldHours] = useState<24 | 48 | 72>(48);

  // Auto-matching state
  const [autoMatchedCreators, setAutoMatchedCreators] = useState<AutoMatchResult[]>([]);
  const [creatorNotifications, setCreatorNotifications] = useState<Array<any>>([]);
  // Read the creator's counter amount from shared deal state (set by creator's counter-offer handler)
  const brandDealCounterAmount = brandDeal?.counterAmount || '';
  // Agreed amount = latest counter or original offer
  const agreedDealAmount = brandDealCounterAmount || brandDeal?.offerAmount || brandBudget || '5000';
  const downloadDealSummary = useCallback((dealKey: string, deal: any) => {
    if (typeof window === 'undefined' || !deal) return;
    const nowIso = new Date().toISOString();
    const agreedAmount = deal.agreementAmount || deal.counterAmount || deal.offerAmount || agreedDealAmount || '0';
    const messages = (deal.chatMessages || []) as Array<{ sender?: string; text?: string; time?: string; isoTime?: string }>;
    const deliverableLinks = (deal.deliverableLinks || {}) as Record<number, string>;
    const statuses = (deal.deliverableStatuses || {}) as Record<number, string>;
    const milestones = deal.paymentMilestones || { advance: 'pending', upload: 'pending', approval: 'pending' };
    const lines = [
      'VALUESKINS DEAL SUMMARY (EVIDENCE RECORD)',
      '----------------------------------------',
      `Generated At: ${nowIso}`,
      `Deal Key: ${dealKey}`,
      `Final Status: ${deal.creatorDealLifecycle === 'approved' || deal.brandApprovalPhase === 'approved' ? 'Approved and Deal Completed' : 'In Progress'}`,
      '',
      'PARTIES',
      `Creator: ${deal.creatorName || 'N/A'}`,
      `Brand: ${deal.brandName || profileName || 'N/A'}`,
      `Creator Skin: ${deal.creatorSkin || selectedMarketplaceSkin || 'N/A'}`,
      '',
      'COMMERCIAL TERMS',
      `Agreed Amount (USD): ${agreedAmount}`,
      `Deal Type: ${deal.dealType || 'paid'}`,
      `Offer Amount: ${deal.offerAmount || 'N/A'}`,
      `Counter Amount: ${deal.counterAmount || 'N/A'}`,
      `Agreement Amount: ${deal.agreementAmount || 'N/A'}`,
      '',
      'PAYMENT MILESTONES',
      `Advance: ${milestones.advance || 'pending'}`,
      `Upload: ${milestones.upload || 'pending'}`,
      `Approval: ${milestones.approval || 'pending'}`,
      '',
      'DELIVERABLES SUBMITTED',
      ...(Object.keys(deliverableLinks).length > 0
        ? Object.entries(deliverableLinks).map(([idx, link]) => `#${parseInt(idx) + 1} | Status: ${statuses[parseInt(idx)] || 'uploaded'} | Link: ${link}`)
        : ['None']),
      '',
      'CHAT / NEGOTIATION LOG',
      ...(messages.length > 0
        ? messages.map((m, i) => `${i + 1}. [${m.isoTime || m.time || 'N/A'}] ${String(m.sender || 'unknown').toUpperCase()}: ${m.text || ''}`)
        : ['No messages recorded']),
      '',
      'LEGAL NOTE',
      'This document is an exported platform summary for dispute review and record-keeping.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valueskins-deal-summary-${dealKey.replace(/\|/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [agreedDealAmount, profileName, selectedMarketplaceSkin]);

  // Messages state (DMs + Communities)
  const [messagesTab, setMessagesTab] = useState<'dms' | 'communities' | 'create'>('dms');
  const [activeCommunity, setActiveCommunity] = useState<number | null>(null);
  const [activeDmId, setActiveDmId] = useState<number | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<number[]>([]);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommVisibility, setNewCommVisibility] = useState<'public' | 'private'>('public');
  const [newCommGateType, setNewCommGateType] = useState<'any_valueskin' | 'specific'>('any_valueskin');
  const [newCommProfessions, setNewCommProfessions] = useState<string[]>([]);
  const [dmInput, setDmInput] = useState('');
  // Settings state
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  // Admin pricing
  const [communityTierCredits, setCommunityTierCredits] = useState(0);
  const [marketplaceTierCredits, setMarketplaceTierCredits] = useState(100);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(5); // Platform commission % per deal
  const [commissionPaidBy, setCommissionPaidBy] = useState<'brand' | 'creator'>('brand'); // Who pays the commission

  // Admin-configurable insight visibility
  const [visibleInsights, setVisibleInsights] = useState<Record<string, boolean>>({
    score: true,
    engagement: true,
    onTime: true,
    deals: true,
    rating: true,
    trustLevel: true,
    breakdown: true,
  });

  // Creator reputation & verification
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentials, setCredentials] = useState<{ platform: string; handle: string }[]>([]);
  const [identityProofs, setIdentityProofs] = useState<Array<{platform: string; handle: string; verified: boolean}>>([]);
  const [resolvedFraudSignals, setResolvedFraudSignals] = useState<number[]>([]);
  // Safety system — Meta admin controls
  const [safetyDmRateLimit, setSafetyDmRateLimit] = useState(10);
  const [safetyMinBrandTrust, setSafetyMinBrandTrust] = useState(3);
  const [safetyRequireVerifiedBrand, setSafetyRequireVerifiedBrand] = useState(true);
  const [safetyRequireBrief, setSafetyRequireBrief] = useState(true);
  const [safetyReportThreshold, setSafetyReportThreshold] = useState(3);
  const [safetyRecontactCooldown, setSafetyRecontactCooldown] = useState(30);
  const [safetyProposalFormOnly, setSafetyProposalFormOnly] = useState(true);
  const [safetyOffPlatformBlock, setSafetyOffPlatformBlock] = useState(true);
  const [safetyNewBrandWarmIntro, setSafetyNewBrandWarmIntro] = useState(true);
  type DealCommMode = 'valueskins_chatroom' | 'platform_dms';
  const [dealCommMode, setDealCommMode] = useState<DealCommMode>('valueskins_chatroom');
  const [safetyNewBrandDealCount, setSafetyNewBrandDealCount] = useState(0);
  const [savedSafetyToast, setSavedSafetyToast] = useState(false);
  // Creator-side safety controls
  const [creatorAllowedNiches, setCreatorAllowedNiches] = useState<string[]>([]);
  const [creatorBlockedBrands, setCreatorBlockedBrands] = useState<string[]>([]);
  const [creatorShowSafetySettings, setCreatorShowSafetySettings] = useState(false);
  const [activeDisputeStage, setActiveDisputeStage] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>(['']);

  // Barter/exposure toggle — managed in Settings, stored server-side
  const [willingToBarter, setWillingToBarter] = useState(false);
  const [filterBarterOnly, setFilterBarterOnly] = useState(false);
  const [filterOppsBarterOnly, setFilterOppsBarterOnly] = useState(false);
  const [creatorMarketplaceMode, setCreatorMarketplaceMode] = useState<'brand' | 'collab'>('brand');
  const [collabRequestOpen, setCollabRequestOpen] = useState<number | null>(null);
  const [collabIdea, setCollabIdea] = useState('');
  const [collabFormat, setCollabFormat] = useState('');
  const [collabBudget, setCollabBudget] = useState('');
  const [collabPaid, setCollabPaid] = useState(false);
  const [collabNegotiable, setCollabNegotiable] = useState(true);
  const [collabSentNames, setCollabSentNames] = useState<string[]>([]);
  const [collabTargetSkin, setCollabTargetSkin] = useState<string | null>(null);
  const [collabView, setCollabView] = useState<'browse' | 'sent'>('browse');
  const [collabCompFilter, setCollabCompFilter] = useState<'all' | 'paid' | 'unpaid' | 'barter'>('all');
  const [c2cDealType, setC2cDealType] = useState<'c2c'>('c2c');
  const [firebaseNotifications, setFirebaseNotifications] = useState<Array<{id: string; type: 'campaign' | 'application' | 'message'; message: string; createdAt: number; read: boolean}>>([]);

  // Brand field filter — which ValueSkin profession the brand wants to target
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [brandSearchMode, setBrandSearchMode] = useState<'profession' | 'name' | 'general'>('profession');
  const [filterAudienceAge, setFilterAudienceAge] = useState<string | null>(null);
  const [filterAudienceLang, setFilterAudienceLang] = useState<string | null>(null);
  const [filterAudienceLoc, setFilterAudienceLoc] = useState('');
  const [filterMinDeal, setFilterMinDeal] = useState('');
  const [filterDealType, setFilterDealType] = useState<string | null>(null);
  const [filterResponseMax, setFilterResponseMax] = useState<number | null>(null);
  const [showAudienceFilters, setShowAudienceFilters] = useState(false);

  // Rate card
  const [rateCard, setRateCard] = useState({ reel: '4500', story: '1200', post: '2800', podcast: '3500', live: '6000' });
  const [creatorAvailableFrom, setCreatorAvailableFrom] = useState('2026-03-01');
  const [creatorMaxActiveDeals, setCreatorMaxActiveDeals] = useState(3);
  const [contractMode, setContractMode] = useState<'one-off' | 'long-term' | 'both'>('both');
  const [dealCompletionRate] = useState(94);
  const [verifiedIncomeTier] = useState<'starter' | '10k+' | '50k+' | '100k+'>('50k+');
  const [isFirstDealOpen, setIsFirstDealOpen] = useState(false);
  const [showRateCard, setShowRateCard] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [usageRightsDays, setUsageRightsDays] = useState(90);
  const [exclusivityUntil, setExclusivityUntil] = useState('');
  const [revisionLimit, setRevisionLimit] = useState(2);
  const [savedDealTemplates, setSavedDealTemplates] = useState([
    { id: 1, name: 'Q2 Standard Review', type: 'Product Review', deliverables: '2x Reels, 3x Stories', budget: '4000' },
  ]);
  const [savedSearches, setSavedSearches] = useState([
    { id: 1, label: 'Fitness Coach, 18-24, USA', profession: 'Fitness Coach', age: '18-24', loc: 'USA' },
  ]);
  // Admin feature flags
  const [adminShowRateCard, setAdminShowRateCard] = useState(true);
  const [adminShowPortfolio, setAdminShowPortfolio] = useState(true);
  const [adminShowDealCompletion, setAdminShowDealCompletion] = useState(true);
  const [adminShowIncomeTier, setAdminShowIncomeTier] = useState(true);
  const [adminShowFirstDealBadge, setAdminShowFirstDealBadge] = useState(true);
  const [adminShowExclusivitySignal, setAdminShowExclusivitySignal] = useState(true);
  const [adminShowRevisionLimit, setAdminShowRevisionLimit] = useState(true);
  const [adminShowUsageRightsDuration, setAdminShowUsageRightsDuration] = useState(true);
  const [adminShowAvailabilityCalendar, setAdminShowAvailabilityCalendar] = useState(true);
  const [adminShowSavedSearches, setAdminShowSavedSearches] = useState(true);
  const [adminShowDealTemplates, setAdminShowDealTemplates] = useState(true);
  const [adminShowSimilarCreators, setAdminShowSimilarCreators] = useState(true);
  const [adminShowBrandTrackRecord, setAdminShowBrandTrackRecord] = useState(true);
  const [adminShowMutualRating, setAdminShowMutualRating] = useState(true);
  const [adminAllowLongTermContracts, setAdminAllowLongTermContracts] = useState(true);
  const [adminSavedFeaturesTab, setAdminSavedFeaturesTab] = useState(false);

  // Campaigns + applications — from deal sync hook (API-backed with localStorage fallback)
  const { applications: sharedApplications, setApplications: setSharedApplications, campaigns, setCampaigns } = dealSync;

  // Merge Firebase state into local state when in room mode (cross-device sync)
  useEffect(() => {
    // Firebase always active
    if (firebaseState.campaigns.length > 0) {
      setCampaigns(firebaseState.campaigns as Campaign[]);
    }
  }, [firebaseState.campaigns, setCampaigns]);

  useEffect(() => {
    // Firebase always active
    if (firebaseState.applications.length > 0) {
      setSharedApplications(firebaseState.applications as SharedApplication[]);
    }
  }, [firebaseState.applications, setSharedApplications]);

  // Sync deal states from Firebase (other device's deal updates appear here)
  useEffect(() => {
    // Firebase always active
    const fbDeals = firebaseState.deals;
    if (Object.keys(fbDeals).length > 0) {
      setDealStates(prev => {
        const merged = { ...prev };
        for (const [key, deal] of Object.entries(fbDeals)) {
          merged[key] = { ...merged[key], ...(deal as DealState) };
        }
        return merged;
      });
    }
  }, [firebaseState.deals]);

  // Sync Firebase messages into deal chatMessages
  useEffect(() => {
    const fbMessages = firebaseState.messages;
    if (Object.keys(fbMessages).length > 0) {
      setDealStates(prev => {
        const merged: Record<string, DealState> = { ...prev };
        for (const [dealKey, msgs] of Object.entries(fbMessages)) {
          const existing = merged[dealKey] || ({} as DealState);
          merged[dealKey] = {
            ...existing,
            chatMessages: msgs as ChatMessage[],
          } as DealState;
        }
        return merged;
      });
    }
  }, [firebaseState.messages]);

  // Sync Firebase notifications
  useEffect(() => {
    // Firebase always active
    if (firebaseState.notifications.length > 0) {
      setFirebaseNotifications(firebaseState.notifications);
      const newNotifs = firebaseState.notifications.filter((n: any) => !n.read);
      if (newNotifs.length > 0) {
        newNotifs.forEach((n: any) => {
          const msg = n.type === 'campaign' ? `New campaign: ${n.message}` : n.type === 'application' ? `New application: ${n.message}` : `Message: ${n.message}`;
          setNotifications(prev => [{ id: parseInt(n.id) || Date.now(), type: n.type, text: msg, time: 'just now', read: false }, ...prev.slice(0, 9)]);
          // Feature 3: Show toast notification
          setPurchaseToast(msg);
          setTimeout(() => setPurchaseToast(null), 4000);
        });
      }
    }
  }, [firebaseState.notifications]);

  // No seeded campaigns or applications — only real data from Firebase

  const [marketplaceTab, setMarketplaceTab] = useState<'creators' | 'campaigns' | 'applications' | 'sent' | 'pastDeals'>('creators');
  const [backendCreators, setBackendCreators] = useState<any[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [hiddenSentDealIds, setHiddenSentDealIds] = useState<Set<number>>(new Set());
  const [showCampaignCreator, setShowCampaignCreator] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [newCampaignBudget, setNewCampaignBudget] = useState('');
  const [newCampaignDeadline, setNewCampaignDeadline] = useState('');
  const [newCampaignProfessions, setNewCampaignProfessions] = useState<string[]>([]);
  const [newCampaignMinLevel, setNewCampaignMinLevel] = useState(1);
  const [newCampaignMaxLevel, setNewCampaignMaxLevel] = useState(5);
  const [newCampaignLocation, setNewCampaignLocation] = useState('');
  const [newCampaignDeliverables, setNewCampaignDeliverables] = useState('');
  const [newCampaignNonNeg, setNewCampaignNonNeg] = useState<string[]>([]);
  const [newCampaignAbout, setNewCampaignAbout] = useState('');
  const [newCampaignCompensation, setNewCampaignCompensation] = useState('Paid');
  const [newCampaignExclusivity, setNewCampaignExclusivity] = useState('None');
  const [newCampaignUsageRights, setNewCampaignUsageRights] = useState('30 days, social only');
  const [newCampaignAudienceTarget, setNewCampaignAudienceTarget] = useState('');
  const [newCampaignRequirements, setNewCampaignRequirements] = useState<string[]>([]);
  const [newCampaignReqInput, setNewCampaignReqInput] = useState('');
  const [newCampaignCreatorCount, setNewCampaignCreatorCount] = useState(1);

  // Campaign POC (Point of Contact) fields
  const [newCampaignPocName, setNewCampaignPocName] = useState('');
  const [newCampaignPocHandle, setNewCampaignPocHandle] = useState('');
  const [newCampaignPocRole, setNewCampaignPocRole] = useState('');

  // Campaign script mode selection (brand chooses during creation)
  const [newCampaignScriptMode, setNewCampaignScriptMode] = useState<'non_negotiable' | 'discussion' | 'creator_freedom'>('creator_freedom');
  const [newCampaignScriptText, setNewCampaignScriptText] = useState('');

  // Barter goods tracker and international compliance states
  const [goodsTrackingInput, setGoodsTrackingInput] = useState('');
  const [intlTaxAcknowledged, setIntlTaxAcknowledged] = useState(false);

  // Payment milestone states — tracks which stages have been released
  const [advanceReleased, setAdvanceReleased] = useState(false);
  const [uploadReleased, setUploadReleased] = useState(false);
  const [approvalReleased, setApprovalReleased] = useState(false);

  // Communities creation state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityGateType, setNewCommunityGateType] = useState<'any_valueskin' | 'specific' | 'manual'>('any_valueskin');
  const [newCommunityRequiredSkin, setNewCommunityRequiredSkin] = useState('');
  const [newCommunityPrice, setNewCommunityPrice] = useState('');
  const [newCommunityMembers, setNewCommunityMembers] = useState<string[]>([]);

  // Tip system state
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipForDealId, setTipForDealId] = useState<number | null>(null);

  // Dispute resolution state
  const [showDisputeModal, setShowDisputeModal] = useState<number|null>(null);
  const [disputeForDealId, setDisputeForDealId] = useState<number | null>(null);
  const [disputeType, setDisputeType] = useState<'late_delivery' | 'quality_issue' | 'payment' | 'other'>('other');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [intlCustomsAcknowledged, setIntlCustomsAcknowledged] = useState(false);

  // Campaign escrow funding modal (shown after publish, before batch send)
  const [showEscrowFundingModal, setShowEscrowFundingModal] = useState(false);
  const [escrowFundingInProgress2, setEscrowFundingInProgress2] = useState(false);
  const [pendingCampaignForEscrow, setPendingCampaignForEscrow] = useState<Campaign | null>(null);

  // Feature 4: Batch campaign sending
  const [showBatchSendModal, setShowBatchSendModal] = useState(false);
  const [batchSendCreatorIds, setBatchSendCreatorIds] = useState<Set<number>>(new Set());
  const [lastCreatedCampaignId, setLastCreatedCampaignId] = useState<number | null>(null);

  // Feature 2: Creator profile display
  const [showCreatorProfileModal, setShowCreatorProfileModal] = useState(false);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<typeof BRAND_MARKETPLACE_CREATORS[0] | null>(null);

  // Convenience aliases for backward compatibility
  const persistCampaigns = (updated: Campaign[]) => { setCampaigns(updated); };
  const persistApplications = (updated: SharedApplication[]) => {
    setSharedApplications(updated);
    updated.forEach(a => firebaseCreateApplication(a));
  };
  const resetMvpDemoState = () => {
    // Full MVP reset: clear in-memory state and persisted demo storage.
    setDealStates({});
    setSharedApplications([]);
    setCampaigns([]);
    setCompletedDeals([]);
    setUploadedItems([]);
    setNegotiatingOpp(null);
    setNegotiatingCreator(null);
    setSelectedMarketplaceSkin(null);
    setCreatorMarketplaceTab('opportunities');
    setMarketplaceTab('creators');
    setCreatorCampaignSearch('');
    setNewCampaignTitle('');
    setNewCampaignDesc('');
    setNewCampaignBudget('');
    setNewCampaignDeadline('');
    setNewCampaignDeliverables('');
    setPurchaseToast('MVP reset complete — demo restarted from beginning');
    setTimeout(() => setPurchaseToast(null), 2500);
    if (typeof window !== 'undefined') {
      const keys = [
        'vs_demo_persist',
        'vs_demo_deal_sync',
        'vs_demo_value_skins',
        'vs_demo_hidden_skins',
        'vs_demo_campaigns',
        'vs_demo_applications',
        'vs_brand_negotiating_creator',
      ];
      keys.forEach(k => localStorage.removeItem(k));
      // Reload to guarantee every derived state starts fresh for pitch flow.
      window.location.reload();
    }
  };

  // Keep legacy myApplications wired to sharedApplications for creator view
  const myApplications = sharedApplications;
  // Gap 4: deal lifecycle
  type CreatorDealLifecycle = 'checklist'|'deliverables'|'submitted'|'approved';
  type BrandApprovalPhase = 'accepted'|'funding'|'funded'|'reviewing'|'approved';
  // Read from shared deal state for real-time cross-role sync
  const creatorDealLifecycle: CreatorDealLifecycle = (activeDeal?.creatorDealLifecycle as CreatorDealLifecycle) || 'checklist';
  const setCreatorDealLifecycle = (lc: CreatorDealLifecycle) => { if (activeDealKey) updateDeal(activeDealKey, { creatorDealLifecycle: lc }); };
  const brandApprovalPhase: BrandApprovalPhase = (brandDeal?.brandApprovalPhase as BrandApprovalPhase) || 'accepted';
  const setBrandApprovalPhase = (p: BrandApprovalPhase) => { if (brandDealKey) updateDeal(brandDealKey, { brandApprovalPhase: p }); };
  const [dealUploadSimulated, setDealUploadSimulated] = useState(false);
  type CompletedDeal = { id:number; brand:string; amount:number; completedAt:string; deliverable:string; usageRightsDays?:number; exclusivityDays?:number; exclusivitySkin?:string; disputed?:boolean; disputeReason?:string; disputeStatus?:'filed'|'under_review'|'resolved'; contractSignedAt?:string; tipped?:number; };
  const [completedDeals, setCompletedDeals] = useState<CompletedDeal[]>([]);
  // Track uploaded deliverables across all deals (for "Uploaded" profile tab)
  type UploadedItem = { id:string; brand:string; dealId:string; format:string; link:string; uploadedAt:string; };
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([]);
  // Deliverable checklist tracking (per-deliverable status + content links)
  // Deliverable statuses + links — synced from shared deal state for brand to see creator submissions
  const deliverableStatuses: Record<number, 'pending'|'linking'|'uploaded'|'approved'> = (activeDeal?.deliverableStatuses as Record<number, 'pending'|'linking'|'uploaded'|'approved'>) || {};
  const setDeliverableStatuses = (v: Record<number, 'pending'|'linking'|'uploaded'|'approved'> | ((prev: Record<number, 'pending'|'linking'|'uploaded'|'approved'>) => Record<number, 'pending'|'linking'|'uploaded'|'approved'>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(deliverableStatuses) : v;
    updateDeal(activeDealKey, { deliverableStatuses: newVal });
  };
  const deliverableLinks: Record<number, string> = (activeDeal?.deliverableLinks as Record<number, string>) || {};
  const setDeliverableLinks = (v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(deliverableLinks) : v;
    updateDeal(activeDealKey, { deliverableLinks: newVal });
  };
  const [deliverableLinkInputs, setDeliverableLinkInputs] = useState<Record<number, string>>({});
  // Feature 2: Available for deals toggle
  const [availableForDeals, setAvailableForDeals] = useState(true);
  // Feature 3: Market rates panel
  const [showMarketRates, setShowMarketRates] = useState(false);
  // Feature 6: Creator pipeline view
  const [creatorMarketplaceTab, setCreatorMarketplaceTab] = useState<'opportunities'|'pipeline'>('opportunities');
  // Feature 7: Public profile link copied
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  // Deal cancellation
  const [showCancelDealModal, setShowCancelDealModal] = useState(false);
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [campaignsSectionOpen, setCampaignsSectionOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Deal rating (post-completion)
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [dealRating, setDealRating] = useState(0);
  const [dealRatingComment, setDealRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [displayCreatorRating, setDisplayCreatorRating] = useState(false);
  // Brand-side rating
  const [brandShowRatingModal, setBrandShowRatingModal] = useState(false);
  const [brandDealRating, setBrandDealRating] = useState(0);
  const [brandRatingComment, setBrandRatingComment] = useState('');
  const [brandRatingSubmitted, setBrandRatingSubmitted] = useState(false);
  const [displayBrandRating, setDisplayBrandRating] = useState(false);
  // Payment milestone tracking — synced from shared deal state for real-time cross-role visibility
  type MilestoneStatus = 'pending'|'released';
  const paymentMilestones: Record<string, MilestoneStatus> = (activeDeal?.paymentMilestones as Record<string, MilestoneStatus>) || { advance: 'pending', upload: 'pending', approval: 'pending' };
  const setPaymentMilestones = (v: Record<string, MilestoneStatus> | ((prev: Record<string, MilestoneStatus>) => Record<string, MilestoneStatus>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(paymentMilestones) : v;
    updateDeal(activeDealKey, { paymentMilestones: newVal as any });
  };
  // Dispute evidence input
  const [disputeEvidence, setDisputeEvidence] = useState('');
  // Escrow funding — synced from shared deal state
  const escrowFunded = activeDeal?.escrowFunded ?? false;
  const setEscrowFunded = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { escrowFunded: v }); };
  const [escrowFundingInProgress, setEscrowFundingInProgress] = useState(false);
  // Contract agreement (before finalization)
  const [contractChecks, setContractChecks] = useState<Record<string, boolean>>({});
  const [contractSignature, setContractSignature] = useState('');
  const [signatureJurisdiction, setSignatureJurisdiction] = useState('US');
  // Script negotiation workflow — synced from shared deal state
  const scriptDraft = activeDeal?.scriptDraft ?? '';
  const scriptMode = activeDeal?.scriptMode ?? 'creator_freedom';
  const scriptStatus = activeDeal?.scriptStatus ?? 'draft';
  const scriptVersion = activeDeal?.scriptVersion ?? 0;
  const brandScriptText = activeDeal?.brandScriptText ?? '';
  const creatorScriptApproved = activeDeal?.creatorScriptApproved ?? false;
  const brandScriptApproved = activeDeal?.brandScriptApproved ?? false;
  const scriptVersionHistory = (activeDeal?.scriptVersionHistory as any[]) ?? [];
  const scriptApprovedAt = activeDeal?.scriptApprovedAt ?? '';
  const [showScriptEditorCreator, setShowScriptEditorCreator] = useState(false);
  const [showScriptExpandedCreator, setShowScriptExpandedCreator] = useState(false);
  const [scriptEditReason, setScriptEditReason] = useState('');
  const [scriptEditorText, setScriptEditorText] = useState(scriptDraft);
  const [showScriptHistory, setShowScriptHistory] = useState(false);
  const publishEvents = activeDeal?.publishEvents ?? [];
  const appendPublishEvent = (event: { id: number; type: 'video_published' | 'milestone_released'; message: string; at: string }) => {
    if (!activeDealKey) return;
    updateDeal(activeDealKey, { publishEvents: [...publishEvents, event] });
  };
  // Exclusivity tracking (active exclusivities from completed deals)
  const activeExclusivities = completedDeals.filter(d => {
    if (!d.exclusivityDays || !d.exclusivitySkin) return false;
    const expiresAt = new Date(d.completedAt).getTime() + d.exclusivityDays * 86400000;
    return expiresAt > Date.now();
  });
  // Gap 5: level-up
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpFrom, setLevelUpFrom] = useState(1);
  const [levelUpTo, setLevelUpTo] = useState(2);

  const [metrics, setMetrics] = useState({
    followers: 1243000, engagement: 6.8, dealsCompleted: 47,
    avgDealValue: 85000, onTimeRate: 99, brandRating: 4.87,
  });

  // Persist state to localStorage — must be declared after ALL state variables it references
  useEffect(() => {
    if (!skinsLoaded) return;
    try {
      localStorage.setItem('vs_demo_persist', JSON.stringify({
        marketplaceRole, brandValueSkins, activeBrandSkin, profileName, profileBio, profileAvatar,
        selectedCountry, selectedLanguages, rateCard, profileDealTypes, willingToBarter,
        notifications, joinedCommunities, dmMessages, communityMessages,
        skinXP, brandProfileSelections, creatorEnergy, metrics, skinPitchTexts, skinPitchVideos,
        skinPositions,
      }));
    } catch (e) { /* ignore */ }
  }, [marketplaceRole, brandValueSkins, activeBrandSkin, profileName, profileBio, profileAvatar,
      selectedCountry, selectedLanguages, rateCard, profileDealTypes, willingToBarter,
      notifications, joinedCommunities, dmMessages, communityMessages,
      skinXP, brandProfileSelections, creatorEnergy, metrics, skinsLoaded, skinPitchTexts, skinPitchVideos,
      skinPositions]);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    setMetrics(prev => ({ ...prev, followers: prev.followers + (isFollowing ? -1 : 1) }));
  };

  const toggleLike = (i: number) => {
    setLikedPosts(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const updateMetric = (key: string, value: string) => {
    setMetrics(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  // Opens the Store modal with the target slot pre-selected
  const openStoreForSlot = (slot: ValueSkinSlot) => {
    setAssigningSlot(slot);
    setShowStoreModal(true);
  };

  // Simulate purchase: assign profession to the chosen slot, show toast
  const purchaseProfession = (profession: string) => {
    if (marketplaceRole === 'brand') {
      // Brand purchase — add to global pool (max 3 per device)
      if (brandValueSkins.includes(profession)) {
        setPurchaseToast(`You already own ${profession}`);
        setTimeout(() => setPurchaseToast(null), 3000);
        return;
      }
      if (brandValueSkins.length >= 3) {
        setPurchaseToast('Maximum 3 ValueSkins. Remove one first.');
        setTimeout(() => setPurchaseToast(null), 3000);
        return;
      }
      setBrandValueSkins(prev => [...prev, profession]);
      // ALSO add to creator's valueSkins so both roles can see it
      setValueSkins(prev => {
        const newSkins = { ...prev };
        if (!Object.values(newSkins).some(s => s?.profession === profession)) {
          const emptySlot = (['profession', 'passion', 'hobby'] as const).find(slot => !newSkins[slot]);
          if (emptySlot) {
            newSkins[emptySlot] = { profession, aboutMe: defaultAboutMe(profession) };
          }
        }
        return newSkins;
      });
      if (!activeBrandSkin) setActiveBrandSkin(profession);
      setShowStoreModal(false);
      setActiveView('mim');
      setPurchaseToast(`${profession} added to your ValueSkins`);
      setTimeout(() => setPurchaseToast(null), 3000);
      return;
    }
    // Creator purchase — assign to slot
    if (!assigningSlot) {
      setPurchaseToast('Select a slot first');
      setTimeout(() => setPurchaseToast(null), 3000);
      return;
    }
    const badge = PROFESSION_BADGES[profession];
    const label = badge?.abbreviation ?? profession.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const slotLabel = SLOT_LABELS[assigningSlot];

    setValueSkins(prev => ({
      ...prev,
      [assigningSlot]: { profession, aboutMe: defaultAboutMe(profession) },
    }));
    // ALSO add to brand skins so brand can use it
    if (!brandValueSkins.includes(profession)) {
      setBrandValueSkins(prev => [...prev, profession]);
      if (!activeBrandSkin) setActiveBrandSkin(profession);
    }
    // Seed demo XP — different per slot so levels visibly differ
    // Profession: 350 XP (Lv.3), Passion: 120 XP (Lv.2), Hobby: 30 XP (Lv.1)
    if (!skinXP[profession]) {
      const demoXP: Record<ValueSkinSlot, number> = { profession: 350, passion: 120, hobby: 30 };
      addSkinXP(profession, demoXP[assigningSlot]);
    }
    setShowStoreModal(false);
    setAssigningSlot(null);
    setActiveView('profile');
    setPurchaseToast(`${label} applied as your ${slotLabel}`);
    setTimeout(() => setPurchaseToast(null), 3000);
  };

  // Rate intelligence — market rate range based on skin, followers, engagement
  const getMarketRate = (skin: string): { low: number; mid: number; high: number } => {
    const followerK = metrics.followers / 1000;
    const base = followerK < 10 ? 200 : followerK < 50 ? 800 : followerK < 200 ? 2500 : followerK < 1000 ? 8000 : 25000;
    const engagementMultiplier = metrics.engagement > 5 ? 1.4 : metrics.engagement > 3 ? 1.15 : 1;
    const skinMultiplier = ['Software Engineer', 'Doctor', 'Lawyer', 'Investment Banker', 'CEO'].includes(skin) ? 1.5 : ['Actor', 'Musician', 'Professional Athlete'].includes(skin) ? 1.3 : 1;
    const mid = Math.round(base * engagementMultiplier * skinMultiplier);
    return { low: Math.round(mid * 0.6), mid, high: Math.round(mid * 1.5) };
  };

  const handleDealComplete = (earnedAmount: number, brandName: string, deliverable: string, skinProfession?: string, usageRightsDays?: number, exclusivityDays?: number, exclusivitySkin?: string) => {
    const updatedMetrics = {
      ...metrics,
      dealsCompleted: metrics.dealsCompleted + 1,
      avgDealValue: Math.round((metrics.avgDealValue * metrics.dealsCompleted + earnedAmount * 100) / (metrics.dealsCompleted + 1)),
    };
    setMetrics(updatedMetrics);
    setCompletedDeals(prev => [...prev, { id: Date.now(), brand: brandName, amount: earnedAmount, completedAt: new Date().toLocaleDateString(), deliverable, usageRightsDays, exclusivityDays, exclusivitySkin, contractSignedAt: contractSignature ? new Date().toISOString() : undefined }]);

    // Add XP to the skin this deal was completed under
    const targetSkin = skinProfession || selectedMarketplaceSkin || ownedSkins[0]?.profession;
    if (targetSkin) {
      const prevLevel = getSkinLevel(targetSkin);
      // Deal completion = major XP: base 100 + bonus scaled by deal value
      // Views are not a factor — XP reflects engagement quality: deal completions, conversions, audience trust
      const xpGain = 100 + Math.round(earnedAmount / 100);
      addSkinXP(targetSkin, xpGain);
      const newXP = (skinXP[targetSkin] || 0) + xpGain;
      const newLevel = newXP >= 1000 ? 5 : newXP >= 500 ? 4 : newXP >= 200 ? 3 : newXP >= 50 ? 2 : 1;
      if (newLevel > prevLevel) {
        setLevelUpFrom(prevLevel);
        setLevelUpTo(newLevel);
        setShowLevelUpModal(true);
      } else {
        setPurchaseToast('Deal complete — earnings added to your balance');
        setTimeout(() => setPurchaseToast(null), 3000);
      }
    } else {
      setPurchaseToast('Deal complete — earnings added to your balance');
      setTimeout(() => setPurchaseToast(null), 3000);
    }
  };

  // Script approval handlers
  const handleScriptChange = (newText: string, reason?: string) => {
    if (!activeDealKey || scriptMode === 'non_negotiable') return;
    const newVersion = (scriptVersion || 0) + 1;
    const now = new Date();
    const historyEntry = {
      version: newVersion,
      text: scriptDraft,
      editedBy: marketplaceRole === 'creator' ? 'creator' : 'brand',
      editedAt: now.toISOString(),
      reason,
    };
    updateDeal(activeDealKey, {
      scriptDraft: newText,
      scriptVersion: newVersion,
      scriptStatus: 'draft',
      creatorScriptApproved: false,
      brandScriptApproved: false,
      scriptVersionHistory: [...scriptVersionHistory, historyEntry],
    });
  };

  const handleScriptApprove = () => {
    if (!activeDealKey) return;
    const isCreator = marketplaceRole === 'creator';
    const otherParty = isCreator ? (askModalOpp?.brand || 'Brand') : 'Creator';
    const bothApproved = (isCreator && brandScriptApproved) || (!isCreator && creatorScriptApproved);
    const payload: any = {
      [isCreator ? 'creatorScriptApproved' : 'brandScriptApproved']: true,
      scriptStatus: bothApproved ? 'approved' : 'submitted',
    };
    if (bothApproved) {
      payload.scriptApprovedAt = new Date().toISOString();
      payload.scriptStatus = 'approved';
      firebaseSendNotification(otherParty, 'application', 'Both parties approved the script! Ready to move to deliverables.');
      setPurchaseToast('Script approved by both parties');
    } else {
      firebaseSendNotification(otherParty, 'application', `${isCreator ? 'Creator' : 'Brand'} approved the script. Awaiting your approval to proceed.`);
      setPurchaseToast(`Script approved by ${isCreator ? 'you' : 'brand'}`);
    }
    updateDeal(activeDealKey, payload);
    setTimeout(() => setPurchaseToast(null), 2500);
  };

  const handleScriptRevoke = () => {
    if (!activeDealKey) return;
    const isCreator = marketplaceRole === 'creator';
    updateDeal(activeDealKey, {
      [isCreator ? 'creatorScriptApproved' : 'brandScriptApproved']: false,
      scriptStatus: 'draft',
    });
    setPurchaseToast('Approval revoked');
    setTimeout(() => setPurchaseToast(null), 2500);
  };

  // Which professions are already assigned (to show status in store)
  const assignedProfessions = new Set(
    Object.values(valueSkins).map(e => e?.profession).filter(Boolean) as string[]
  );

  const hasValueSkin = Object.values(valueSkins).some(entry => entry?.profession);
  const hasAnySkin = hasValueSkin || brandValueSkins.length > 0;

  // List of owned skins for the marketplace skin selector
  const ownedSkins = Object.entries(valueSkins)
    .filter(([, entry]) => entry?.profession)
    .map(([slot, entry]) => ({ slot: slot as ValueSkinSlot, profession: entry!.profession }));

  // Per-skin level: highest owned skin level used as the "profile level"
  const currentLevel = ownedSkins.length > 0
    ? Math.max(...ownedSkins.map(s => getSkinLevel(s.profession, metrics.followers, ownedSkins.length)))
    : 1;

  // Auto-expire campaigns past deadline
  const today = new Date().toISOString().split('T')[0];
  const liveCampaigns = campaigns.map(c => {
    if (c.status === 'open' && c.deadline && c.deadline < today) return { ...c, status: 'expired' as const };
    return c;
  });

  // Check if creator matches campaign requirements
  const creatorMatchesCampaignRequirements = (campaign: Campaign, creatorProfession: string, creatorData?: any): boolean => {
    // Must have matching profession
    if (!campaign.requiredProfessions.includes(creatorProfession)) return false;

    // If creator data provided, check other requirements
    if (creatorData) {
      // Location: must match if campaign specifies a non-remote location
      if (campaign.location && campaign.location.trim().toLowerCase() !== 'remote') {
        const campaignLoc = campaign.location.toLowerCase().trim();
        const creatorLoc = creatorData.audienceLocation?.toLowerCase().trim() || '';
        if (creatorLoc && !creatorLoc.includes(campaignLoc) && campaignLoc !== creatorLoc) {
          return false;
        }
      }

      // Age range: must overlap
      if (campaign.requirements?.some(r => r.toLowerCase().includes('age') || r.toLowerCase().includes('25-34'))) {
        const creatorAge = creatorData.audienceAgeRange || '';
        const ageMatch = campaign.requirements?.some(r => {
          const lower = r.toLowerCase();
          return lower.includes(creatorAge.toLowerCase()) || creatorAge.toLowerCase().includes(lower.split(' ')[0]);
        });
        if (!ageMatch && campaign.requirements?.some(r => /\d+-\d+/.test(r))) return false;
      }

      // Language: must match if specified
      if (campaign.requirements?.some(r => r.toLowerCase().includes('language') || r.toLowerCase().includes('english'))) {
        const creatorLang = creatorData.audienceLang || '';
        const langMatch = campaign.requirements?.some(r => creatorLang.toLowerCase().includes(r.toLowerCase().split(/\s+/)[0]));
        if (!langMatch && campaign.requirements?.some(r => /language|english|spanish/i.test(r))) return false;
      }
    }

    return true;
  };

  // Opportunities for the currently selected skin — sorted by match % descending
  // Merge hardcoded opportunities with brand-created campaigns (converted to Opportunity format)
  const campaignOpportunities: Opportunity[] = liveCampaigns
    .filter(c => {
      if (c.status !== 'open' || !selectedMarketplaceSkin) return false;
      // Get the current creator's data if available (from marketplace creators)
      const currentCreator = BRAND_MARKETPLACE_CREATORS.find(cr => cr.valueSkin === selectedMarketplaceSkin);
      return creatorMatchesCampaignRequirements(c, selectedMarketplaceSkin, currentCreator);
    })
    .map(c => ({
      brand: c.brandName || 'Brand',
      type: c.title,
      match: '100%',
      featured: true,
      willingToBarter: (c.compensationType || '').toLowerCase().includes('barter'),
      about: c.about || c.description,
      budget: `$${parseInt(c.budget || '0').toLocaleString()}`,
      deadline: c.deadline,
      deliverables: (c.deliverables || '').split(',').map(d => {
              const trimmed = d.trim();
              const countMatch = trimmed.match(/^(\d+)[xX]\s*(.+)$/);
              return countMatch ? { format: countMatch[2].trim(), count: parseInt(countMatch[1]) } : { format: trimmed, count: 1 };
            }),
      requirements: c.requirements || [],
      exclusivity: c.exclusivity || 'None',
      usageRights: c.usageRights || '30 days, social only',
      revisionLimit: c.revisionLimit || 2,
      compensationType: c.compensationType || 'Paid',
      location: c.location || 'Remote',
      audienceTarget: c.audienceTarget || '',
      escrowFunded: c.escrowFunded || false,
      escrowPool: c.escrowPool || 0,
      creatorCount: c.creatorCount || 1,
    }));
  const activeOpportunities = selectedMarketplaceSkin
    ? campaignOpportunities.slice().sort((a, b) => parseInt(b.match) - parseInt(a.match))
    : [];

  // Deals the creator missed (expired campaigns matching their skins)
  const missedDeals = selectedMarketplaceSkin
    ? liveCampaigns.filter(c => c.status === 'expired' && c.requiredProfessions.includes(selectedMarketplaceSkin))
    : [];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflowX: 'hidden' }}>

      {/* ── HEADER ──────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>ValueSkins</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/profile/me" style={{ padding: '8px 16px', color: C.text, textDecoration: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'block' }}>
            Profile
          </Link>
          <Link href="/account/settings" style={{ padding: '8px 16px', color: C.text, textDecoration: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'block' }}>
            Settings
          </Link>
          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/auth/login';
              } catch (err) {
                console.error('Logout failed:', err);
              }
            }}
            style={{ padding: '8px 16px', background: C.primary, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>

      {/* ── ONBOARDING OVERLAY ──────────────────────────── */}

      {/* ValueSkin Showcase Modal — add video + pitch when clicking your skin */}
      {showSkinShowcaseModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 }}>
          <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'440px', width:'95vw', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
            <button onClick={() => setShowSkinShowcaseModal(null)} style={{ position:'absolute', top:'14px', right:'16px', background:'none', border:'none', color:C.textMuted, fontSize:'22px', cursor:'pointer', lineHeight:1 }}>x</button>

            {(() => {
              const skinBadge = PROFESSION_BADGES[showSkinShowcaseModal];
              const skinColor = skinBadge?.color ?? C.primary;
              const skinLevel = getSkinLevel(showSkinShowcaseModal, metrics.followers, ownedSkins.length);
              const skinProgress = getSkinXPProgress(showSkinShowcaseModal, metrics.followers, ownedSkins.length);
              const rawXP = skinXP[showSkinShowcaseModal] || 0;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    {getStickerForProfession(showSkinShowcaseModal) ? (
                      <img src={getStickerForProfession(showSkinShowcaseModal)!} alt={showSkinShowcaseModal} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${skinColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: skinColor }}>{skinBadge?.abbreviation ?? '?'}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{showSkinShowcaseModal}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: skinColor }}>Level {skinLevel}</span>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: C.border, overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ width: `${skinProgress}%`, height: '100%', background: skinColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: C.textMuted }}>{rawXP} XP</span>
                      </div>
                    </div>
                  </div>
                  {ownedSkins.length === 1 && (
                    <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '12px', padding: '6px 10px', background: C.surfaceAlt, borderRadius: '6px' }}>
                      Followers contribute to XP with a single skin equipped
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'20px' }}>Brands see this when they click your ValueSkin. Tell them why they should collab with you.</div>

            {/* Mode toggle */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={()=>setCreatorSkinMode('static')} style={{ flex:1, padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', background:creatorSkinMode==='static'?C.primary:C.bg, color:creatorSkinMode==='static'?'#fff':C.textSecondary, border:`1px solid ${creatorSkinMode==='static'?C.primary:C.border}` }}>
                Static Skin
              </button>
              <button onClick={()=>setCreatorSkinMode('showcase')} style={{ flex:1, padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', background:creatorSkinMode==='showcase'?C.primary:C.bg, color:creatorSkinMode==='showcase'?'#fff':C.textSecondary, border:`1px solid ${creatorSkinMode==='showcase'?C.primary:C.border}` }}>
                Showcase Mode
              </button>
            </div>

            {creatorSkinMode === 'static' && (
              <div style={{ textAlign:'center', padding:'30px 20px', color:C.textMuted, fontSize:13 }}>
                Your ValueSkin displays as a standard badge. Switch to Showcase to add a video pitch and bio.
              </div>
            )}

            {creatorSkinMode === 'showcase' && (
              <>
                {/* Video upload section */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Pitch Video</div>
                  <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:8 }}>Record a short video explaining why brands should work with you. This plays when they click your skin.</div>

                  {!creatorPitchVideoUrl ? (
                    <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'24px', background:C.bg, border:`2px dashed ${C.border}`, borderRadius:10, cursor:'pointer', transition:'border-color 0.2s' }}>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        style={{ display:'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 50 * 1024 * 1024) {
                              setPurchaseToast('Video must be under 50MB');
                              setTimeout(() => setPurchaseToast(null), 3000);
                              return;
                            }
                            const url = URL.createObjectURL(file);
                            setCreatorPitchVideoUrl(url);
                            setCreatorPitchVideoName(file.name);
                          }
                        }}
                      />
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="1.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      <span style={{ fontSize:13, fontWeight:600, color:C.text }}>Upload pitch video</span>
                      <span style={{ fontSize:11, color:C.textMuted }}>MP4, WebM or MOV &middot; Max 50MB</span>
                    </label>
                  ) : (
                    <div style={{ position:'relative' }}>
                      <video
                        src={creatorPitchVideoUrl}
                        controls
                        style={{ width:'100%', borderRadius:10, maxHeight:220, background:'#000' }}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                        <span style={{ fontSize:11, color:C.textMuted }}>{creatorPitchVideoName}</span>
                        <button onClick={() => { URL.revokeObjectURL(creatorPitchVideoUrl); setCreatorPitchVideoUrl(''); setCreatorPitchVideoName(''); }} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, padding:'4px 10px', fontSize:11, color:C.textMuted, cursor:'pointer', fontWeight:600 }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text pitch */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Written Pitch</div>
                  <textarea
                    value={creatorPitchText}
                    onChange={e => setCreatorPitchText(e.target.value)}
                    placeholder={`Why should brands hire you as a ${showSkinShowcaseModal}? e.g. "I've built products used by 50K+ devs..."`}
                    rows={3}
                    style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:'10px', fontSize:13, fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }}
                  />
                </div>

                {/* Preview card */}
                {(creatorPitchVideoUrl || creatorPitchText) && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:12, marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textSecondary, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>How brands see your skin</div>
                    {creatorPitchVideoUrl && (
                      <video src={creatorPitchVideoUrl} controls style={{ width:'100%', borderRadius:8, maxHeight:160, background:'#000', marginBottom:8 }} />
                    )}
                    {creatorPitchText && (
                      <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{creatorPitchText}</div>
                    )}
                  </div>
                )}
              </>
            )}

            <button onClick={() => { setShowSkinShowcaseModal(null); setPurchaseToast(creatorSkinMode === 'showcase' ? 'Showcase saved — brands will see your pitch' : 'Skin set to static'); setTimeout(()=>setPurchaseToast(null),3000); }} style={{ width:'100%', background:creatorSkinMode==='showcase'?C.primary:C.primary, border:'none', borderRadius:8, padding:'12px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', marginTop:8 }}>
              {creatorSkinMode === 'showcase' ? 'Save Showcase' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Ask Modal — full brand brief */}
      {askModalOpp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => setAskModalOpp(null)}>
          <div style={{ background: C.surface, borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.border}`, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAskModalOpp(null)} style={{ position: 'absolute', top: '14px', right: '16px', background: 'none', border: 'none', color: C.textMuted, fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>x</button>

            {/* Brand header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '10px', background: `linear-gradient(135deg, ${C.primary}, ${C.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {askModalOpp.brand.charAt(0)}
              </div>
              <div>
                <a href={askModalOpp.brandWebsiteUrl || `https://portfolio.valueskins.com/${askModalOpp.brand.replace(/\s+/g, '').toLowerCase()}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 700, color: C.text, textDecoration: 'none', display: 'block' }}>{askModalOpp.brand}</a>
                <div style={{ fontSize: '12px', color: C.textSecondary }}>{askModalOpp.type}</div>
              </div>
            </div>

            {/* About */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>About this campaign</div>
              <div style={{ fontSize: '13px', color: C.text, lineHeight: 1.6 }}>{askModalOpp.about}</div>
            </div>

            {/* Deliverables */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Deliverables</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {askModalOpp.deliverables.map((d, idx) => (
                  <div key={idx} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: C.primary }}>{d.count}</span>
                    <span style={{ fontSize: '12px', color: C.text, fontWeight: 500 }}>{d.format}{d.count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Budget</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.textSecondary }}>{askModalOpp.budget}</div>
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Deadline</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{new Date(askModalOpp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Compensation</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{askModalOpp.compensationType}</div>
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{askModalOpp.location}</div>
              </div>
            </div>

            {/* Terms */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Terms</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Exclusivity</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.exclusivity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Usage rights</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.usageRights}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Revision limit</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.revisionLimit} revision{askModalOpp.revisionLimit !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Target audience</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.audienceTarget}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0' }}>
                  <span style={{ color: C.textSecondary }}>Match</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>{askModalOpp.match}</span>
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Requirements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {askModalOpp.requirements.map((req, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    {req}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setAskModalOpp(null)}
              style={{ width: '100%', background: C.primary, border: 'none', borderRadius: '8px', padding: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Level-Up Modal */}
      {showLevelUpModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 }}>
          <div style={{ background:'#FFFFFF', borderRadius:'20px', padding:'40px 28px 28px', maxWidth:'340px', width:'90vw', textAlign:'center' }}>
            {/* Level badge */}
            <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`linear-gradient(135deg, ${C.primary}, #7C3AED)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <span style={{ fontSize:'28px', fontWeight:800, color:'#fff' }}>{levelUpTo}</span>
            </div>
            <div style={{ fontSize:'22px', fontWeight:800, color:'#1A1A1A', marginBottom:'8px' }}>Level Up</div>
            <div style={{ fontSize:'15px', color:'#666', marginBottom:'8px', lineHeight:1.5 }}>
              You reached Level {levelUpTo}
            </div>
            <div style={{ fontSize:'13px', color:'#999', marginBottom:'28px' }}>
              Deal completed successfully. Your reputation has been updated.
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:'32px', marginBottom:'28px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:800, color:'#CCC' }}>{levelUpFrom}</div>
                <div style={{ fontSize:'11px', color:'#999', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>Before</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', color:C.primary, fontSize:'20px' }}>&rarr;</div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:800, color:C.primary }}>{levelUpTo}</div>
                <div style={{ fontSize:'11px', color:C.primary, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>After</div>
              </div>
            </div>
            <button onClick={() => { setShowLevelUpModal(false); setPurchaseToast('Deal complete — earnings added to your balance'); setTimeout(() => setPurchaseToast(null), 3000); }} style={{ width:'100%', background:C.primary, border:'none', borderRadius:'12px', padding:'14px', color:'#fff', fontWeight:700, fontSize:'15px', cursor:'pointer' }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {purchaseToast && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: C.card, color: C.text, padding: '14px 24px', borderRadius: '14px',
          fontSize: '14px', fontWeight: 600, zIndex: 99999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap',
          border: `1px solid ${C.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {purchaseToast}
        </div>
      )}


      {/* Main Content */}
      <div style={{ display: activeView === 'events' ? 'none' : 'flex', flex: 1, justifyContent: 'center', overflowX: 'hidden', paddingBottom: '60px' }}>
        <div style={{ width: '100%', maxWidth: (activeView === 'store' || activeView === 'mim' || activeView === 'admin') ? '900px' : '600px', borderLeft: isMobile ? 'none' : `1px solid ${C.border}`, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, background: C.bg, overflowX: 'hidden' }}>

          {/* ── PROFILE VIEW ──────────────────────────────────── */}
          {activeView === 'profile' && (
            <>
              {/* Header */}
              <div style={{
                height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, background: C.bg, zIndex: 10, padding: '0 16px',
              }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>saketh_eth</span>
                <button
                  onClick={() => setShowAvatarSettings(!showAvatarSettings)}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: C.textSecondary, cursor: 'pointer' }}
                >
                  Settings
                </button>
              </div>

              {/* Avatar Settings */}
              {showAvatarSettings && (
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <ValueskinAvatarToggle
                    enabled={valueskinAvatarEnabled}
                    onChange={(v) => { setValueskinAvatarEnabled(v); }}
                  />
                  {hasValueSkin && (
                    <div style={{ marginTop: '12px', fontSize: '11px', color: C.textMuted }}>
                      Drag your skin badges anywhere on your profile.
                    </div>
                  )}
                </div>
              )}

              {/* ValueSkins Profile Section */}
              <div
                ref={profileAreaRef}
                style={{ padding: isMobile ? '12px' : '20px 20px 0', position: 'relative' }}
                onMouseMove={e => {
                  if (!draggingSkin || !profileAreaRef.current) return;
                  dragMoved.current = true;
                  const rect = profileAreaRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left - draggingOffset.current.x;
                  const y = e.clientY - rect.top - draggingOffset.current.y;
                  setSkinPositions(prev => ({ ...prev, [draggingSkin]: { x, y } }));
                }}
                onMouseUp={() => setDraggingSkin(null)}
                onMouseLeave={() => setDraggingSkin(null)}
              >
                {/* ValueSkins Profile Card */}
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '20px'
                }}>
                  {/* Avatar + Profile Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>
                    {/* Avatar */}
                    <div style={{ flexShrink: 0 }}>
                      <ProfilePhotoWithLongPress
                        showValueskinAvatar={valueskinAvatarEnabled}
                        level={currentLevel}
                        valueSkins={valueSkins}
                        avatarUrl="https://api.dicebear.com/7.x/avataaars/svg?seed=Saketh"
                        displayName="Saketh Velamuri"
                        size={isMobile ? 64 : 96}
                        onValueSkinsChange={setValueSkins}
                      />
                    </div>

                    {/* Profile Text Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '2px' }}>Saketh Velamuri</div>
                        <div style={{ fontSize: '14px', color: C.textSecondary }}>@saketh_eth</div>
                      </div>

                      {/* Profile Bio */}
                      {editingProfile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                            placeholder="Your name"
                            style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: '13px', fontWeight: 600 }} />
                          <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={2}
                            placeholder="Tell your story..."
                            style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: '12px', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5 }} />
                          <button onClick={() => setEditingProfile(false)}
                            style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: '6px', border: 'none', background: C.primary, color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            Save
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.5', maxWidth: '320px' }}>{profileBio}</div>
                          <button
                            onClick={() => setEditingProfile(true)}
                            style={{ marginTop: '8px', fontSize: '12px', color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          >
                            Edit Profile
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>12</div>
                      <div style={{ fontSize: '12px', color: C.textSecondary }}>Deals</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>4.8</div>
                      <div style={{ fontSize: '12px', color: C.textSecondary }}>Rating</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>$42K</div>
                      <div style={{ fontSize: '12px', color: C.textSecondary }}>Earned</div>
                    </div>
                  </div>
                </div>

                {/* Freely draggable skin badges — each positioned independently */}
                {hasValueSkin && ownedSkins.map(({ slot, profession }, idx) => {
                  const badge = PROFESSION_BADGES[profession];
                  const pos = skinPositions[profession] ?? { x: 180 + idx * 40, y: 12 };
                  const isDragging = draggingSkin === profession;
                  return (
                    <div
                      key={profession}
                      onMouseDown={e => {
                        if (isMobile) return;
                        e.preventDefault();
                        dragMoved.current = false;
                        const rect = profileAreaRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        draggingOffset.current = { x: e.clientX - rect.left - pos.x, y: e.clientY - rect.top - pos.y };
                        setDraggingSkin(profession);
                      }}
                      onClick={e => {
                        if (dragMoved.current) { dragMoved.current = false; return; }
                        e.stopPropagation();
                        setShowSkinShowcaseModal(profession);
                      }}
                      style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y,
                        cursor: isMobile ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
                        userSelect: 'none',
                        zIndex: isDragging ? 100 : 10,
                        filter: isDragging ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : 'none',
                      }}
                    >
                      <span style={{ fontSize: '22px', lineHeight: 1, pointerEvents: 'none', display: 'block' }}>
                        {badge?.emoji ?? badge?.abbreviation ?? profession.slice(0, 3).toUpperCase()}
                      </span>
                    </div>
                  );
                })}


                {/* Barter signal badge */}
                {hasValueSkin && willingToBarter && (
                  <div style={{
                    borderRadius: '12px', padding: '10px 14px', marginTop: '12px',
                    backgroundColor: `${C.success}10`,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '13px', color: C.textSecondary, fontWeight: 600,
                  }}>
                    <span>Open to barter</span>
                    <button
                      onClick={() => setActiveView('settings')}
                      style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: '11px', cursor: 'pointer', marginLeft: 'auto' }}
                    >
                      Edit
                    </button>
                  </div>
                )}

                {/* Availability badge */}
                {hasValueSkin && (notAvailableFrom || notAvailableTo) && (
                  <div style={{
                    borderRadius: '12px', padding: '10px 14px', marginTop: '8px',
                    backgroundColor: `${C.warning}10`, border: `1px solid ${C.warningBorder}`,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '13px', color: C.textSecondary, fontWeight: 600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Unavailable {notAvailableFrom && `from ${notAvailableFrom}`}{notAvailableTo && ` to ${notAvailableTo}`}</span>
                    <button onClick={() => setActiveView('settings')} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: '11px', cursor: 'pointer', marginLeft: 'auto' }}>Edit</button>
                  </div>
                )}
                {hasValueSkin && !notAvailableFrom && !notAvailableTo && (
                  <div style={{
                    borderRadius: '12px', padding: '10px 14px', marginTop: '8px',
                    backgroundColor: `${C.success}10`,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '13px', color: C.textSecondary, fontWeight: 600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>Available for deals</span>
                  </div>
                )}

                {/* Credentials & Identity Section */}
                {/* Compact Verified Credentials — inline chip row */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'center' }}>
                  {credentials.map((cred, i) => (
                    <div key={i} style={{
                      padding: '4px 8px',
                      backgroundColor: C.surfaceAlt,
                      color: C.textSecondary, borderRadius: '5px', fontSize: '11px', fontWeight: 600, border: `1px solid ${C.border}`,
                    }}>
                      {cred.platform.toUpperCase()}
                    </div>
                  ))}
                  {['twitter', 'linkedin', 'tiktok'].map((platform) => {
                    const proof = identityProofs.find(p => p.platform === platform);
                    if (!proof?.verified) return null;
                    return (
                      <div key={platform} style={{
                        padding: '4px 8px', backgroundColor: C.surfaceAlt,
                        borderRadius: '5px', fontSize: '11px', color: C.textSecondary, fontWeight: 600, border: `1px solid ${C.border}`,
                      }}>
                        {platform.toUpperCase()}
                      </div>
                    );
                  })}
                </div>

                {/* Portfolio Image */}
                {portfolioImage && (
                  <div style={{ marginTop: '16px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                    <div style={{ width: '100%', height: '240px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <img src={portfolioImage} alt="Why hire me" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: '12px 14px', background: C.surface, fontSize: '12px', color: C.textMuted, fontWeight: '600' }}>
                      Why brands should hire {profileName || 'this creator'}
                    </div>
                  </div>
                )}

              </div>

              {/* Tabs */}
              <div style={{ borderTop: `1px solid ${C.border}`, display: 'flex' }}>
                {['posts', 'reels', 'tagged', 'insights', 'deals', 'uploaded'].map((tab) => (
                  <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '44px', borderTop: activeTab === tab ? `2px solid ${tab === 'insights' ? C.primary : C.text}` : '2px solid transparent', color: activeTab === tab ? (tab === 'insights' ? C.primary : C.text) : C.textMuted, cursor: 'pointer', fontWeight: activeTab === tab ? '600' : 'normal', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {tab}
                  </div>
                ))}
              </div>

              {/* Post Grid — shown for posts/reels/tagged */}
              {activeTab !== 'insights' && activeTab !== 'deals' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: C.border }}>
                  {[...Array(9)].map((_, i) => (
                    <div key={i} onClick={() => toggleLike(i)} style={{ aspectRatio: '1/1', background: C.surface, position: 'relative', cursor: 'pointer', overflow: 'hidden' }}>
                      <img src={`https://picsum.photos/400/400?random=${i}`} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                      {likedPosts.includes(i) && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Deals Tab Content */}
              {activeTab === 'deals' && (
                <div style={{ padding:'20px' }}>
                  <div style={{ fontSize:'13px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'14px' }}>Completed Deals</div>
                  {completedDeals.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 20px', color:C.textMuted }}>
                      <div style={{ fontSize:'14px', marginBottom:'4px' }}>No completed deals yet</div>
                      <div style={{ fontSize:'12px' }}>Complete a deal in the Marketplace to see it here.</div>
                    </div>
                  ) : (
                    completedDeals.map((deal, i) => (
                      <div key={i} style={{ background:C.card, borderRadius:'10px', padding:'14px', marginBottom:'10px', border:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                          <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{deal.brand}</span>
                          <span style={{ fontSize:'14px', fontWeight:800, color:C.success }}>${deal.amount.toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'4px' }}>{deal.deliverable}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <span style={{ fontSize:'10px', color:C.textMuted }}>Completed {deal.completedAt}</span>
                          <span style={{ fontSize:'10px', fontWeight:700, color:C.success, background:C.surfaceAlt, padding:'2px 8px', borderRadius:'6px' }}>Approved</span>
                        </div>
                        {/* Repeat deal & tip buttons */}
                        <div style={{ display:'flex', gap:'8px' }}>
                          <button onClick={() => { setPurchaseToast(`Reach out to ${deal.brand} about a repeat deal`); setTimeout(() => setPurchaseToast(null), 3000); }} style={{ flex:1, fontSize:'11px', fontWeight:700, padding:'8px 10px', background:`${C.primary}15`, border:`1px solid ${C.primary}30`, borderRadius:'8px', color:C.primary, cursor:'pointer' }}>
                            Repeat Deal
                          </button>
                          <button onClick={() => { setTipForDealId(i); setShowTipModal(true); }} style={{ flex:1, fontSize:'11px', fontWeight:700, padding:'8px 10px', background:`rgba(255,171,0,0.12)`, border:`1px solid rgba(255,171,0,0.4)`, borderRadius:'8px', color:C.warning, cursor:'pointer' }}>
                            💰 Tip
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ marginTop:'16px', padding:'12px', background:'rgba(0,102,204,0.05)', borderRadius:'8px', border:`1px solid rgba(0,102,204,0.1)` }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:C.text, marginBottom:'2px' }}>Total earned: ${completedDeals.reduce((s,d) => s+d.amount, 0).toLocaleString()}</div>
                    <div style={{ fontSize:'11px', color:C.textSecondary }}>{completedDeals.length} deal{completedDeals.length !== 1 ? 's' : ''} completed</div>
                  </div>
                </div>
              )}

              {/* Uploaded Tab Content */}
              {activeTab === 'uploaded' && (
                <div style={{ padding: '20px' }}>
                  {uploadedItems.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 20px', color:C.textMuted }}>
                      <div style={{ fontSize:'14px', marginBottom:'4px' }}>No uploads yet</div>
                      <div style={{ fontSize:'12px' }}>Complete deals and upload deliverables to see them here.</div>
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:'8px' }}>
                      {uploadedItems.map((item, i) => (
                        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ position:'relative', paddingBottom:'100%', overflow:'hidden', borderRadius:'8px', background:C.card, border:`1px solid ${C.border}`, textDecoration:'none', display:'block' }}>
                          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px', background:'rgba(0,0,0,0.6)', opacity:0, transition:'opacity 0.2s', cursor:'pointer' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                            <div style={{ fontSize:'10px', fontWeight:700, color:C.text, marginBottom:'4px' }}>{item.format}</div>
                            <div style={{ fontSize:'9px', color:C.textMuted }}>{item.brand}</div>
                          </div>
                          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6m-3-3v6"/></svg>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Insights Tab Content */}
              {activeTab === 'insights' && (
                <div style={{ padding: '20px' }}>
                  <div
                    onClick={() => setShowReputationModal(true)}
                    style={{
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: '14px', padding: '16px', marginBottom: '20px',
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                  >
                    {/* Top row — score (tick icon removed) */}
                    {visibleInsights.score && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Valueskins Insights</div>
                            <div style={{ fontSize: '11px', color: C.textSecondary }}>Tap for full breakdown</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: C.primary, lineHeight: 1 }}>847</div>
                            <div style={{ fontSize: '10px', color: C.textMuted, fontWeight: 600 }}>/ 1000</div>
                          </div>
                        </div>
                        <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' }}>
                          <div style={{ height: '100%', width: '84.7%', background: C.primary, borderRadius: '2px' }} />
                        </div>
                      </>
                    )}

                    {/* Metric cards row */}
                    {(visibleInsights.engagement || visibleInsights.onTime || visibleInsights.deals || visibleInsights.rating) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                          visibleInsights.engagement && { label: 'Engagement', value: `${metrics.engagement}%`, color: metrics.engagement >= 5 ? C.success : C.textSecondary },
                          visibleInsights.onTime && { label: 'On-Time', value: `${metrics.onTimeRate}%`, color: metrics.onTimeRate >= 95 ? C.success : C.textSecondary },
                          visibleInsights.deals && { label: 'Deals', value: `${metrics.dealsCompleted}`, color: C.text },
                          visibleInsights.rating && { label: 'Rating', value: `${metrics.brandRating}`, color: metrics.brandRating >= 4.5 ? C.success : C.textSecondary },
                        ].filter(Boolean).map((m: any) => (
                          <div key={m.label} style={{ textAlign: 'center', padding: '8px 4px', background: C.surfaceAlt, borderRadius: '8px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: m.color, lineHeight: 1, marginBottom: '4px' }}>{m.value}</div>
                            <div style={{ fontSize: '9px', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Trust level — shown per-skin when clicking individual skin sticker */}
                  </div>

                  {/* Factor breakdown — shown below the main card */}
                  {visibleInsights.breakdown && (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Score Breakdown</div>
                      {factors.map((factor) => {
                        const factorScores: Record<string, number> = {
                          'Content Consistency': 82, 'Audience Engagement': 91,
                          'Brand Partnerships': 78, 'On-time Delivery': 99,
                          'Community Trust': 85, 'Profile Completeness': 95,
                        };
                        const earned = factorScores[factor.name] ?? Math.round(factor.maxPoints * 0.8);
                        const fillPct = Math.round((earned / factor.maxPoints) * 100);
                        return (
                          <div key={factor.name} style={{ background: C.surfaceAlt, padding: '14px', borderRadius: '10px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{factor.name}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                <span style={{ fontSize: '15px', fontWeight: 800, color: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning }}>{earned}</span>
                                <span style={{ fontSize: '11px', color: C.textMuted }}>/{factor.maxPoints}</span>
                              </div>
                            </div>
                            <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning, borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Creator Score Card */}
                  <div style={{
                    borderRadius: '12px',
                    border: `1px solid ${C.borderLight}`,
                    padding: '20px',
                    marginTop: '20px',
                    backgroundColor: C.bg,
                  }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', color: C.text }}>Creator Score</h3>

                    {/* Overall Score */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '20px',
                      padding: '16px',
                      backgroundColor: 'rgba(0,102,204,0.06)',
                      borderRadius: '8px',
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: C.textSecondary }}>Overall Score</div>
                        <div style={{
                          fontSize: '32px',
                          fontWeight: 'bold',
                          color: MOCK_REPUTATION.score >= 80 ? C.textSecondary : MOCK_REPUTATION.score >= 50 ? '#f59e0b' : C.textMuted,
                        }}>
                          {MOCK_REPUTATION.score}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '8px',
                      }}>
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: MOCK_REPUTATION.riskTier === 'A' ? C.textSecondary : MOCK_REPUTATION.riskTier === 'B' ? '#3b82f6' : MOCK_REPUTATION.riskTier === 'C' ? '#f59e0b' : C.textMuted,
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}>
                          Tier {MOCK_REPUTATION.riskTier}
                        </div>
                        <div style={{ fontSize: '12px', color: C.textSecondary }}>
                          Max deal: ${MOCK_REPUTATION.maxDealSize.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Dimension Bars */}
                    {[
                      { label: 'On-Time Rate', value: MOCK_REPUTATION.onTimeRate },
                      { label: 'Avg Rating', value: MOCK_REPUTATION.avgRating / 5 },
                      { label: 'Response Score', value: MOCK_REPUTATION.responseScore },
                      { label: 'Revision Efficiency', value: MOCK_REPUTATION.revisionEfficiency },
                      { label: 'Repeat Brand Rate', value: MOCK_REPUTATION.repeatBrandRate },
                    ].map((dim, i) => (
                      <div key={i} style={{ marginBottom: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                          fontSize: '12px',
                        }}>
                          <span style={{ color: C.textSecondary }}>{dim.label}</span>
                          <span style={{ color: C.text, fontWeight: 500 }}>{Math.round(dim.value * 100)}%</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${dim.value * 100}%`,
                            height: '100%',
                            backgroundColor: C.primary,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── MARKETPLACE VIEW ──────────────────────────────── */}
          {activeView === 'mim' && (
            <>
              {/* Layer 1: Gate — no ValueSkin */}
              {!hasAnySkin && (
                <>
                  <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', paddingLeft: '20px', fontWeight: 'bold', fontSize: '16px', background: C.surface }}>Marketplace</div>
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>ValueSkin Required</h2>
                    <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '24px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto 24px' }}>
                      You need at least one ValueSkin to access the Marketplace. Visit the Store to get your first badge.
                    </p>
                    <button
                      onClick={() => setActiveView('store')}
                      style={{ background: C.primary, border: 'none', borderRadius: '10px', color: '#fff', padding: '12px 32px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      Go to Store
                    </button>
                  </div>
                </>
              )}

              {/* Layer 2: Role selection */}
              {hasAnySkin && marketplaceRole === 'none' && (
                <>
                  <div style={{ padding: '12px 16px 0', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Marketplace</span>
                  </div>
                  <div style={{ padding: '40px 16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Choose your role</h2>
                      <p style={{ fontSize: '14px', color: C.textSecondary }}>Start trading collaborations and deals</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {([
                        { role: 'creator' as const, title: 'Login as Creator', desc: 'Find partnership briefs matched to your ValueSkins', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' },
                        { role: 'brand' as const, title: 'Login as Brand', desc: 'Find creators for collabs, launches, and paid placements', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
                      ]).map(({ role, title, desc, icon }) => (
                        <button
                          key={role}
                          onClick={() => setMarketplaceRole(role)}
                          style={{
                            flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px',
                            padding: '32px 20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.surfaceAlt; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={icon} />
                              {role === 'creator' && <circle cx="12" cy="7" r="4" />}
                            </svg>
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>{title}</div>
                          <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5, marginBottom: '20px' }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Layer 3a: Creator Marketplace */}
              {hasValueSkin && marketplaceRole === 'creator' && (
                <>
                  {/* Marketplace header */}
                  <div style={{ padding: '12px 16px 0', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Marketplace</span>
                      <button onClick={() => { setMarketplaceRole('none'); setSelectedMarketplaceSkin(null); setNegotiatingOpp(null); }} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.textSecondary, cursor: 'pointer', padding: '4px 0' }}>Switch</button>
                    </div>

                    {/* Brand Deals / Creator Collabs tab toggle */}
                    <div style={{ display: 'flex', background: C.card, borderRadius: '10px', padding: '3px', marginBottom: '14px' }}>
                      {(['brand', 'collab'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setCreatorMarketplaceMode(mode)}
                          style={{
                            flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none',
                            background: creatorMarketplaceMode === mode ? C.primary : 'transparent',
                            color: creatorMarketplaceMode === mode ? '#fff' : C.textSecondary,
                            fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {mode === 'brand' ? 'Brand Deals' : 'Creator Collabs'}
                        </button>
                      ))}
                    </div>

                    {/* Available for deals toggle + tab selector */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, color:C.textMuted }}>Available for deals</span>
                        <button onClick={() => setAvailableForDeals(!availableForDeals)} style={{ width:36, height:20, borderRadius:20, border:'none', background: availableForDeals ? C.success : C.border, cursor:'pointer', display:'flex', alignItems:'center', padding: availableForDeals ? '0 2px 0 16px' : '0 16px 0 2px', transition:'all 0.2s' }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all 0.2s' }} />
                        </button>
                        {availableForDeals && <span style={{ fontSize:'10px', fontWeight:700, color:C.success, background:'rgba(0,212,106,0.1)', padding:'2px 8px', borderRadius:'12px' }}>Taking deals</span>}
                      </div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        {(['opportunities','pipeline'] as const).map(tab => (
                          <button key={tab} onClick={() => setCreatorMarketplaceTab(tab)} style={{ padding:'4px 10px', fontSize:'10px', fontWeight:700, borderRadius:'6px', border:`1px solid ${creatorMarketplaceTab === tab ? C.primary : C.border}`, background: creatorMarketplaceTab === tab ? C.primary : 'transparent', color: creatorMarketplaceTab === tab ? '#fff' : C.textSecondary, cursor:'pointer' }}>
                            {tab === 'opportunities' ? 'Opportunities' : 'My Pipeline'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category filter chips — scrollable */}
                    {creatorMarketplaceTab === 'opportunities' && (
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
                      {ownedSkins.map(s => s.profession).map(skin => {
                        const isActive = selectedMarketplaceSkin === skin;
                        return (
                          <button
                            key={skin}
                            onClick={() => { setSelectedMarketplaceSkin(skin); setNegotiatingOpp(null); }}
                            style={{
                              padding: '7px 16px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap',
                              background: isActive ? C.text : C.card,
                              color: isActive ? C.bg : C.textSecondary,
                              fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                            }}
                          >
                            {skin}
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>

                  <div style={{ padding: '0 16px 16px' }}>
                    {/* Campaign search bar */}
                    {selectedMarketplaceSkin && (
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" value={creatorCampaignSearch} onChange={e => setCreatorCampaignSearch(e.target.value)} placeholder="Search campaigns by brand, title, budget..." style={{ width: '100%', background: C.card, border: `1px solid ${creatorCampaignSearch ? C.primary : C.border}`, borderRadius: '10px', padding: '10px 10px 10px 32px', color: C.text, fontSize: '13px', boxSizing: 'border-box' as const, outline: 'none' }} />
                        {creatorCampaignSearch && <button onClick={() => setCreatorCampaignSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px' }}>x</button>}
                      </div>
                    )}
                    {(<>

                    {/* Active Deals Banner */}
                    {activeDeals.length > 0 && (
                      <div style={{ background: C.card, borderRadius: '12px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', position:'relative' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${C.warning}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={C.warning} stroke="none"><path d="M12 23c-3.866 0-7-2.686-7-6 0-1.954.951-3.677 2.427-5.173C8.853 10.392 10 8.639 10 6.5c0-.381-.044-.756-.127-1.116A9.86 9.86 0 0 1 12 2a9.86 9.86 0 0 1 2.127 3.384A4.725 4.725 0 0 0 14 6.5c0 2.139 1.147 3.892 2.573 5.327C18.049 13.323 19 15.046 19 17c0 3.314-3.134 6-7 6z"/></svg>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{activeDeals.length} Active Deal{activeDeals.length>1?'s':''}</div>
                          <div style={{ fontSize: '12px', color: C.textSecondary }}>
                            {activeDeals.map(([k]) => { const [skin] = k.split(':'); return skin; }).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                          <button onClick={() => { setDealStates({}); setNegotiatingOpp(null); }} style={{ background:'none', border:`1px solid rgba(239,68,68,0.3)`, borderRadius:'6px', padding:'4px 10px', fontSize:'11px', fontWeight:600, color:'#ef4444', cursor:'pointer' }}>Clear all</button>
                          <button onClick={resetMvpDemoState} style={{ background:'#ef4444', border:'none', borderRadius:'6px', padding:'4px 10px', fontSize:'11px', fontWeight:700, color:'#fff', cursor:'pointer' }}>MVP Reset</button>
                        </div>
                      </div>
                    )}

                    {/* No skin selected prompt */}
                    {!selectedMarketplaceSkin && (
                      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.6 }}>
                          Select a category above to see opportunities matched to your ValueSkins.
                        </div>
                      </div>
                    )}

                    {/* Feature 3: Market rate intelligence panel (based on historical creator collaboration rates) */}
                    {selectedMarketplaceSkin && creatorMarketplaceTab === 'opportunities' && (() => {
                      const rate = getMarketRate(selectedMarketplaceSkin);
                      return (
                        <div style={{ background: `${C.primary}06`, border: `1px solid ${C.primary}20`, borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                          <details style={{ cursor: 'pointer' }}>
                            <summary style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', userSelect: 'none' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                              Market Rate Intelligence
                            </summary>
                            <div style={{ marginTop: '10px', fontSize: '11px', color: C.textSecondary, lineHeight: 1.6 }}>
                              <div style={{ marginBottom: '6px' }}><strong style={{ color: C.text }}>Typical rates for {selectedMarketplaceSkin}:</strong></div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                                <div style={{ background: C.card, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: '10px', color: C.textMuted }}>25th percentile</div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>${rate.low.toLocaleString()}</div>
                                </div>
                                <div style={{ background: C.card, padding: '6px 8px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: '10px', color: C.textMuted }}>75th percentile</div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>${rate.high.toLocaleString()}</div>
                                </div>
                              </div>
                              <div style={{ fontSize: '10px', color: C.textMuted }}>Mock data: {(Math.random() * 200 + 50).toFixed(0)} deals. Meta will replace with aggregated completion data.</div>
                            </div>
                          </details>
                        </div>
                      );
                    })()}

                    {/* Feature 6: Creator Pipeline View (Meta data source: deal states from backend) */}
                    {selectedMarketplaceSkin && creatorMarketplaceTab === 'pipeline' && (() => {
                      // Find deals for current creator skin (key format: creatorName|creatorSkin)
                      const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
                      const pipelineDeals = matchingCreator
                        ? Object.entries(dealStates)
                            .filter(([k]) => k === `${matchingCreator.name}|${selectedMarketplaceSkin}`)
                            .map(([key, deal]) => ({ key, ...deal }))
                        : [];

                      const columns = {
                        'Negotiating': pipelineDeals.filter(d => ['offer', 'chatroom', 'counter', 'brand_countered'].includes(d.phase)),
                        'Accepted': pipelineDeals.filter(d => d.phase === 'accepted'),
                        'In Progress': pipelineDeals.filter(d => ['checklist', 'softhold'].includes(d.phase)),
                      };

                      return (
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {Object.entries(columns).map(([colName, deals]) => (
                              <div key={colName} style={{ background: C.card, borderRadius: '12px', padding: '14px', border: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {colName}
                                  <span style={{ background: C.surfaceAlt, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', color: C.textSecondary }}>{deals.length}</span>
                                </div>
                                {deals.length === 0 ? (
                                  <div style={{ fontSize: '11px', color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No deals</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {deals.map((deal, idx) => {
                                      // Key format: creatorName|creatorSkin — find first matching opportunity by skin
                                      const opp = activeOpportunities.length > 0 ? activeOpportunities[0] : undefined;
                                      return (
                                        <div key={idx} style={{ background: C.bg, borderRadius: '8px', padding: '10px', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => { setNegotiatingOpp(0); }}>
                                          <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '3px' }}>{opp?.brand || 'Deal'}</div>
                                          <div style={{ fontSize: '10px', color: C.textSecondary, marginBottom: '4px' }}>{opp?.budget}</div>
                                          <div style={{ fontSize: '9px', color: C.textMuted, background: `${C.primary}15`, padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                            {deal.phase === 'offer' ? 'Initial offer' : deal.phase === 'chatroom' ? 'In chat' : deal.phase === 'counter' ? 'Countered' : deal.phase === 'accepted' ? 'Deal locked' : 'Active'}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {pipelineDeals.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                              <div style={{ fontSize: '14px', marginBottom: '4px' }}>No active deals</div>
                              <div style={{ fontSize: '12px' }}>Switch to Opportunities to find new brands to work with.</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Opportunities for selected skin */}
                    {creatorMarketplaceMode === 'brand' && selectedMarketplaceSkin && (
                      <>
                        {activeOpportunities.filter(opp => (!filterOppsBarterOnly || opp.willingToBarter) && (!creatorCampaignSearch.trim() || opp.brand.toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.about||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.budget||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()))).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.6 }}>
                              No campaigns targeting {selectedMarketplaceSkin} yet. Brands will create campaigns that appear here in real-time.
                            </div>
                          </div>
                        )}
                        {activeOpportunities.filter(opp => (!filterOppsBarterOnly || opp.willingToBarter) && (!creatorCampaignSearch.trim() || opp.brand.toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.about||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.budget||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()))).map((opp) => {
                          // Deal key format: creatorName|creatorSkin|oppIndex (allows multiple deals per creator)
                          // Use actual opportunity index from activeOpportunities (not filtered index)
                          const actualOppIndex = activeOpportunities.indexOf(opp);
                          const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === selectedMarketplaceSkin);
                          const dealKey = matchingCreator ? `${matchingCreator.name}|${selectedMarketplaceSkin}|${actualOppIndex}` : null;
                          const relatedDealEntries = matchingCreator
                            ? Object.entries(dealStates).filter(([k, d]) =>
                                k.startsWith(`${matchingCreator.name}|${selectedMarketplaceSkin}|`) ||
                                (d?.creatorName === matchingCreator.name && d?.creatorSkin === selectedMarketplaceSkin)
                              )
                            : [];
                          const existingDealEntry =
                            relatedDealEntries.find(([k, d]) => k === dealKey || d?.opportunityIndex === actualOppIndex) ||
                            (dealKey && dealStates[dealKey] ? [dealKey, dealStates[dealKey]] as [string, typeof dealStates[string]] : undefined);
                          const existingDeal = existingDealEntry?.[1];
                          const hasActiveDeal = !!existingDeal && existingDeal.phase !== 'brief';
                          const isDealDone = !!existingDeal && (existingDeal.creatorDealLifecycle === 'approved' || existingDeal.brandApprovalPhase === 'approved');
                          const isNegotiating = negotiatingOpp === actualOppIndex || hasActiveDeal;
                          const brandInitial = opp.brand.charAt(0).toUpperCase();
                          return (
                            <div
                              key={actualOppIndex}
                              style={{ background: C.card, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: `1px solid ${C.border}` }}
                            >
                              {/* Brand header row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.primary}, #7C3AED)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{brandInitial}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <a href={opp.brandWebsiteUrl || `https://portfolio.valueskins.com/${opp.brand.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '15px', fontWeight: 700, color: C.text, textDecoration: 'none', display: 'block' }}>{opp.brand}</a>
                                  <div style={{ fontSize: '13px', color: C.textSecondary }}>{opp.type}</div>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: C.primary }}>{opp.match}</div>
                              </div>

                              {/* Budget + deliverable pills */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{opp.budget}</span>
                                {opp.deliverables.map((d, di) => (
                                  <span key={di} style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, background: C.surfaceAlt, padding: '4px 10px', borderRadius: '20px' }}>
                                    {d.count} {d.format}{d.count > 1 ? 's' : ''}
                                  </span>
                                ))}
                                {opp.willingToBarter && <span style={{ fontSize: '12px', fontWeight: 600, color: C.success, background: `${C.success}15`, padding: '4px 10px', borderRadius: '20px' }}>Barter</span>}
                              </div>

                              {/* Action row */}
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setAskModalOpp(opp); }}
                                  style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: C.textSecondary, background: 'transparent', border: `1px solid ${C.border}`, padding: '10px', borderRadius: '10px', cursor: 'pointer' }}
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => {
                                    if (isDealDone) {
                                      setPurchaseToast('This deal is already completed and locked.');
                                      setTimeout(() => setPurchaseToast(null), 2500);
                                      return;
                                    }
                                    if (!dealKey) return;
                                    setNegotiatingOpp(actualOppIndex);
                                    // Only reset deal state if starting fresh (no active deal yet)
                                    if (!existingDeal || existingDeal.phase === 'brief') {
                                      updateDeal(dealKey, {
                                        phase: 'pending',
                                        offerAmount: opp.budget?.replace(/[^0-9]/g, '') || '5000',
                                        counterAmount: '',
                                        dealType: resolveDealType(opp.compensationType || 'Paid'),
                                        isInternationalDeal: isInternationalDeal(matchingCreator?.audienceLocation || '', opp.location || ''),
                                        poc: opp.poc,
                                        opportunityIndex: actualOppIndex,
                                        creatorName: matchingCreator?.name,
                                        creatorSkin: selectedMarketplaceSkin,
                                        creatorMarketplaceIndex: matchingCreator ? BRAND_MARKETPLACE_CREATORS.indexOf(matchingCreator) : undefined,
                                      });
                                    }
                                  }}
                                  style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#fff', background: isDealDone ? C.textMuted : hasActiveDeal ? C.success : C.primary, border: 'none', padding: '10px', borderRadius: '10px', cursor: isDealDone ? 'default' : 'pointer', opacity: isDealDone ? 0.6 : 1 }}
                                >
                                  {isDealDone ? 'Approved and Deal Completed' : hasActiveDeal ? 'Open Deal' : 'View Deal'}
                                </button>
                              </div>

                              {/* Deal Room — shown when: negotiating this opp OR there's an active deal for this opp */}
                              {(negotiatingOpp === actualOppIndex) && (
                                <div style={{ background: C.card, borderRadius: '16px', padding: '16px', border: `1px solid ${C.border}` }}>
                                  {/* Deal Room Back Button */}
                                  <button onClick={() => setNegotiatingOpp(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '0 0 10px', marginBottom: '2px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    Back to marketplace
                                  </button>
                                  {/* Deal Room header — shield + brand */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
                                        Deal Room · <a href={opp.brandWebsiteUrl || `https://portfolio.valueskins.com/${opp.brand.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: C.primary, textDecoration: 'none' }}>{opp.brand}</a>
                                      </div>
                                      <div style={{ fontSize: '12px', color: C.textMuted }}>
                                        {dealRoomPhase === 'accepted' ? 'Deal accepted — terms locked' : dealRoomPhase === 'formal_offer' ? 'Review formal offer' : 'Negotiate freely — price, terms, everything'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Feature 1: Deal Lifecycle Phase Indicator */}
                                  <div style={{ marginBottom:'12px', padding:'10px 12px', background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                                    <div style={{ fontSize:'9px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px', letterSpacing:'0.5px' }}>Deal Progression</div>
                                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                                      {(['offer_sent', 'countered', 'accepted', 'completed'] as const).map((phase, idx, arr) => {
                                        const phaseNames = { offer_sent: 'Offer Sent', countered: 'Countered', accepted: 'Accepted', completed: 'Completed' };
                                        const isActive = dealRoomPhase === phase || (dealRoomPhase === 'formal_offer' && phase === 'offer_sent') || (dealRoomPhase === 'brand_countered' && idx <= 1) || (dealRoomPhase === 'softhold' && phase === 'completed');
                                        const isCompleted = (dealRoomPhase === 'accepted' && idx < 2) || (dealRoomPhase === 'softhold' && idx < 3);
                                        return (
                                          <React.Fragment key={phase}>
                                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                                              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:isCompleted?C.success:isActive?C.primary:C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, color: isCompleted || isActive ? '#fff' : C.textMuted, transition:'all 0.2s' }}>
                                                {isCompleted ? '✓' : idx + 1}
                                              </div>
                                              <div style={{ fontSize:'8px', color: isActive ? C.primary : C.textMuted, fontWeight: isActive ? 700 : 400, textAlign:'center', minWidth:'40px' }}>{phaseNames[phase]}</div>
                                            </div>
                                            {idx < arr.length - 1 && (
                                              <div style={{ flex:1, height:'2px', background: isCompleted ? C.success : C.border, margin:'0 2px', marginTop:'-8px' }} />
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Audit trail notice */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: `${C.primary}08`, borderRadius: '10px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    <span style={{ fontSize: '11px', color: C.textSecondary }}>All messages logged with UTC timestamps</span>
                                  </div>

                                  {/* Brand identity + intent */}
                                  <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span
                                      onMouseEnter={() => setHoveredTooltip('intent')}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                      style={{ background: C.bg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${C.border}`, cursor: 'help', position: 'relative' }}
                                    >
                                      Intent: <strong style={{ color: C.text }}>Campaign</strong>
                                      {hoveredTooltip === 'intent' && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', width: 220, zIndex: 10, fontSize: 11, lineHeight: 1.5, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                          <strong>What is Intent?</strong><br/>
                                          How the brand wants to work with you:<br/>
                                          <span style={{ color: C.textSecondary }}>Explore</span> — just browsing, no commitment<br/>
                                          <span style={{ color: C.primary }}>Campaign</span> — specific paid project<br/>
                                          <span style={{ color: '#22c55e' }}>Long-term</span> — ongoing partnership/retainer
                                        </div>
                                      )}
                                    </span>
                                    <span
                                      onMouseEnter={() => setHoveredTooltip('campaign_type')}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                      style={{ background: C.bg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${C.border}`, cursor: 'help', position: 'relative' }}
                                    >
                                      Type: <strong style={{ color: C.text }}>{brandCampaignType}</strong>
                                      {hoveredTooltip === 'campaign_type' && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', width: 240, zIndex: 10, fontSize: 11, lineHeight: 1.5, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                          <strong>Campaign Types:</strong><br/>
                                          <span style={{ color: C.textSecondary }}>Product Review</span> — showcase/review their product<br/>
                                          <span style={{ color: C.primary }}>Sponsored Content</span> — branded post/reel<br/>
                                          <span style={{ color: '#22c55e' }}>Brand Ambassador</span> — represent the brand over time<br/>
                                          <span style={{ color: '#f59e0b' }}>UGC</span> — user-generated content for their ads<br/>
                                          <span style={{ color: C.textMuted }}>Affiliate</span> — earn per sale/click you drive
                                        </div>
                                      )}
                                    </span>
                                  </div>

                                  {/* Creator sees brand's offer — respond with accept or counter */}
                                  {dealRoomPhase === 'pending' && (
                                    <>
                                      <div style={{ background: 'rgba(0,149,246,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid rgba(0,149,246,0.2)` }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: C.primary, marginBottom: '6px' }}>Brand Offer Received</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                          <span style={{ fontSize: '22px', fontWeight: 800, color: C.text }}>${parseInt(dealOfferAmount || '0').toLocaleString()}</span>
                                          <span style={{ fontSize: '12px', color: C.textMuted }}>/post</span>
                                        </div>
                                        {activeDeal?.briefTitle && <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '4px' }}>Campaign: {activeDeal.briefTitle}</div>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator accepted offer: $${parseInt(dealOfferAmount || '0').toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                              const existingMsgs = activeDeal?.chatMessages || [];
                                              updateDeal(activeDealKey, { phase: 'accepted', chatMessages: [...(existingMsgs as any[]), acceptMsg] });
                                            }
                                            setPurchaseToast('Offer accepted');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Accept ${parseInt(dealOfferAmount || '0').toLocaleString()}
                                        </button>
                                        <button
                                          onClick={() => setDealRoomPhase('chatroom')}
                                          style={{ flex: 1, background: C.primary, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Counter
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const rejectMsg = { id: Date.now(), sender: 'creator' as const, text: 'Creator declined the offer', time: timeStr, isoTime: now.toISOString(), seen: false };
                                              const existingMsgs = activeDeal?.chatMessages || [];
                                              setDealRoomPhase('rejected');
                                              updateDeal(activeDealKey, { phase: 'rejected', chatMessages: [...(existingMsgs as any[]), rejectMsg] });
                                            }
                                            setNegotiatingOpp(null);
                                            setPurchaseToast('Offer rejected');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '9px', borderRadius: '8px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* Creator has sent counter, waiting for brand response */}
                                  {dealRoomPhase === 'counter' && (
                                    <div style={{ background: 'rgba(255,193,7,0.06)', borderRadius: '8px', padding: '12px', border: `1px solid rgba(255,193,7,0.2)` }}>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>Counter Offer Sent</div>
                                      <div style={{ fontSize: '12px', color: C.text, marginBottom: '8px' }}>Your counter-offer of <strong>${parseInt(dealCounterAmount || '0').toLocaleString()}</strong> has been sent to the brand.</div>
                                      <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>Waiting for their response — they can accept, reject, or send a counter-offer back.</div>
                                    </div>
                                  )}

                                  {/* Brand has accepted creator's counter-offer */}
                                  {dealRoomPhase === 'pending' && dealCounterAmount && parseInt(dealOfferAmount || '0') === parseInt(dealCounterAmount) && (
                                    <div style={{ background: 'rgba(76,175,80,0.06)', borderRadius: '8px', padding: '12px', border: `1px solid rgba(76,175,80,0.2)` }}>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.success, marginBottom: '6px' }}>Counter-Offer Accepted!</div>
                                      <div style={{ fontSize: '12px', color: C.text, marginBottom: '8px' }}>{opp.brand} accepted your counter-offer of <strong>${parseInt(dealCounterAmount).toLocaleString()}/post</strong></div>
                                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <button
                                          onClick={() => {
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator confirmed agreement at $${parseInt(dealCounterAmount).toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                            const existingMsgs = activeDeal?.chatMessages || [];
                                            updateDeal(activeDealKey!, { phase: 'accepted', chatMessages: [...(existingMsgs as any[]), acceptMsg] });
                                            setDealRoomPhase('accepted');
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Confirm & Accept
                                        </button>
                                        <button
                                          onClick={() => setShowCancelDealModal(true)}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '9px', borderRadius: '8px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'rejected' && (
                                    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </div>
                                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal Rejected</div>
                                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '14px' }}>You declined this offer. Return to marketplace to explore other opportunities.</div>
                                      <button onClick={() => setNegotiatingOpp(null)} style={{ width: '100%', background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Back to Marketplace</button>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'formal_offer' && (() => {
                                    const agreedPrice = dealCounterAmount || dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '5000';
                                    const totalPrice = parseInt(agreedPrice) || 5000;
                                    // Creator submitted this — show waiting screen, not the signing UI
                                    if (activeDeal?.formalOfferSentByCreator) {
                                      return (
                                        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,149,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                          </div>
                                          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Final Offer Submitted</div>
                                          <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.6, marginBottom: '16px' }}>
                                            Your offer of <strong>${totalPrice.toLocaleString()}</strong> has been sent to {opp.brand}.<br />
                                            Waiting for them to review and approve.
                                          </div>
                                          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', fontSize: '11px', color: C.textMuted }}>
                                            You cannot edit terms at this stage. If the brand rejects, you can renegotiate.
                                          </div>
                                        </div>
                                      );
                                    }
                                    const advPct = advancePercent;
                                    const uploadPct = uploadPercent;
                                    const approvalPct = approvalPercent;
                                    const refId = `DR-${activeDealKey ? Math.abs(activeDealKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9000 + 1000) : '0000'}-${opp.brand.replace(/\s/g, '').slice(0, 3).toUpperCase()}`;
                                    const briefText = `${opp.about || ''} ${opp.requirements?.join(' ') || ''} ${opp.deliverables?.map(d => d.format).join(', ') || ''}`;
                                    const hasSensitiveContent = isSensitiveContent(briefText) || isSensitiveContent(opp.brand);
                                    return (
                                      <>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Formal Offer — Review &amp; Accept</div>
                                        <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '14px', lineHeight: 1.5 }}>
                                          The brand has submitted their final offer based on your chat negotiation. This document is the binding record of what was agreed.
                                        </div>
                                        {/* Sensitive content disclaimer */}
                                        {hasSensitiveContent && (
                                          <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>⚠️ Content Disclaimer Required</div>
                                            <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                                              This campaign involves regulated or sensitive topics (healthcare, skincare, legal, financial, etc.). <strong>You must include clear disclaimers</strong> in your content such as:
                                              <ul style={{ margin: '6px 0 0 16px', paddingLeft: 0 }}>
                                                <li style={{ fontSize: '10px', marginBottom: '3px' }}>"This is my personal opinion/experience—not professional advice"</li>
                                                <li style={{ fontSize: '10px', marginBottom: '3px' }}>"Based on advice from my [doctor/lawyer/specialist]"</li>
                                                <li style={{ fontSize: '10px' }}>"Consult a qualified professional before acting on this"</li>
                                              </ul>
                                            </div>
                                            <div style={{ fontSize: '10px', color: C.warning, marginTop: '6px' }}>Failure to include disclaimers may result in account penalties. See <a href="/terms" style={{ color: C.warning, textDecoration: 'underline' }}>Terms &amp; Conditions</a> for details.</div>
                                          </div>
                                        )}

                                        {/* Price */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Agreed Total</div>
                                          <div style={{ fontSize: '24px', fontWeight: 800, color: C.text }}>${totalPrice.toLocaleString()}</div>
                                          <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>{opp.type}</div>
                                          {/* Rate intelligence */}
                                          {(() => {
                                            const rate = getMarketRate(selectedMarketplaceSkin || 'Creator');
                                            const isBelow = totalPrice < rate.low;
                                            const isAbove = totalPrice > rate.high;
                                            const isWithin = !isBelow && !isAbove;
                                            return (
                                              <div style={{ marginTop:'8px', background: isBelow ? 'rgba(239,68,68,0.08)' : isAbove ? 'rgba(46,125,50,0.08)' : 'rgba(0,102,204,0.06)', border:`1px solid ${isBelow ? 'rgba(239,68,68,0.2)' : isAbove ? 'rgba(46,125,50,0.2)' : 'rgba(0,102,204,0.15)'}`, borderRadius:'6px', padding:'8px' }}>
                                                <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'4px' }}>Market Rate Intelligence</div>
                                                <div style={{ fontSize:'11px', color:C.text }}>
                                                  Creators with your profile typically charge <strong>${rate.low.toLocaleString()} — ${rate.high.toLocaleString()}</strong>
                                                </div>
                                                <div style={{ fontSize:'11px', fontWeight:600, color: isBelow ? '#ef4444' : isAbove ? C.success : C.primary, marginTop:'2px' }}>
                                                  {isBelow ? 'This offer is below market rate' : isAbove ? 'This offer is above market rate' : 'This offer is within market range'}
                                                </div>
                                                <details style={{ marginTop:'6px' }}>
                                                  <summary style={{ fontSize:'10px', color:C.primary, cursor:'pointer', fontWeight:600 }}>How is this calculated?</summary>
                                                  <div style={{ marginTop:'6px', fontSize:'10px', color:C.textSecondary, lineHeight:1.6 }}>
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}><span>Follower tier ({(metrics.followers/1000).toFixed(0)}K)</span><span style={{ color:C.text, fontWeight:600 }}>Base: ${(metrics.followers/1000 < 10 ? 200 : metrics.followers/1000 < 50 ? 800 : metrics.followers/1000 < 200 ? 2500 : metrics.followers/1000 < 1000 ? 8000 : 25000).toLocaleString()}</span></div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}><span>Engagement ({metrics.engagement.toFixed(1)}%)</span><span style={{ color:C.text, fontWeight:600 }}>x{metrics.engagement > 5 ? '1.4' : metrics.engagement > 3 ? '1.15' : '1.0'}</span></div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}><span>Skin premium ({selectedMarketplaceSkin || 'Standard'})</span><span style={{ color:C.text, fontWeight:600 }}>x{['Software Engineer','Doctor','Lawyer','Investment Banker','CEO'].includes(selectedMarketplaceSkin||'') ? '1.5' : ['Actor','Musician','Professional Athlete'].includes(selectedMarketplaceSkin||'') ? '1.3' : '1.0'}</span></div>
                                                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:'3px', marginTop:'3px', display:'flex', justifyContent:'space-between', fontWeight:700, color:C.text }}><span>Mid-range</span><span>${rate.mid.toLocaleString()}</span></div>
                                                    <div style={{ display:'flex', justifyContent:'space-between' }}><span>Range (60% — 150%)</span><span>${rate.low.toLocaleString()} — ${rate.high.toLocaleString()}</span></div>
                                                  </div>
                                                </details>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Payment split */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Payment Schedule (your terms)</div>
                                          {[
                                            { label: 'Advance', desc: 'Paid before work begins', pct: advPct, color: C.success },
                                            { label: 'On upload', desc: 'Paid when content is submitted', pct: uploadPct, color: C.primary },
                                            { label: 'On approval', desc: 'Paid after brand signs off', pct: approvalPct, color: C.warning },
                                          ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                                              <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{row.label} <span style={{ color: C.textMuted, fontWeight: 400 }}>· {row.desc}</span></div>
                                              </div>
                                              <div style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.pct}% <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: 400 }}>(${Math.round(totalPrice * row.pct / 100).toLocaleString()})</span></div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Deliverables */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Deliverables</div>
                                          {opp.deliverables.map((d, di) => (
                                            <div key={di} style={{ fontSize: '12px', color: C.text, marginBottom: '3px' }}>{d.count}x {d.format}</div>
                                          ))}
                                          <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>Deadline: {new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                        </div>

                                        {/* Ref + timestamp */}
                                        <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                          <span style={{ fontFamily: 'monospace' }}>{refId}</span>
                                          <span>· Submitted {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                                        </div>

                                        {/* Exclusivity conflict warning */}
                                        {activeExclusivities.some(d => d.exclusivitySkin === (selectedMarketplaceSkin || '')) && (
                                          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                            <div style={{ fontSize:'11px', fontWeight:700, color:'#ef4444', marginBottom:'3px' }}>Exclusivity Conflict</div>
                                            <div style={{ fontSize:'11px', color:C.textSecondary, lineHeight:1.4 }}>
                                              You have an active exclusivity agreement with <strong>{activeExclusivities.find(d => d.exclusivitySkin === selectedMarketplaceSkin)?.brand}</strong> for this skin.
                                              Accepting this deal may violate that agreement.
                                            </div>
                                          </div>
                                        )}

                                        {/* Contract agreement */}
                                        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'12px', marginBottom:'10px' }}>
                                          <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Contract Terms</div>
                                          {[
                                            { key: 'deliverables', label: `I agree to deliver ${opp.deliverables.map(d => `${d.count}x ${d.format}`).join(', ')} by ${new Date(opp.deadline).toLocaleDateString('en-US', { month:'short', day:'numeric' })}` },
                                            { key: 'payment', label: `Payment of $${totalPrice.toLocaleString()} split as: ${advPct}% advance, ${uploadPct}% on upload, ${approvalPct}% on approval` },
                                            { key: 'usage', label: `Brand may use content for ${opp.usageRights || 'agreed period'} per usage rights terms` },
                                            { key: 'exclusivity', label: `Exclusivity: ${opp.exclusivity || 'None'} — I will not promote competing brands during this period` },
                                            { key: 'revisions', label: `Up to ${opp.revisionLimit} revision round${opp.revisionLimit !== 1 ? 's' : ''} included at no extra cost` },
                                          ].map(term => (
                                            <div key={term.key} onClick={() => setContractChecks(prev => ({ ...prev, [term.key]: !prev[term.key] }))} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 0', borderBottom:`1px solid ${C.border}`, cursor:'pointer', fontSize:'11px', color: contractChecks[term.key] ? C.text : C.textSecondary, lineHeight:1.4, transition:'color 0.15s' }}>
                                              <div style={{ width:18, height:18, borderRadius:4, border: contractChecks[term.key] ? `2px solid ${C.success}` : `2px solid ${C.border}`, background: contractChecks[term.key] ? C.success : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, transition:'all 0.15s' }}>
                                                {contractChecks[term.key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                              </div>
                                              <span style={{ textDecoration: contractChecks[term.key] ? 'line-through' : 'none', opacity: contractChecks[term.key] ? 0.7 : 1 }}>{term.label}</span>
                                            </div>
                                          ))}
                                          <div style={{ marginTop:'10px' }}>
                                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'4px' }}>Signature jurisdiction</div>
                                            <select value={signatureJurisdiction} onChange={e => setSignatureJurisdiction(e.target.value)} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'7px 8px', fontSize:'11px', color:C.text, boxSizing:'border-box', marginBottom:'8px', cursor:'pointer' }}>
                                              {[
                                                { code:'US', label:'United States (E-SIGN Act)' },
                                                { code:'EU', label:'European Union (eIDAS)' },
                                                { code:'UK', label:'United Kingdom (ECA 2000)' },
                                                { code:'IN', label:'India (IT Act 2000)' },
                                                { code:'CA', label:'Canada (PIPEDA)' },
                                                { code:'AU', label:'Australia (ETA 1999)' },
                                                { code:'BR', label:'Brazil (MP 2200-2)' },
                                                { code:'JP', label:'Japan (ESIGN Law)' },
                                                { code:'KR', label:'South Korea (DSEA)' },
                                                { code:'SG', label:'Singapore (ETA)' },
                                                { code:'AE', label:'UAE (Federal Law No. 1)' },
                                                { code:'OTHER', label:'Other jurisdiction' },
                                              ].map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
                                            </select>
                                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'4px' }}>Type your full name to sign</div>
                                            <input value={contractSignature} onChange={e => setContractSignature(e.target.value)} placeholder={profileName || 'Your Name'} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, boxSizing:'border-box', fontStyle:'italic' }} />
                                          </div>
                                        </div>

                                        {(() => {
                                          const checkedCount = ['deliverables','payment','usage','exclusivity','revisions'].filter(k => contractChecks[k]).length;
                                          const allChecked = checkedCount === 5;
                                          const signed = contractSignature.trim().length >= 2;
                                          const canAccept = allChecked && signed;
                                          return (
                                        <>
                                        {!canAccept && (
                                          <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'6px' }}>
                                            {!allChecked && <span>{checkedCount}/5 terms checked. </span>}
                                            {!signed && <span>Sign your name to continue.</span>}
                                          </div>
                                        )}
                                        <div style={{ background: 'rgba(0,149,246,0.06)', border: '1px solid rgba(0,149,246,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '10px', fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                                          ⚠️ Once you accept, terms are locked. Check all details carefully — no edits after signing.
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button
                                            disabled={!canAccept}
                                            onClick={() => {
                                              updateDeal(activeDealKey!, { phase: 'accepted', offerAmount: agreedPrice });
                                              const newApp: SharedApplication = {
                                                id: Date.now(), campaignId: -1,
                                                campaignTitle: `Deal with ${opp.brand}`,
                                                creatorProfession: selectedMarketplaceSkin || '',
                                                creatorHandle: '@creator_demo', status: 'accepted',
                                                appliedAt: new Date().toLocaleDateString(),
                                                creatorName: profileName || 'Demo Creator',
                                                creatorFollowers: `${(metrics.followers / 1000).toFixed(metrics.followers >= 1000000 ? 1 : 0)}${metrics.followers >= 1000000 ? 'M' : 'K'}`,
                                                creatorEngagement: `${metrics.engagement.toFixed(1)}%`,
                                                creatorLevel: ownedSkins.length > 0 ? getSkinLevel(selectedMarketplaceSkin || ownedSkins[0].profession, metrics.followers, ownedSkins.length) : 1,
                                                creatorMatchScore: '94%', creatorRate: rateCard.reel ? `$${rateCard.reel}` : '$3,000',
                                                creatorDealCompletionRate: 95, creatorPortfolio: [],
                                                creatorAudienceLocation: selectedCountry || 'USA', creatorAudienceAge: '25-34',
                                                creatorResponseTimeHrs: 6, creatorWebsiteUrl: `https://portfolio.valueskins.com/creator_demo`,
                                                opportunityIndex: actualOppIndex,
                                              };
                                              persistApplications([...sharedApplications, newApp]);
                                            }}
                                            style={{ flex: 2, background: canAccept ? C.success : C.border, border: 'none', padding: '11px', borderRadius: '10px', color: '#fff', fontWeight: 700, cursor: canAccept ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: canAccept ? 1 : 0.5 }}
                                          >Sign &amp; Accept Deal</button>
                                          <button
                                            onClick={() => {
                                              if (activeDealKey) {
                                                setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; });
                                              }
                                              setNegotiatingOpp(null);
                                              setPurchaseToast('Deal rejected');
                                              setTimeout(() => setPurchaseToast(null), 3000);
                                            }}
                                            style={{ flex: 1, background: 'transparent', border: `1px solid rgba(239,68,68,0.3)`, padding: '11px', borderRadius: '10px', color: 'rgba(239,68,68,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                          >Reject</button>
                                        </div>
                                        </>
                                          );
                                        })()}
                                      </>
                                    );
                                  })()}

                                  {dealRoomPhase === 'accepted' && marketplaceRole === 'creator' && (() => {
                                    // Render based on deal type
                                    if (dealType === 'barter') {
                                      // BARTER DEAL — product incoming, no money
                                      return (
                                        <>
                                          {activeDeal?.isInternationalDeal && (
                                            <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '11px', fontWeight: 700, color: C.warning, marginBottom: '4px' }}>Cross-border deal</div>
                                              <div style={{ fontSize: '10px', color: C.textSecondary, lineHeight: 1.5 }}>
                                                This is a cross-border deal. Ensure compliance with your local tax authority. ValueSkins does not provide legal advice.
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ padding: '12px', background: 'rgba(76,175,80,0.08)', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(76,175,80,0.2)' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.success, marginBottom: '4px' }}>Deal confirmed — product incoming</div>
                                            <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '8px' }}>Terms are locked and recorded. Chat remains open for coordination.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>{opp.brand} will send product</div>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '3px' }}>Deadline: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                            <div style={{ fontSize: '11px', color: C.textSecondary }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '11px', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.contactHandle}</div>
                                              <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { setDealRoomPhase('softhold'); setGoodsTrackerStatus('goods_preparing'); }} style={{ flex: 2, background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '10px', borderRadius: '8px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    } else if (dealType === 'c2c_collab') {
                                      // C2C COLLAB — no money, just content
                                      return (
                                        <>
                                          <div style={{ padding: '12px', background: 'rgba(124,58,237,0.08)', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(124,58,237,0.2)' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.accent, marginBottom: '4px' }}>Collaboration confirmed</div>
                                            <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '8px' }}>You're ready to create content together. Terms are locked and recorded.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Collaborating with {opp.brand}</div>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '11px', color: C.textSecondary }}>Deadline: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                          </div>
                                          {/* Script editor */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <button onClick={() => setShowScriptEditorCreator(v => !v)} style={{ width:'100%', background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'5px 6px', fontSize:'10px', fontWeight:700, color:C.text, cursor:'pointer', marginBottom:'6px' }}>
                                              Script {showScriptEditorCreator ? '▲' : '▼'} {scriptStatus === 'approved' && <span style={{color:C.success}}>✓</span>}
                                            </button>
                                            {showScriptEditorCreator && (
                                              <>
                                                <div style={{ fontSize:'9px', color:C.textMuted, marginBottom:'4px' }}>{scriptMode === 'non_negotiable' ? 'Non-negotiable (locked)' : scriptMode === 'discussion' ? 'Discussion' : 'Creator freedom'}</div>
                                                {scriptMode === 'non_negotiable' ? (
                                                  <div style={{ fontSize:'10px', color:C.text, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', marginBottom:'6px', whiteSpace:'pre-wrap', lineHeight:1.4, maxHeight:'100px', overflowY:'auto' }}>
                                                    {brandScriptText || 'No script provided'}
                                                  </div>
                                                ) : (
                                                  <>
                                                    <textarea
                                                      value={scriptDraft}
                                                      onChange={(e) => {
                                                        setScriptEditorText(e.target.value);
                                                        if (activeDealKey) updateDeal(activeDealKey, { scriptDraft: e.target.value, scriptStatus: 'draft', creatorScriptApproved: false, brandScriptApproved: false });
                                                      }}
                                                      rows={4}
                                                      placeholder="Draft script..."
                                                      style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', fontSize:'10px', color:C.text, fontFamily:'inherit', resize:'none', boxSizing:'border-box', marginBottom:'4px' }}
                                                    />
                                                    <div style={{ fontSize:'8px', color:C.textMuted, marginBottom:'4px' }}>{scriptDraft.length} chars · {scriptDraft.split('\n').length} lines</div>
                                                    <input type="text" value={scriptEditReason} onChange={(e) => setScriptEditReason(e.target.value)} placeholder="Reason for change (optional)" style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', fontSize:'9px', color:C.text, marginBottom:'4px', boxSizing:'border-box' }} />
                                                    <button
                                                      onClick={() => { handleScriptChange(scriptDraft, scriptEditReason); setScriptEditReason(''); }}
                                                      style={{ width:'100%', background:C.primary, border:'none', borderRadius:'4px', padding:'4px', fontSize:'9px', fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:'4px' }}
                                                    >
                                                      Save Changes
                                                    </button>
                                                  </>
                                                )}
                                                <div style={{ background:C.surfaceAlt, borderRadius:'4px', padding:'6px', marginBottom:'4px' }}>
                                                  <div style={{ fontSize:'9px', fontWeight:700, color:C.text, marginBottom:'3px' }}>Approvals</div>
                                                  {marketplaceRole === 'creator' ? (
                                                    <>
                                                      <div style={{ fontSize:'8px', color:C.textSecondary, marginBottom:'3px' }}>
                                                        {creatorScriptApproved ? '✓' : '○'} You {creatorScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color:brandScriptApproved ? C.success : C.textSecondary, marginBottom:'3px' }}>
                                                        {brandScriptApproved ? '✓' : '○'} Brand {brandScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div style={{ fontSize:'8px', color:C.textSecondary, marginBottom:'3px' }}>
                                                        {creatorScriptApproved ? '✓' : '○'} Creator {creatorScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color:brandScriptApproved ? C.success : C.textSecondary, marginBottom:'3px' }}>
                                                        {brandScriptApproved ? '✓' : '○'} You {brandScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                                {scriptMode !== 'non_negotiable' && (
                                                  <>
                                                    {!creatorScriptApproved ? (
                                                      <button
                                                        onClick={handleScriptApprove}
                                                        style={{ width:'100%', background:C.primary, border:'none', borderRadius:'6px', padding:'6px', fontSize:'10px', fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:'4px' }}
                                                      >
                                                        I Approve Script
                                                      </button>
                                                    ) : (
                                                      <button
                                                        onClick={handleScriptRevoke}
                                                        style={{ width:'100%', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', fontSize:'10px', fontWeight:700, color:C.textSecondary, cursor:'pointer', marginBottom:'4px' }}
                                                      >
                                                        Revoke Approval
                                                      </button>
                                                    )}
                                                  </>
                                                )}
                                                {scriptVersionHistory.length > 0 && (
                                                  <button
                                                    onClick={() => setShowScriptHistory(!showScriptHistory)}
                                                    style={{ width:'100%', background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px', fontSize:'9px', fontWeight:700, color:C.textSecondary, cursor:'pointer' }}
                                                  >
                                                    Version history ({scriptVersionHistory.length})
                                                  </button>
                                                )}
                                                {showScriptHistory && scriptVersionHistory.length > 0 && (
                                                  <div style={{ fontSize:'8px', color:C.textSecondary, background:C.surfaceAlt, borderRadius:'4px', padding:'4px', marginTop:'4px', maxHeight:'120px', overflowY:'auto' }}>
                                                    {scriptVersionHistory.slice(-3).reverse().map((v: any, i: number) => (
                                                      <div key={i} style={{ marginBottom:'6px', paddingBottom:'4px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                                                        <div style={{ fontWeight:700 }}>v{v.version} · {v.editedBy === 'creator' ? 'You' : 'Brand'}</div>
                                                        <div>{new Date(v.editedAt).toLocaleTimeString()}</div>
                                                        {v.reason && <div style={{color:C.textMuted}}>"{v.reason}"</div>}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '11px', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '11px', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.contactHandle}</div>
                                              <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button disabled={!creatorScriptApproved || !brandScriptApproved} onClick={() => { if(creatorScriptApproved && brandScriptApproved) { setDealRoomPhase('softhold'); setC2cContentStatus('content_creating'); } else setPurchaseToast('Both parties must approve the script first'); }} style={{ flex: 2, background: (creatorScriptApproved && brandScriptApproved) ? C.primary : C.border, border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: (creatorScriptApproved && brandScriptApproved) ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: (creatorScriptApproved && brandScriptApproved) ? 1 : 0.5 }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '10px', borderRadius: '8px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    } else {
                                      // PAID & C2C_PAID — escrow payment breakdown
                                      const agreedPrice = dealCounterAmount || dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '5000';
                                      const totalPrice = parseInt(agreedPrice) || 5000;
                                      const advPct = advancePercent;
                                      const uploadPct = uploadPercent;
                                      const approvalPct = approvalPercent;
                                      const refId = `DR-${activeDealKey ? Math.abs(activeDealKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9000 + 1000) : '0000'}-${opp.brand.replace(/\s/g, '').slice(0, 3).toUpperCase()}`;
                                      const signedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
                                      return (
                                        <>
                                          {activeDeal?.isInternationalDeal && (
                                            <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '11px', fontWeight: 700, color: C.warning, marginBottom: '4px' }}>Cross-border deal</div>
                                              <div style={{ fontSize: '10px', color: C.textSecondary, lineHeight: 1.5 }}>
                                                This is a cross-border deal. Ensure compliance with your local tax authority. ValueSkins does not provide legal advice.
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ padding: '12px', background: 'rgba(46,125,50,0.08)', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(46,125,50,0.2)' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.success, marginBottom: '4px' }}>Deal accepted</div>
                                            <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '8px' }}>Terms are locked and recorded. Chat remains open for coordination.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>${totalPrice.toLocaleString()} total</div>
                                            {[
                                              { label: 'Advance', pct: advPct },
                                              { label: 'On upload', pct: uploadPct },
                                              { label: 'On approval', pct: approvalPct },
                                            ].map(r => (
                                              <div key={r.label} style={{ fontSize: '11px', color: C.textSecondary, display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                <span>{r.label}</span>
                                                <span style={{ color: C.text, fontWeight: 600 }}>{r.pct}% (${Math.round(totalPrice * r.pct / 100).toLocaleString()})</span>
                                              </div>
                                            ))}
                                            <div style={{ marginTop: '8px', fontSize: '9px', color: C.primary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                              <span style={{ fontFamily: 'monospace' }}>{refId}</span> · {signedAt}
                                            </div>
                                          </div>

                                          {/* Script editor */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <button onClick={() => setShowScriptEditorCreator(v => !v)} style={{ width:'100%', background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'5px 6px', fontSize:'10px', fontWeight:700, color:C.text, cursor:'pointer', marginBottom:'6px' }}>
                                              Script {showScriptEditorCreator ? '▲' : '▼'} {scriptStatus === 'approved' && <span style={{color:C.success}}>✓</span>}
                                            </button>
                                            {showScriptEditorCreator && (
                                              <>
                                                <div style={{ fontSize:'9px', color:C.textMuted, marginBottom:'4px' }}>{scriptMode === 'non_negotiable' ? 'Non-negotiable (locked)' : scriptMode === 'discussion' ? 'Discussion' : 'Creator freedom'}</div>
                                                {scriptMode === 'non_negotiable' ? (
                                                  <div style={{ fontSize:'10px', color:C.text, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', marginBottom:'6px', whiteSpace:'pre-wrap', lineHeight:1.4, maxHeight:'100px', overflowY:'auto' }}>
                                                    {brandScriptText || 'No script provided'}
                                                  </div>
                                                ) : (
                                                  <>
                                                    <textarea
                                                      value={scriptDraft}
                                                      onChange={(e) => {
                                                        setScriptEditorText(e.target.value);
                                                        if (activeDealKey) updateDeal(activeDealKey, { scriptDraft: e.target.value, scriptStatus: 'draft', creatorScriptApproved: false, brandScriptApproved: false });
                                                      }}
                                                      rows={4}
                                                      placeholder="Draft script..."
                                                      style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', fontSize:'10px', color:C.text, fontFamily:'inherit', resize:'none', boxSizing:'border-box', marginBottom:'4px' }}
                                                    />
                                                    <div style={{ fontSize:'8px', color:C.textMuted, marginBottom:'4px' }}>{scriptDraft.length} chars · {scriptDraft.split('\n').length} lines</div>
                                                    <input type="text" value={scriptEditReason} onChange={(e) => setScriptEditReason(e.target.value)} placeholder="Reason for change (optional)" style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', fontSize:'9px', color:C.text, marginBottom:'4px', boxSizing:'border-box' }} />
                                                    <button
                                                      onClick={() => { handleScriptChange(scriptDraft, scriptEditReason); setScriptEditReason(''); }}
                                                      style={{ width:'100%', background:C.primary, border:'none', borderRadius:'4px', padding:'4px', fontSize:'9px', fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:'4px' }}
                                                    >
                                                      Save Changes
                                                    </button>
                                                  </>
                                                )}
                                                <div style={{ background:C.surfaceAlt, borderRadius:'4px', padding:'6px', marginBottom:'4px' }}>
                                                  <div style={{ fontSize:'9px', fontWeight:700, color:C.text, marginBottom:'3px' }}>Approvals</div>
                                                  {marketplaceRole === 'creator' ? (
                                                    <>
                                                      <div style={{ fontSize:'8px', color:C.textSecondary, marginBottom:'3px' }}>
                                                        {creatorScriptApproved ? '✓' : '○'} You {creatorScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color:brandScriptApproved ? C.success : C.textSecondary, marginBottom:'3px' }}>
                                                        {brandScriptApproved ? '✓' : '○'} Brand {brandScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div style={{ fontSize:'8px', color:C.textSecondary, marginBottom:'3px' }}>
                                                        {creatorScriptApproved ? '✓' : '○'} Creator {creatorScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color:brandScriptApproved ? C.success : C.textSecondary, marginBottom:'3px' }}>
                                                        {brandScriptApproved ? '✓' : '○'} You {brandScriptApproved ? 'approved' : 'not approved'}
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                                {scriptMode !== 'non_negotiable' && (
                                                  <>
                                                    {!creatorScriptApproved ? (
                                                      <button
                                                        onClick={handleScriptApprove}
                                                        style={{ width:'100%', background:C.primary, border:'none', borderRadius:'6px', padding:'6px', fontSize:'10px', fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:'4px' }}
                                                      >
                                                        I Approve Script
                                                      </button>
                                                    ) : (
                                                      <button
                                                        onClick={handleScriptRevoke}
                                                        style={{ width:'100%', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px', fontSize:'10px', fontWeight:700, color:C.textSecondary, cursor:'pointer', marginBottom:'4px' }}
                                                      >
                                                        Revoke Approval
                                                      </button>
                                                    )}
                                                  </>
                                                )}
                                                {scriptVersionHistory.length > 0 && (
                                                  <button
                                                    onClick={() => setShowScriptHistory(!showScriptHistory)}
                                                    style={{ width:'100%', background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px', fontSize:'9px', fontWeight:700, color:C.textSecondary, cursor:'pointer' }}
                                                  >
                                                    Version history ({scriptVersionHistory.length})
                                                  </button>
                                                )}
                                                {showScriptHistory && scriptVersionHistory.length > 0 && (
                                                  <div style={{ fontSize:'8px', color:C.textSecondary, background:C.surfaceAlt, borderRadius:'4px', padding:'4px', marginTop:'4px', maxHeight:'120px', overflowY:'auto' }}>
                                                    {scriptVersionHistory.slice(-3).reverse().map((v: any, i: number) => (
                                                      <div key={i} style={{ marginBottom:'6px', paddingBottom:'4px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                                                        <div style={{ fontWeight:700 }}>v{v.version} · {v.editedBy === 'creator' ? 'You' : 'Brand'}</div>
                                                        <div>{new Date(v.editedAt).toLocaleTimeString()}</div>
                                                        {v.reason && <div style={{color:C.textMuted}}>"{v.reason}"</div>}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '11px', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                          {/* Deadline & Rights summary */}
                                          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '11px', color: C.text, marginBottom: '3px' }}>Deadline: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                            <div style={{ fontSize: '11px', color: C.text, marginBottom: '3px' }}>Usage rights: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong></div>
                                            <div style={{ fontSize: '11px', color: C.text }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '11px', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.contactHandle}</div>
                                              <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { setDealRoomPhase('softhold'); setEscrowFunded(false); setEscrowFundingInProgress(false); setCreatorDealLifecycle('checklist'); }} style={{ flex: 2, background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '10px', borderRadius: '8px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    }
                                  })()}

                                  {(dealRoomPhase === 'chatroom' || dealRoomPhase === 'accepted' || dealRoomPhase === 'pending' || dealRoomPhase === 'counter' || dealRoomPhase === 'last_offer' || dealRoomPhase === 'softhold' || dealRoomPhase === 'checklist') && (
                                    <>
                                      {/* Chat + Sidebar layout */}
                                      <div style={{ display: 'flex', gap: '8px', minHeight: '340px' }}>
                                        {/* Chat area */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, animation: 'pulse 2s ease-in-out infinite' }} />
                                              Deal Room Chat
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '5px', padding: '2px 6px' }}>
                                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1.4s ease-in-out infinite' }} />
                                              <span style={{ fontSize: '9px', color: '#d32f2f', fontWeight: 700, letterSpacing: '0.4px' }}>AUDIT LOG</span>
                                              <span style={{ fontSize: '9px', color: C.textMuted, fontWeight: 400 }}>{chatMessages.length} documented</span>
                                            </div>
                                          </div>
                                          {/* Messages */}
                                          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px' }}>
                                            {chatMessages.map((msg, mi) => {
                                              const isMe = msg.sender === 'me' || msg.sender === marketplaceRole;
                                              return (
                                              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                <div style={{
                                                  maxWidth: '80%',
                                                  padding: '6px 10px',
                                                  borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                                                  background: isMe ? C.primary : C.surfaceAlt,
                                                  color: isMe ? '#fff' : C.text,
                                                  fontSize: '12px',
                                                  lineHeight: 1.4,
                                                }}>
                                                  {msg.text}
                                                  <div style={{ fontSize: '9px', color: msg.sender === 'me' ? 'rgba(255,255,255,0.5)' : C.textMuted, marginTop: '3px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                                      <span>{msg.time}</span>
                                                      {msg.sender === 'me' && (
                                                        <span style={{ display: 'inline-flex', gap: 1 }}>
                                                          {msg.seen ? (
                                                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="#4fc3f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,5 4,8 8,2"/><polyline points="6,5 9,8 13,2"/></svg>
                                                          ) : (
                                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,5 3.5,8 9,2"/></svg>
                                                          )}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '1px', opacity: 0.7 }}>
                                                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                      <span>Logged · {msg.isoTime ? new Date(msg.isoTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'}</span>
                                                    </div>
                                                    {msg.seen && msg.seenAt && (
                                                      <div style={{ marginTop: '1px', opacity: 0.7 }}>
                                                        Seen · {new Date(msg.seenAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                            })}
                                          </div>
                                          {/* Input */}
                                          <form onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!chatInput.trim()) return;
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const isoNow = now.toISOString();
                                            const msgSender: 'brand' | 'creator' = (marketplaceRole as 'brand' | 'creator') === 'brand' ? 'brand' : 'creator';
                                            const newMsg = { id: Date.now(), sender: msgSender, text: chatInput.trim(), time: timeStr, isoTime: isoNow, seen: false };
                                            setChatMessages(prev => [...prev, newMsg]);
                                            firebaseAddMessage(activeDealKey ?? '', newMsg);
                                            // Write to shared deal state so the other party sees the message
                                            if (activeDealKey) {
                                              const existingMsgs = activeDeal?.chatMessages || [];
                                              updateDeal(activeDealKey, { chatMessages: [...existingMsgs, newMsg] });
                                            }
                                            setChatInput('');
                                          }} style={{ display: 'flex', gap: '4px', padding: '6px', borderTop: `1px solid ${C.border}` }}>
                                            <input
                                              type="text"
                                              value={chatInput}
                                              onChange={(e) => setChatInput(e.target.value)}
                                              placeholder="Type a message..."
                                              style={{ flex: 1, padding: '6px 10px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '14px', color: C.text, fontSize: '12px', outline: 'none' }}
                                            />
                                            <button type="submit" disabled={!chatInput.trim()} style={{ padding: '6px 12px', background: chatInput.trim() ? C.primary : `${C.primary}40`, color: '#fff', border: 'none', borderRadius: '14px', fontSize: '11px', fontWeight: 600, cursor: chatInput.trim() ? 'pointer' : 'not-allowed' }}>Send</button>
                                          </form>
                                        </div>

                                        {/* Sidebar: checklist + payment */}
                                        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {/* Campaign brief */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Campaign Brief</div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text, marginBottom: '3px', lineHeight: 1.3 }}>{opp.type || opp.brand}</div>
                                            <div style={{ fontSize: '10px', color: C.textSecondary, marginBottom: '5px', lineHeight: 1.4 }}>{opp.about ? opp.about.slice(0, 80) + (opp.about.length > 80 ? '…' : '') : ''}</div>
                                            {opp.deliverables?.length > 0 && (
                                              <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '3px' }}>
                                                {opp.deliverables.map((d: {count:number;format:string}) => `${d.count}x ${d.format}`).join(', ')}
                                              </div>
                                            )}
                                            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                                              <span style={{ fontSize:'10px', color:C.success, fontWeight:700 }}>{opp.budget}</span>
                                              {opp.deadline && <span style={{ fontSize:'9px', color:C.textMuted }}>{new Date(opp.deadline).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                                            </div>
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '11px', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>

                                          {/* Phase-specific extensions */}
                                          {dealRoomPhase === 'accepted' && activeDeal && (
                                            <>
                                              <ContractView dealId={activeDealKey || ''} />
                                              <TimelineView
                                                dealId={activeDealKey || ''}
                                                timeline={[
                                                  { date: new Date(Date.now() + 7*24*60*60*1000).toISOString(), event: 'Shoot day', type: 'milestone', completed: false, reminder_sent: false, details: { time: '10:00 AM', location: 'Location TBD' } },
                                                  { date: new Date(Date.now() + 14*24*60*60*1000).toISOString(), event: 'Submit deliverables', type: 'deliverable', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 21*24*60*60*1000).toISOString(), event: 'Brand approval deadline', type: 'approval', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 28*24*60*60*1000).toISOString(), event: 'Post content (embargo date)', type: 'posting', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 35*24*60*60*1000).toISOString(), event: 'Payment due', type: 'payment', completed: false, reminder_sent: false },
                                                ]}
                                              />
                                            </>
                                          )}

                                          {dealRoomPhase === 'softhold' && activeDeal && (
                                            <DeliverablesView
                                              dealId={activeDealKey || ''}
                                              deliverables={[
                                                { id: 'del_0', name: 'Main Reel', description: 'Promotional video', deadline: new Date(Date.now() + 14*24*60*60*1000).toISOString(), status: 'pending', revisions_remaining: 3 },
                                                { id: 'del_1', name: 'Carousel Post', description: 'Multi-slide carousel (5-10 slides)', deadline: new Date(Date.now() + 14*24*60*60*1000).toISOString(), status: 'pending', revisions_remaining: 3 },
                                              ]}
                                            />
                                          )}

                                          {dealRoomPhase === 'checklist' && activeDeal && (
                                            <InvoiceView
                                              dealId={activeDealKey || ''}
                                              invoice={{
                                                id: `inv_${activeDealKey}`,
                                                amount: parseInt((activeDeal.offerAmount || dealOfferAmount || '0').replace(/[^0-9]/g, '') || '0'),
                                                due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
                                                status: 'sent',
                                                days_overdue: 0,
                                              }}
                                            />
                                          )}

                                          {/* Counter-offer — hidden once formal offer sent */}
                                          {!activeDeal?.formalOfferSentByCreator && <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your Counter</div>
                                            <div style={{ fontSize: '10px', color: C.textSecondary, marginBottom: '4px' }}>
                                              Brand offer: <strong style={{ color: C.text }}>${parseInt(dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '0').toLocaleString()}</strong>
                                            </div>
                                            {/* Feature 4: Fair counter-offer suggestion */}
                                            {(() => {
                                              const brandOffer = parseInt(dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '0');
                                              // Find creator's standard rate from BRAND_MARKETPLACE_CREATORS
                                              const matchingCreator = BRAND_MARKETPLACE_CREATORS.find(c => c.valueSkin === opp.type);
                                              const creatorRate = matchingCreator ? parseInt(matchingCreator.rate.replace(/[^0-9]/g, '') || '0') : brandOffer;
                                              // Fair suggestion: if offer is below creator's rate, suggest rate; otherwise suggest accepting or small adjustment
                                              let suggestedPrice = brandOffer;
                                              let reason = 'Market-aligned';
                                              if (brandOffer < creatorRate * 0.9) {
                                                // Brand offer is 10%+ below creator's rate — suggest creator's standard
                                                suggestedPrice = creatorRate;
                                                reason = 'Your standard rate';
                                              } else if (brandOffer >= creatorRate * 0.95 && brandOffer <= creatorRate * 1.1) {
                                                // Brand offer is within 5-10% of creator's rate — fair, no adjustment needed
                                                suggestedPrice = brandOffer;
                                                reason = 'Fair offer — accept or negotiate minimally';
                                              } else if (brandOffer > creatorRate * 1.1) {
                                                // Brand offer is 10%+ above rate — it's generous, accept it
                                                suggestedPrice = brandOffer;
                                                reason = 'Above standard — consider accepting';
                                              } else {
                                                // Minor adjustment if below standard
                                                suggestedPrice = Math.round(Math.max(brandOffer, creatorRate * 0.95) / 50) * 50;
                                                reason = 'Reasonable adjustment';
                                              }
                                              return (
                                                <div style={{ fontSize: '10px', color: C.success, marginBottom: '6px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                                                  Suggested: ${suggestedPrice.toLocaleString()} ({reason})
                                                </div>
                                              );
                                            })()}
                                            <input
                                              type="number"
                                              value={dealCounterAmount}
                                              onChange={e => setDealCounterAmount(e.target.value)}
                                              placeholder="Your ask ($)"
                                              style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: C.text, boxSizing: 'border-box', marginBottom: '4px' }}
                                            />
                                            <button
                                              disabled={!dealCounterAmount || parseInt(dealCounterAmount) <= 0}
                                              onClick={() => {
                                                const brandOffer = parseInt(dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '0');
                                                const creatorAsk = parseInt(dealCounterAmount);
                                                const now = new Date();
                                                const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                                const counterMsg = { id: Date.now(), sender: 'creator' as const, text: `Counter-offer: $${creatorAsk.toLocaleString()} (brand offered $${brandOffer.toLocaleString()})`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                                setChatMessages(prev => [...prev, counterMsg]);
                                                firebaseAddMessage(activeDealKey ?? '', counterMsg);
                                                // Write counter amount + phase + chat messages to shared deal state
                                                // so brand sees the update in real-time under Sent Deals
                                                if (activeDealKey) {
                                                  const existingMsgs = activeDeal?.chatMessages || [];
                                                  updateDeal(activeDealKey, {
                                                    phase: 'counter' as DealRoomPhase,
                                                    counterAmount: String(creatorAsk),
                                                    chatMessages: [...existingMsgs, counterMsg],
                                                  });
                                                }
                                                firebaseSendNotification(opp?.brand || 'Brand', 'message', `Creator countered: $${creatorAsk.toLocaleString()} (you offered $${brandOffer.toLocaleString()})`);
                                                setPurchaseToast(`Counter sent: $${creatorAsk.toLocaleString()}`);
                                                setTimeout(() => setPurchaseToast(null), 2000);
                                              }}
                                              style={{ width: '100%', background: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? C.primary : C.border, border: 'none', padding: '6px', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '11px', cursor: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? 'pointer' : 'not-allowed', opacity: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? 1 : 0.5 }}
                                            >
                                              Send Counter
                                            </button>
                                          </div>}

                                          {/* Payment split */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Payment Plan</div>
                                            {[
                                              { label: 'Advance', value: advancePercent, color: C.success, key: 'advance' as const },
                                              { label: 'On upload', value: uploadPercent, color: C.primary, key: 'upload' as const },
                                              { label: 'On approval', value: approvalPercent, color: C.warning, key: 'approval' as const },
                                            ].map(s => (
                                              <div key={s.key} style={{ marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                                                  <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                                                  <span style={{ color: C.text, fontWeight: 700 }}>{s.value}%</span>
                                                </div>
                                                <input type="range" min={0} max={100} step={5} value={s.value} onChange={e => {
                                                  const newVal = parseInt(e.target.value);
                                                  const others = [advancePercent, uploadPercent, approvalPercent];
                                                  const idx = s.key === 'advance' ? 0 : s.key === 'upload' ? 1 : 2;
                                                  const diff = newVal - others[idx];
                                                  const otherIdxs = [0,1,2].filter(i => i !== idx);
                                                  const otherTotal = otherIdxs.reduce((sum, i) => sum + others[i], 0);
                                                  const newOthers = [...others];
                                                  newOthers[idx] = newVal;
                                                  if (otherTotal > 0) {
                                                    otherIdxs.forEach(i => { newOthers[i] = Math.max(0, Math.round(others[i] - diff * (others[i] / otherTotal))); });
                                                  } else {
                                                    otherIdxs.forEach((i, j) => { newOthers[i] = j === 0 ? 100 - newVal : 0; });
                                                  }
                                                  const total = newOthers.reduce((a, b) => a + b, 0);
                                                  if (total !== 100 && otherIdxs.length > 0) newOthers[otherIdxs[0]] += 100 - total;
                                                  setPaymentSplit(newOthers[0], newOthers[1], newOthers[2]);
                                                }} style={{ width: '100%', height: '4px', accentColor: s.color }} />
                                              </div>
                                            ))}
                                            {advancePercent + uploadPercent + approvalPercent !== 100 && (
                                              <div style={{ fontSize:'9px', color:'#ef4444', marginTop:'2px' }}>Must total 100%</div>
                                            )}
                                          </div>

                                          {/* Brand submits formal offer — hidden once submitted */}
                                          {!activeDeal?.formalOfferSentByCreator && (
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Finalize</div>
                                            <button
                                              onClick={() => {
                                                if (activeDealKey) {
                                                  updateDeal(activeDealKey, { phase: 'formal_offer' as DealRoomPhase, formalOfferSentByCreator: true });
                                                }
                                              }}
                                              style={{ width: '100%', background: C.primary, border: 'none', padding: '7px', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '11px', cursor: 'pointer', lineHeight: 1.3 }}
                                            >
                                              Submit Formal Offer
                                            </button>
                                          </div>
                                          )}

                                          {/* Reject brand */}
                                          <button
                                            onClick={() => {
                                              if (activeDealKey) {
                                                setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; });
                                              }
                                              setNegotiatingOpp(null);
                                              setPurchaseToast('Deal declined — brand notified');
                                              setTimeout(() => setPurchaseToast(null), 3000);
                                            }}
                                            style={{ width: '100%', background: 'none', border: `1px solid rgba(239,68,68,0.3)`, padding: '7px', borderRadius: '6px', color: 'rgba(239,68,68,0.85)', fontWeight: 600, fontSize: '10px', cursor: 'pointer', marginTop: '4px' }}
                                          >
                                            Reject Brand
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Creator sees brand's last offer — accept or walk away */}
                                  {dealRoomPhase === 'last_offer' && (
                                    <>
                                      <div style={{ background: 'rgba(230,81,0,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid rgba(230,81,0,0.2)` }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: C.warning, marginBottom: '6px' }}>Final Offer from Brand</div>
                                        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>${parseInt(dealOfferAmount || '0').toLocaleString()}<span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 400 }}>/post</span></div>
                                        <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.4 }}>The brand has indicated this is their final offer. You can accept or decline.</div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator accepted final offer: $${parseInt(dealOfferAmount || '0').toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                              const existingMsgs = activeDeal?.chatMessages || [];
                                              updateDeal(activeDealKey, { phase: 'accepted', offerAmount: dealOfferAmount, chatMessages: [...(existingMsgs as any[]), acceptMsg] });
                                            }
                                            setPurchaseToast('Deal accepted');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Accept ${parseInt(dealOfferAmount || '0').toLocaleString()}
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const declineMsg = { id: Date.now(), sender: 'creator' as const, text: 'Creator declined the final offer.', time: timeStr, isoTime: now.toISOString(), seen: false };
                                              const existingMsgs = activeDeal?.chatMessages || [];
                                              updateDeal(activeDealKey, { phase: 'rejected', chatMessages: [...(existingMsgs as any[]), declineMsg] });
                                            }
                                            setNegotiatingOpp(null);
                                            setPurchaseToast('Deal declined');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.4)`, padding: '9px', borderRadius: '8px', color: 'rgba(239,68,68,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* Creator sees brand withdrawal */}
                                  {dealRoomPhase === 'rejected' && (
                                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </div>
                                      <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal Ended</div>
                                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '16px' }}>The other party has withdrawn from this deal.</div>
                                      <button
                                        onClick={() => setNegotiatingOpp(null)}
                                        style={{ background: C.primary, border: 'none', padding: '8px 20px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                      >
                                        Back to Marketplace
                                      </button>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'checklist' && (
                                    <>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Expectation Checklist</div>
                                      {[
                                        { key: 'Content format (posts / reels / stories)', req: true },
                                        { key: 'Maximum revision rounds', req: true },
                                        { key: 'Usage rights & exclusivity', req: true },
                                        { key: 'Payment schedule confirmed', req: true },
                                        { key: 'Final deliverable deadline', req: true },
                                        { key: 'Approval process defined', req: false },
                                        { key: 'Metrics reporting agreed', req: false },
                                      ].map((item, ci) => (
                                        <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                          </div>
                                          <span style={{ fontSize: '12px', color: C.text, flex: 1 }}>{item.key}</span>
                                          {item.req && <span style={{ fontSize: '9px', color: C.primary, fontWeight: 700, textTransform: 'uppercase' }}>Required</span>}
                                        </div>
                                      ))}
                                      <button onClick={() => {
                                        setDealRoomPhase('softhold');
                                        setEscrowFunded(false);
                                        setEscrowFundingInProgress(false);
                                        if (activeDealKey) {
                                          updateDeal(activeDealKey, { phase: 'softhold' });
                                        }
                                      }} style={{ width: '100%', background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginTop: '12px' }}>
                                        Confirm &amp; Finalise Deal
                                      </button>
                                    </>
                                  )}

                                  {/* Escrow funding gate — brand must fund before creator uploads */}
                                  {dealRoomPhase === 'softhold' && (() => {
                                    switch(dealType) {
                                      // PAID & C2C_PAID: Escrow workflow
                                      case 'paid':
                                      case 'c2c_paid': {
                                        const agreedPrice = parseInt(dealCounterAmount || dealOfferAmount || '5000') || 5000;
                                        const advPct = advancePercent;
                                        const uploadPct = uploadPercent;
                                        const approvalPct = approvalPercent;

                                        // Escrow gate — reads from shared deal state (brand funds escrow from their side)
                                        if (!escrowFunded && creatorDealLifecycle === 'checklist') {
                                          // Check if brand has funded escrow via shared deal state
                                          if (activeDeal?.escrowFunded) {
                                            // Brand funded — auto-advance creator to deliverables phase
                                            setTimeout(() => {
                                              setEscrowFunded(true);
                                              setCreatorDealLifecycle('deliverables');
                                              if (activeDealKey) {
                                                updateDeal(activeDealKey, { creatorDealLifecycle: 'deliverables' });
                                              }
                                            }, 0);
                                            const advanceAmt = Math.round(agreedPrice * 0.3);
                                            return (
                                              <div style={{ textAlign:'center', padding:'16px 0' }}>
                                                <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(0,212,106,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                </div>
                                                <div style={{ fontSize:'14px', fontWeight:700, color:C.success, marginBottom:'4px' }}>Escrow Funded</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'8px' }}>Brand deposited ${agreedPrice.toLocaleString()} into escrow.</div>
                                                <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
                                                  <div style={{ fontSize:'13px', fontWeight:700, color:C.success }}>Advance paid: ${advanceAmt.toLocaleString()}</div>
                                                  <div style={{ fontSize:'11px', color:C.textSecondary, marginTop:'2px' }}>30% advance deposited to your account. Begin deliverables to unlock remaining milestones.</div>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return (
                                            <div style={{ padding:'8px 0 16px' }}>
                                              {/* Phase status bar — creator view */}
                                              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'16px', padding:'8px 10px', background:'rgba(0,149,246,0.06)', borderRadius:'8px', border:'1px solid rgba(0,149,246,0.2)' }}>
                                                {[
                                                  { label:'Offer', done: true },
                                                  { label:'Accepted', done: true },
                                                  { label:'Brand Funds', done: false, active: true },
                                                  { label:'Your Work', done: false },
                                                ].map((s, i) => (
                                                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'4px', flex: i < 3 ? 'none' : 1 }}>
                                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                                                      <div style={{ width:'18px', height:'18px', borderRadius:'50%', background: s.done ? C.success : s.active ? C.primary : C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'#fff', fontWeight:700 }}>
                                                        {s.done ? '✓' : i + 1}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color: s.done ? C.success : s.active ? C.primary : C.textMuted, fontWeight: s.active ? 700 : 400, whiteSpace:'nowrap' }}>{s.label}</div>
                                                    </div>
                                                    {i < 3 && <div style={{ width:'16px', height:'1px', background: s.done ? C.success : C.border, marginBottom:'10px' }} />}
                                                  </div>
                                                ))}
                                              </div>
                                              <div style={{ textAlign:'center' }}>
                                              <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                              </div>
                                              <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Awaiting Escrow</div>
                                              <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px', lineHeight:1.5 }}>
                                                The brand must deposit <strong>${agreedPrice.toLocaleString()}</strong> into escrow before you can begin work. The advance (30%) will be paid directly to you on deposit.
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'12px' }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                                                  <span style={{ fontSize:'11px', color:C.textMuted }}>Escrow account</span>
                                                  <span style={{ fontSize:'12px', fontWeight:700, color:C.textMuted }}>Awaiting brand deposit</span>
                                                </div>
                                                <div style={{ width:'100%', height:'6px', background:C.card, borderRadius:'3px', overflow:'hidden' }}>
                                                  <div style={{ width:'0%', height:'100%', background:C.border, borderRadius:'3px' }} />
                                                </div>
                                                <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'6px' }}>
                                                  $0 / ${agreedPrice.toLocaleString()} deposited
                                                </div>
                                              </div>
                                              </div>{/* end textAlign:center */}
                                            </div>
                                          );
                                        }

                                        // Deliverables phase (when escrowFunded && lifecycle==='deliverables')
                                        if (creatorDealLifecycle === 'deliverables') {
                                          const oppDeliverables = opp.deliverables?.length ? opp.deliverables : [{ format: 'Video Content', count: 1 }];
                                          // Expand deliverables into individual slots: [{format:'Reel',count:2}] → [{format:'Reel',label:'Reel 1 of 2'},{format:'Reel',label:'Reel 2 of 2'}]
                                          const expandedSlots: { format: string; label: string }[] = oppDeliverables.flatMap((d: {format:string;count:number}) =>
                                            d.count === 1
                                              ? [{ format: d.format, label: d.format }]
                                              : Array.from({ length: d.count }, (_, i) => ({ format: d.format, label: `${d.format} (${i + 1} of ${d.count})` }))
                                          );
                                          const totalSlots = expandedSlots.length;
                                          const deadlineStr = opp.deadline ? new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                                          const daysLeft = opp.deadline ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000) : null;
                                          const allUploaded = totalSlots > 0 && Array.from({ length: totalSlots }, (_, i) => i).every(i => deliverableStatuses[i] === 'uploaded' || deliverableStatuses[i] === 'approved');
                                          return (
                                            <>
                                              <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>Upload Deliverables</div>
                                              {deadlineStr && (
                                                <div style={{ background: daysLeft !== null && daysLeft <= 3 ? 'rgba(239,68,68,0.08)' : C.bg, border: `1px solid ${daysLeft !== null && daysLeft <= 3 ? 'rgba(239,68,68,0.3)' : C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                  <div>
                                                    <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px' }}>Deadline</div>
                                                    <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{deadlineStr}</div>
                                                  </div>
                                                  {daysLeft !== null && (
                                                    <div style={{ fontSize:'12px', fontWeight:700, color: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : C.success }}>
                                                      {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                                <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Rights & Exclusivity</div>
                                                <div style={{ fontSize:'11px', color:C.text, marginBottom:'3px' }}>Usage rights: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong></div>
                                                <div style={{ fontSize:'11px', color:C.text, marginBottom:'3px' }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                                <div style={{ fontSize:'11px', color:C.text }}>Revision limit: <strong>{opp.revisionLimit} round{opp.revisionLimit !== 1 ? 's' : ''}</strong></div>
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                                <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Deliverables ({totalSlots} item{totalSlots !== 1 ? 's' : ''})</div>
                                                {expandedSlots.map((d, di) => {
                                                  const status = deliverableStatuses[di] || 'pending';
                                                  const link = deliverableLinks[di] || '';
                                                  const inputVal = deliverableLinkInputs[di] || '';
                                                  const isValidContentUrl = (u: string) => /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(u);
                                                  const postId = link.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1];
                                                  return (
                                                    <div key={di} style={{ borderRadius:'8px', marginBottom:'8px', border:`1px solid ${status === 'approved' ? 'rgba(0,212,106,0.25)' : status === 'uploaded' ? 'rgba(0,149,246,0.25)' : C.border}`, overflow:'hidden' }}>
                                                      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background: status === 'uploaded' ? 'rgba(0,149,246,0.04)' : status === 'approved' ? 'rgba(0,212,106,0.04)' : 'transparent' }}>
                                                        <div style={{ width:'20px', height:'20px', borderRadius:'5px', background: status === 'approved' ? C.success : status === 'uploaded' ? C.primary : C.border, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                          {status !== 'pending' && status !== 'linking' ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <span style={{ fontSize:'10px', color:'#fff', fontWeight:700 }}>{di + 1}</span>}
                                                        </div>
                                                        <div style={{ flex:1 }}>
                                                          <div style={{ fontSize:'12px', fontWeight:600, color:C.text }}>{d.label}</div>
                                                          <div style={{ fontSize:'10px', color: status === 'approved' ? C.success : status === 'uploaded' ? C.primary : C.textMuted }}>
                                                            {status === 'approved' ? 'Approved by brand' : status === 'uploaded' ? 'Submitted — awaiting review' : status === 'linking' ? 'Enter your content link below' : 'Not yet submitted'}
                                                          </div>
                                                        </div>
                                                        {status === 'pending' && (
                                                          <button onClick={() => setDeliverableStatuses(prev => ({ ...prev, [di]: 'linking' }))} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'4px 10px', color:'#fff', fontSize:'10px', fontWeight:600, cursor:'pointer', flexShrink:0 }}>Submit link</button>
                                                        )}
                                                        {status === 'linking' && (
                                                          <button onClick={() => setDeliverableStatuses(prev => ({ ...prev, [di]: 'pending' }))} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'3px 8px', color:C.textMuted, fontSize:'10px', cursor:'pointer', flexShrink:0 }}>Cancel</button>
                                                        )}
                                                      </div>
                                                      {status === 'linking' && (
                                                        <div style={{ padding:'10px', borderTop:`1px solid ${C.border}`, background:C.bg }}>
                                                          <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'6px' }}>Paste the link to your published content</div>
                                                          <div style={{ display:'flex', gap:'6px' }}>
                                                            <input
                                                              type="text"
                                                              value={inputVal}
                                                              onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, [di]: e.target.value }))}
                                                              placeholder="https://www.portfolio.valueskins.com/p/..."
                                                              style={{ flex:1, background:C.surfaceAlt, border:`1px solid ${isValidContentUrl(inputVal) ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'11px', fontFamily:'inherit', outline:'none' }}
                                                            />
                                                            <button
                                                              disabled={!isValidContentUrl(inputVal)}
                                                              onClick={() => {
                                                                const isDuplicate = Object.values(deliverableLinks).some((existingLink, idx) => existingLink === inputVal && idx !== di);
                                                                if (isDuplicate) {
                                                                  alert('This link has already been submitted for another deliverable. Please use a different post.');
                                                                  return;
                                                                }
                                                                setDeliverableLinks(prev => ({ ...prev, [di]: inputVal }));
                                                                setDeliverableStatuses(prev => ({ ...prev, [di]: 'uploaded' }));
                                                                setDeliverableLinkInputs(prev => ({ ...prev, [di]: '' }));
                                                                const newUploadItem: UploadedItem = {
                                                                  id: Date.now().toString() + Math.random(),
                                                                  brand: opp.brand || 'Unknown',
                                                                  dealId: activeDealKey || '',
                                                                  format: d.format,
                                                                  link: inputVal,
                                                                  uploadedAt: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'2-digit' })
                                                                };
                                                                setUploadedItems(prev => [...prev, newUploadItem]);
                                                              }}
                                                              style={{ background: isValidContentUrl(inputVal) ? C.success : C.border, border:'none', borderRadius:'6px', padding:'7px 12px', color:'#fff', fontSize:'11px', fontWeight:700, cursor: isValidContentUrl(inputVal) ? 'pointer' : 'not-allowed', opacity: isValidContentUrl(inputVal) ? 1 : 0.5, flexShrink:0 }}
                                                            >Confirm</button>
                                                          </div>
                                                          {inputVal && !isValidContentUrl(inputVal) && (
                                                            <div style={{ fontSize:'10px', color:'#ef4444', marginTop:'4px' }}>Must be an portfolio.valueskins.com/p/, /reels/, or /tv/ link</div>
                                                          )}
                                                        </div>
                                                      )}
                                                      {(status === 'uploaded' || status === 'approved') && link && (
                                                        <div style={{ padding:'10px', borderTop:`1px solid ${C.border}`, background:C.bg, display:'flex', gap:'10px', alignItems:'flex-start' }}>
                                                          <div style={{ width:52, height:52, borderRadius:'6px', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6m-3-3v6"/></svg>
                                                          </div>
                                                          <div style={{ flex:1, minWidth:0 }}>
                                                            <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, marginBottom:'2px', textTransform:'uppercase', letterSpacing:'0.4px' }}>{d.format}</div>
                                                            <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize:'10px', color:C.primary, textDecoration:'none', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{postId ? `portfolio.valueskins.com/p/${postId}` : link}</a>
                                                            <div style={{ fontSize:'9px', color:C.textMuted, marginTop:'3px' }}>Submitted {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                                                          </div>
                                                          {status === 'approved' && (
                                                            <div style={{ fontSize:'9px', fontWeight:700, color:C.success, background:'rgba(0,212,106,0.1)', padding:'2px 7px', borderRadius:'6px', flexShrink:0 }}>Approved</div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                                <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Payment Milestones</div>
                                                {[
                                                  { key: 'advance' as const, label: 'Advance', pct: advPct, color: C.success },
                                                  { key: 'upload' as const, label: 'On upload', pct: uploadPct, color: C.primary },
                                                  { key: 'approval' as const, label: 'On approval', pct: approvalPct, color: '#f59e0b' },
                                                ].map(m => (
                                                  <div key={m.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${C.border}` }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: paymentMilestones[m.key] === 'released' ? C.success : m.color, opacity: paymentMilestones[m.key] === 'released' ? 1 : 0.4 }} />
                                                      <span style={{ fontSize:'11px', color:C.text, fontWeight:500 }}>{m.label}</span>
                                                    </div>
                                                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                                      <span style={{ fontSize:'12px', fontWeight:700, color: paymentMilestones[m.key] === 'released' ? C.success : C.text }}>${Math.round(agreedPrice * m.pct / 100).toLocaleString()}</span>
                                                      <span style={{ fontSize:'9px', fontWeight:600, color: paymentMilestones[m.key] === 'released' ? C.success : C.textMuted, textTransform:'uppercase' }}>{paymentMilestones[m.key] === 'released' ? 'Paid' : 'Pending'}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'10px', marginBottom:'12px', fontSize:'11px', color:C.textSecondary }}>
                                                Brand payment on-hold: ${agreedPrice.toLocaleString()} — released per milestones above
                                              </div>
                                              {allUploaded && !submittedForReview && activeDeal?.creatorDealLifecycle !== 'submitted' && activeDeal?.creatorDealLifecycle !== 'approved' && (
                                                <button onClick={() => {
                                                  setSubmittedForReview(true);
                                                  const agreedAmt = parseInt(dealCounterAmount || '5000');
                                                  setCreatorDealLifecycle('submitted');
                                                  setPaymentMilestones({ advance: 'released', upload: 'released', approval: 'pending' });
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, {
                                                      creatorDealLifecycle: 'submitted',
                                                      brandApprovalPhase: 'reviewing',
                                                      paymentMilestones: { advance: 'released', upload: 'released', approval: 'pending' },
                                                      deliverableStatuses: deliverableStatuses,
                                                      deliverableLinks: deliverableLinks,
                                                    });
                                                    firebaseSendNotification(opp?.brand || 'Brand', 'application', `Deliverables submitted: ${agreedAmt.toLocaleString()} – Advance & upload milestones released. Awaiting approval.`);
                                                  }
                                                  setPurchaseToast(`Submitted for review — $${Math.round(agreedAmt * (advancePercent + uploadPercent) / 100).toLocaleString()} released, $${Math.round(agreedAmt * approvalPercent / 100).toLocaleString()} pending approval`);
                                                  setTimeout(() => setPurchaseToast(null), 4000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'13px', marginBottom:'8px' }}>
                                                  Submit for Review
                                                </button>
                                              )}
                                              {allUploaded && (submittedForReview || activeDeal?.creatorDealLifecycle === 'submitted') && activeDeal?.creatorDealLifecycle !== 'approved' && (
                                                <div style={{ width:'100%', padding:'10px', background:'rgba(0,149,246,0.08)', border:`1px solid rgba(0,149,246,0.25)`, borderRadius:'8px', color:C.primary, fontWeight:600, fontSize:'13px', textAlign:'center', marginBottom:'8px' }}>
                                                  ⏳ Waiting for brand&apos;s approval
                                                </div>
                                              )}
                                              <button onClick={() => setShowCancelDealModal(true)} style={{ width:'100%', background:'none', border:`1px solid rgba(239,68,68,0.3)`, padding:'8px', borderRadius:'8px', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>
                                                Cancel Deal
                                              </button>
                                            </>
                                          );
                                        }

                                        // Submitted phase (when lifecycle==='submitted')
                                        if (creatorDealLifecycle === 'submitted') {
                                          return (
                                            <>
                                              <div style={{ background:'rgba(0,102,204,0.06)', border:`1px solid rgba(0,102,204,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Deliverables Submitted</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Waiting for brand approval — typically within 48h.</div>
                                                <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'2px' }}>Advance: <span style={{ color:C.success, fontWeight:600 }}>Paid</span></div>
                                                <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'2px' }}>Upload milestone: <span style={{ color:C.success, fontWeight:600 }}>Paid</span></div>
                                                <div style={{ fontSize:'10px', color:C.textMuted }}>Approval milestone: <span style={{ color:'#f59e0b', fontWeight:600 }}>Pending brand approval</span></div>
                                              </div>
                                              <div style={{ textAlign:'center', padding:'8px', fontSize:'11px', color:C.textMuted }}>
                                                Brand will review and approve from their deal room
                                              </div>
                                            </>
                                          );
                                        }

                                        // Approved phase (when lifecycle==='approved')
                                        if (creatorDealLifecycle === 'approved') {
                                          return (
                                            <>
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Approved and Deal Completed</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>All deliverables approved. All milestones paid.</div>
                                                <button
                                                  onClick={() => { if (activeDealKey && activeDeal) downloadDealSummary(activeDealKey, activeDeal); }}
                                                  style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'9px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px', marginBottom:'12px' }}
                                                >
                                                  Download Legal Deal Summary
                                                </button>
                                                <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'12px', marginBottom:'14px' }}>
                                                  <div style={{ fontSize:'11px', color:C.textMuted, marginBottom:'2px' }}>Total Earnings</div>
                                                  <div style={{ fontSize:'22px', fontWeight:800, color:C.success }}>${parseInt(dealCounterAmount || '5000').toLocaleString()}</div>
                                                  <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'4px' }}>Advance + Upload + Approval milestones</div>
                                                </div>
                                                {!ratingSubmitted ? (
                                                  <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'14px', textAlign:'left' }}>
                                                    <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Rate this brand</div>
                                                    <div style={{ display:'flex', gap:'6px', marginBottom:'10px', justifyContent:'center' }}>
                                                      {[1,2,3,4,5].map(star => (
                                                        <button key={star} onClick={() => setDealRating(star)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'24px', color: star <= dealRating ? '#f59e0b' : C.border, transition:'color 0.1s', padding:'2px' }}>
                                                          {star <= dealRating ? '\u2605' : '\u2606'}
                                                        </button>
                                                      ))}
                                                    </div>
                                                    <textarea value={dealRatingComment} onChange={e => setDealRatingComment(e.target.value)} placeholder="How was working with this brand?" rows={2} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, resize:'none', boxSizing:'border-box' }} />
                                                    <button onClick={() => { setRatingSubmitted(true); if (activeDealKey) { updateDeal(activeDealKey, { creatorRating: dealRating, creatorRatingComment: dealRatingComment, displayCreatorRating: false }); } setPurchaseToast('Rating submitted'); setTimeout(() => setPurchaseToast(null), 3000); }} disabled={dealRating === 0} style={{ width:'100%', background: dealRating > 0 ? C.primary : C.border, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, fontSize:'12px', cursor: dealRating > 0 ? 'pointer' : 'not-allowed', marginTop:'8px', opacity: dealRating > 0 ? 1 : 0.5 }}>
                                                      Submit Rating
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ background:'rgba(0,102,204,0.06)', border:`1px solid rgba(0,102,204,0.2)`, borderRadius:'8px', padding:'10px', marginBottom:'14px' }}>
                                                    <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'8px' }}>
                                                      Rating submitted: {dealRating}/5
                                                    </div>
                                                    <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:C.text, cursor:'pointer' }}>
                                                      <input type="checkbox" checked={displayCreatorRating} onChange={e => { setDisplayCreatorRating(e.target.checked); if (activeDealKey) { updateDeal(activeDealKey, { displayCreatorRating: e.target.checked }); } }} style={{ cursor:'pointer' }} />
                                                      Show this review on my ValueSkins profile
                                                    </label>
                                                  </div>
                                                )}
                                                <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px', textAlign:'left' }}>
                                                  <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Escrow Release</div>
                                                  {[
                                                    { label:'Advance', status:'Released on deal acceptance' },
                                                    { label:'Upload milestone', status:'Released on content submission' },
                                                    { label:'Approval milestone', status:'Released on brand approval' },
                                                  ].map(m => (
                                                    <div key={m.label} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 0', fontSize:'11px' }}>
                                                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.success }} />
                                                      <span style={{ color:C.text, flex:1 }}>{m.label}</span>
                                                      <span style={{ color:C.success, fontSize:'10px' }}>{m.status}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                                {opp && (
                                                  <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px', textAlign:'left' }}>
                                                    <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Active Rights</div>
                                                    <div style={{ fontSize:'11px', color:C.text, marginBottom:'3px' }}>
                                                      Content usage: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong>
                                                      <span style={{ color:C.textMuted }}> — expires {new Date(Date.now() + (opp.revisionLimit || 3) * 30 * 86400000).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span>
                                                    </div>
                                                    {opp.exclusivity && opp.exclusivity !== 'None' && (
                                                      <div style={{ fontSize:'11px', color:C.text }}>
                                                        Exclusivity: <strong>{opp.exclusivity}</strong>
                                                        <span style={{ color:'#f59e0b' }}> — do not accept competing deals</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                {contractSignature && (
                                                  <div style={{ background:'rgba(0,102,204,0.04)', border:`1px solid rgba(0,102,204,0.15)`, borderRadius:'8px', padding:'8px 10px', marginBottom:'10px', fontSize:'10px', color:C.textMuted, textAlign:'left' }}>
                                                    Contract signed by <strong style={{ color:C.text, fontStyle:'italic' }}>{contractSignature}</strong> on {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                                                  </div>
                                                )}
                                                <div style={{ display:'flex', gap:'8px' }}>
                                                  <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); setCreatorDealLifecycle('checklist'); setDealUploadSimulated(false); setDeliverableStatuses({}); setDeliverableLinks({}); setDeliverableLinkInputs({}); setPaymentMilestones({ advance:'pending', upload:'pending', approval:'pending' }); setDealRating(0); setDealRatingComment(''); setRatingSubmitted(false); setContractChecks({}); setContractSignature(''); setEscrowFunded(false); setEscrowFundingInProgress(false); }} style={{ flex:2, background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'13px' }}>
                                                    Withdraw to Bank
                                                  </button>
                                                  <button onClick={() => setShowDisputeModal(Date.now())} style={{ flex:1, background:'none', border:`1px solid rgba(239,68,68,0.3)`, padding:'10px', borderRadius:'8px', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>
                                                    Dispute
                                                  </button>
                                                </div>
                                              </div>
                                            </>
                                          );
                                        }
                                        return null;
                                      }

                                      // BARTER: Goods tracking workflow (6 states)
                                      case 'barter': {
                                        const status = goodsTrackerStatus;
                                        const trackingInput = goodsTrackingInput;
                                        return (
                                          <>
                                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>Goods Tracking</div>
                                            {status === 'goods_preparing' && (
                                              <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Brand is Preparing Your Product</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary }}>Your product is being selected and packaged. You will receive tracking information once it ships.</div>
                                              </div>
                                            )}
                                            {status === 'goods_shipped' && (
                                              <div style={{ background:'rgba(34,197,94,0.06)', border:`1px solid rgba(34,197,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Your Product is On The Way</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>
                                                  Tracking: <strong>{trackingInput || 'Tracking info shown by brand'}</strong>
                                                </div>
                                                <button onClick={() => {
                                                  setGoodsTrackerStatus('goods_delivered');
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, { goodsTrackerStatus: 'goods_delivered' });
                                                  }
                                                  setPurchaseToast('Marked as received');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'11px' }}>
                                                  Mark as Received
                                                </button>
                                              </div>
                                            )}
                                            {status === 'goods_delivered' && (
                                              <div style={{ background:'rgba(34,197,94,0.06)', border:`1px solid rgba(34,197,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Product Received</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Great! Now create content featuring this product. You have until the deadline to submit.</div>
                                                <button onClick={() => {
                                                  setGoodsTrackerStatus('content_due');
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, { goodsTrackerStatus: 'content_due' });
                                                  }
                                                  setPurchaseToast('Ready to create content');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'11px' }}>
                                                  Start Creating
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_due' && (
                                              <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Create Content</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Submit a link to your published content featuring the product</div>
                                                <input
                                                  type="text"
                                                  value={deliverableLinkInputs[0] || ''}
                                                  onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, 0: e.target.value }))}
                                                  placeholder="https://www.portfolio.valueskins.com/p/..."
                                                  style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'11px', fontFamily:'inherit', outline:'none', marginBottom:'8px', boxSizing:'border-box' }}
                                                />
                                                <button
                                                  disabled={!/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '')}
                                                  onClick={() => {
                                                    setDeliverableLinks(prev => ({ ...prev, 0: deliverableLinkInputs[0] }));
                                                    setGoodsTrackerStatus('content_submitted');
                                                    setDeliverableLinkInputs(prev => ({ ...prev, 0: '' }));
                                                    if (activeDealKey) {
                                                      updateDeal(activeDealKey, { goodsTrackerStatus: 'content_submitted' });
                                                    }
                                                    setPurchaseToast('Content submitted for review');
                                                    setTimeout(() => setPurchaseToast(null), 3000);
                                                  }}
                                                  style={{ width:'100%', background: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.primary : C.border, border:'none', borderRadius:'6px', padding:'8px', color:'#fff', fontWeight:600, cursor: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 'pointer' : 'not-allowed', opacity: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 1 : 0.5, fontSize:'11px' }}
                                                >
                                                  Submit Content
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_submitted' && (
                                              <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Content Submitted</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary }}>Your content is awaiting brand approval. This typically takes 24-48 hours.</div>
                                              </div>
                                            )}
                                            {status === 'content_approved' && (
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Approved and Deal Completed</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>Brand approved your content. Barter deal finished.</div>
                                                <div style={{ display:'flex', gap:'8px' }}>
                                                  <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); }} style={{ flex:1, background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'12px' }}>
                                                    Close
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      }

                                      // C2C_COLLAB: Content tracking (3 states)
                                      case 'c2c_collab': {
                                        const status = c2cContentStatus;
                                        return (
                                          <>
                                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>Content Collaboration</div>
                                            {status === 'content_creating' && (
                                              <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>In Progress</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Submit your content link when ready</div>
                                                <input
                                                  type="text"
                                                  value={deliverableLinkInputs[0] || ''}
                                                  onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, 0: e.target.value }))}
                                                  placeholder="https://www.portfolio.valueskins.com/p/..."
                                                  style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'11px', fontFamily:'inherit', outline:'none', marginBottom:'8px', boxSizing:'border-box' }}
                                                />
                                                <button
                                                  disabled={!/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '')}
                                                  onClick={() => {
                                                    setDeliverableLinks(prev => ({ ...prev, 0: deliverableLinkInputs[0] }));
                                                    setC2cContentStatus('content_submitted');
                                                    setDeliverableLinkInputs(prev => ({ ...prev, 0: '' }));
                                                    if (activeDealKey) {
                                                      updateDeal(activeDealKey, { c2cContentStatus: 'content_submitted' });
                                                    }
                                                    setPurchaseToast('Content submitted');
                                                    setTimeout(() => setPurchaseToast(null), 3000);
                                                  }}
                                                  style={{ width:'100%', background: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.primary : C.border, border:'none', borderRadius:'6px', padding:'8px', color:'#fff', fontWeight:600, cursor: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 'pointer' : 'not-allowed', opacity: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 1 : 0.5, fontSize:'11px' }}
                                                >
                                                  Submit
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_submitted' && (
                                              <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Submitted</div>
                                                <div style={{ fontSize:'11px', color:C.textSecondary }}>Waiting for collaborator approval</div>
                                              </div>
                                            )}
                                            {status === 'content_approved' && (
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Collaboration Complete</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>Collaborator approved. Deal finished.</div>
                                                <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); }} style={{ width:'100%', background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'12px' }}>
                                                  Close
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        );
                                      }

                                      default:
                                        return null;
                                    }
                                  })()}

                                  {/* POC Contact Card — visible at all deal phases when POC exists */}
                                  {activeDeal?.poc && ['chatroom','checklist','accepted','softhold'].includes(dealRoomPhase) && (
                                    <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                          <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{activeDeal.poc.name}</div>
                                          <div style={{ fontSize: '11px', color: C.primary, marginTop: '1px' }}>{activeDeal.poc.contactHandle}</div>
                                          {activeDeal.poc.role && <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '1px' }}>{activeDeal.poc.role}</div>}
                                        </div>
                                        <button
                                          onClick={() => {
                                            const pocHandle = activeDeal.poc?.contactHandle?.replace('@', '') || '';
                                            if (pocHandle) {
                                              window.open(`https://portfolio.valueskins.com/${pocHandle}`, '_blank');
                                            }
                                            setPurchaseToast(`Opening ${activeDeal.poc?.name || 'POC'}'s profile`);
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ background: C.primary, border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                                        >
                                          Message
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {!['offer','counter','brand_considering','brand_countered','brand_rejected','accepted','chatroom','checklist','softhold'].includes(dealRoomPhase) && (
                                    <button onClick={() => setNegotiatingOpp(null)} style={{ width: '100%', background: 'none', border: `1px solid ${C.border}`, padding: '8px', borderRadius: '8px', color: C.textSecondary, cursor: 'pointer', fontSize: '12px' }}>Close</button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                    </>)}

                    {/* Creator Collab Mode */}
                    {creatorMarketplaceMode === 'collab' && (
                      <>
                        {/* Browse / Sent tabs */}
                        <div style={{ display: 'flex', background: C.card, borderRadius: '10px', padding: '3px', marginBottom: '14px' }}>
                          {(['browse', 'sent'] as const).map(tab => (
                            <button
                              key={tab}
                              onClick={() => setCollabView(tab)}
                              style={{ flex: 1, padding: '9px 0', borderRadius: '8px', border: 'none', background: collabView === tab ? C.surfaceAlt : 'transparent', color: collabView === tab ? C.text : C.textSecondary, fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                            >
                              {tab === 'browse' ? 'Browse' : 'Sent'}
                              {tab === 'sent' && collabSentNames.length > 0 && (
                                <span style={{ position: 'absolute', top: '6px', right: '12px', width: '16px', height: '16px', borderRadius: '50%', background: C.primary, color: '#fff', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{collabSentNames.length}</span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Sent requests view */}
                        {collabView === 'sent' && (
                          <div>
                            {collabSentNames.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted, fontSize: '13px' }}>No collab requests sent yet.</div>
                            ) : (
                              collabSentNames.map((name, i) => {
                                const creator = BRAND_MARKETPLACE_CREATORS.find(c => c.name === name);
                                const badge = creator ? PROFESSION_BADGES[creator.valueSkin] : null;
                                const badgeColor = badge?.color ?? C.accent;
                                const abbr = badge?.abbreviation ?? (creator?.valueSkin ?? '').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
                                return (
                                  <div key={i} style={{ background: C.card, borderRadius: '12px', padding: '14px', marginBottom: '10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s/g,'')}`} alt={name} style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surfaceAlt, border: `2px solid ${badgeColor}`, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{name}</span>
                                        {creator && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', background: badgeColor, color: '#fff', fontSize: '7px', fontWeight: 700 }}>{abbr}</span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '11px', color: C.textSecondary }}>{creator?.handle ?? ''}</div>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: C.textSecondary, background: C.surfaceAlt, padding: '4px 10px', borderRadius: '6px', flexShrink: 0 }}>Pending</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {collabView === 'browse' && <>
                        {campaigns.length === 0 ? (
                          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'22px 18px', textAlign:'center' }}>
                            <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Create a campaign first</div>
                            <div style={{ fontSize:'12px', color:C.textSecondary, lineHeight:1.5, marginBottom:'14px' }}>
                              Creator browsing unlocks after you publish your first campaign brief.
                            </div>
                            <button onClick={() => setMarketplaceTab('campaigns')} style={{ background:C.primary, border:'none', borderRadius:'8px', padding:'10px 14px', color:'#fff', fontWeight:700, fontSize:'12px', cursor:'pointer' }}>
                              Create Campaign
                            </button>
                          </div>
                        ) : (
                        <>
                        {/* Compensation type filter chips */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                          {(['all', 'paid', 'unpaid', 'barter'] as const).map(f => {
                            const labels: Record<string, string> = { all: 'All', paid: 'Paid', unpaid: 'Unpaid', barter: 'Barter' };
                            const active = collabCompFilter === f;
                            return (
                              <button
                                key={f}
                                onClick={() => { setCollabCompFilter(f); setCollabRequestOpen(null); }}
                                style={{ padding: '7px 16px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap', background: active ? C.text : C.card, color: active ? C.bg : C.textSecondary, fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}
                              >
                                {labels[f]}
                              </button>
                            );
                          })}
                        </div>

                        {BRAND_MARKETPLACE_CREATORS.filter(c => {
                          if (collabCompFilter === 'all') return true;
                          if (collabCompFilter === 'barter') return c.willingToBarter || c.dealTypes.includes('Barter');
                          if (collabCompFilter === 'paid') return c.dealTypes.includes('Paid');
                          if (collabCompFilter === 'unpaid') return !c.dealTypes.includes('Paid') && !c.willingToBarter;
                          return true;
                        }).map((creator, i) => {
                          const sent = collabSentNames.includes(creator.name);
                          const open = collabRequestOpen === i;
                          const badge = PROFESSION_BADGES[creator.valueSkin];
                          const abbr = badge?.abbreviation ?? creator.valueSkin.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
                          const badgeColor = badge?.color ?? C.primary;
                          return (
                            <div key={i} style={{ background: C.card, borderRadius: '12px', padding: '14px', marginBottom: '10px', border: `1px solid ${open ? 'rgba(94,106,210,0.4)' : C.border}` }}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.name.replace(/\s/g,'')}`} alt={creator.name} style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surfaceAlt, border: `2px solid ${badgeColor}` }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{creator.name}</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', background: badgeColor, color: '#fff', fontSize: '7px', fontWeight: 700 }}>{abbr}</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: C.textSecondary }}>{creator.handle} · {creator.followers} followers</div>
                                </div>
                                {sent ? (
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: C.textSecondary, background: C.surfaceAlt, padding: '4px 10px', borderRadius: '6px' }}>Sent</span>
                                ) : (
                                  <button
                                    onClick={() => setCollabRequestOpen(open ? null : i)}
                                    style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: C.accent, border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
                                  >
                                    {open ? 'Cancel' : 'Collab'}
                                  </button>
                                )}
                              </div>
                              {open && (
                                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
                                  <div style={{ marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, marginBottom: '4px' }}>Collab idea *</div>
                                    <textarea
                                      placeholder="What do you want to create together?"
                                      value={collabIdea}
                                      onChange={e => setCollabIdea(e.target.value)}
                                      rows={2}
                                      style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <div style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, marginBottom: '4px' }}>Content format</div>
                                    <input
                                      type="text"
                                      placeholder="e.g. Co-hosted Reel, Joint Story series"
                                      value={collabFormat}
                                      onChange={e => setCollabFormat(e.target.value)}
                                      style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <button onClick={() => setCollabPaid(false)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${!collabPaid ? C.primary : C.border}`, background: !collabPaid ? `${C.primary}12` : C.bg, color: !collabPaid ? C.primary : C.textSecondary, fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Unpaid / Organic</button>
                                    <button onClick={() => setCollabPaid(true)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${collabPaid ? C.primary : C.border}`, background: collabPaid ? `${C.primary}12` : C.bg, color: collabPaid ? C.primary : C.textSecondary, fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Paid</button>
                                    <button onClick={() => setCollabNegotiable(p => !p)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${collabNegotiable ? C.accent : C.border}`, background: collabNegotiable ? 'rgba(94,106,210,0.1)' : C.bg, color: collabNegotiable ? C.accent : C.textSecondary, fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Negotiable</button>
                                  </div>
                                  {collabPaid && (
                                    <div style={{ marginBottom: '12px' }}>
                                      <div style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, marginBottom: '4px' }}>Budget</div>
                                      <input
                                        type="text"
                                        placeholder="e.g. $1500"
                                        value={collabBudget}
                                        onChange={e => setCollabBudget(e.target.value)}
                                        style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                      />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (collabIdea.trim() && (!collabPaid || collabBudget.trim())) {
                                        const c2cKey = `${profileName}:${creator.name}`;
                                        const c2cDeal: Partial<DealState> = {
                                          phase: 'chatroom',
                                          intent: 'explore',
                                          briefFilled: true,
                                          briefTitle: collabIdea.trim(),
                                          offerAmount: collabBudget || '0',
                                          counterAmount: '',
                                          brandResponseAmount: '',
                                          chatMessages: [],
                                          chatInput: '',
                                          performanceClause: false,
                                          advancePercent: 50,
                                          dealType: collabPaid ? 'c2c_paid' : 'c2c_collab',
                                          c2cContentStatus: collabPaid ? undefined : 'content_creating',
                                        };
                                        setDealStates(prev => ({ ...prev, [c2cKey]: { ...getOrCreateDeal(c2cKey), ...c2cDeal } }));
                                        setCollabSentNames(p => [...p, creator.name]);
                                        setCollabRequestOpen(null);
                                        const msg = `C2C Collab: ${collabIdea.trim()} (${collabFormat || 'format TBD'}, ${collabPaid ? `$${collabBudget}` : 'Unpaid'})`;
                                        setCollabIdea(''); setCollabFormat(''); setCollabBudget('');
                                        firebaseSendNotification(creator.handle || '', 'message', msg);
                                        setPurchaseToast('Collab request sent');
                                        setTimeout(() => setPurchaseToast(null), 3000);
                                      }
                                    }}
                                    style={{ width: '100%', background: collabIdea.trim() && (!collabPaid || collabBudget.trim()) ? C.accent : C.border, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: collabIdea.trim() && (!collabPaid || collabBudget.trim()) ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                                  >
                                    Send Collab Request
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </>
                        )}
                        </>}
                      {/* Past Deals section */}
                      <div style={{ marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
                          <span style={{ fontSize:'12px', fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.5px' }}>Past Deals</span>
                          <span style={{ fontSize:'10px', background:C.primary, color:'#fff', padding:'2px 6px', borderRadius:'8px' }}>
                            {Object.values(dealStates).filter(d => d.brandApprovalPhase === 'approved' || d.creatorDealLifecycle === 'approved').length}
                          </span>
                        </div>
                        {(() => {
                          const completedDeals = Object.entries(dealStates).filter(([_, d]) => d.brandApprovalPhase === 'approved' || d.creatorDealLifecycle === 'approved').map(([key, deal]) => ({key, ...deal}));
                          if (completedDeals.length === 0) {
                            return <div style={{ fontSize:'12px', color:C.textSecondary, padding:'16px', textAlign:'center' }}>No completed deals yet</div>;
                          }
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                              {completedDeals.map((deal) => {
                                const [creatorName, skinName] = deal.key.split('|');
                                const dealAmount = deal.agreementAmount || deal.offerAmount || '0';
                                const creatorRating = deal.creatorRating || 0;
                                const brandRating = deal.brandRating || 0;
                                const completedDate = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                                return (
                                  <div key={deal.key} style={{ background:C.card, borderRadius:'8px', padding:'12px', border:`1px solid ${C.border}` }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'8px' }}>
                                      <div>
                                        <div style={{ fontSize:'13px', fontWeight:600, color:C.text, marginBottom:'2px' }}>Brand Deal · {deal.type || 'Unknown'}</div>
                                        <div style={{ fontSize:'11px', color:C.textSecondary }}>{completedDate}</div>
                                      </div>
                                      <div style={{ fontSize:'13px', fontWeight:700, color:C.success }}>${parseInt(dealAmount).toLocaleString()}</div>
                                    </div>
                                    {(creatorRating > 0 || brandRating > 0) && (
                                      <div style={{ display:'flex', gap:'16px', fontSize:'11px', color:C.textSecondary, paddingTop:'8px', borderTop:`1px solid ${C.border}` }}>
                                        {creatorRating > 0 && <span>You rated: {'★'.repeat(creatorRating)}</span>}
                                        {brandRating > 0 && <span>Brand rated: {'★'.repeat(brandRating)}</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      </>
                    )}

                  </div>
                </>
              )}

              {/* Layer 3b: Brand Marketplace */}
              {hasAnySkin && marketplaceRole === 'brand' && (
                <>
                  <div style={{ padding: '12px 16px 0', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Brand Dashboard</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => setShowCampaignCreator(true)}
                          style={{
                            background: C.primary, color: '#fff', border: 'none', borderRadius: '8px',
                            padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Create Campaign
                        </button>
                        <button onClick={() => { setMarketplaceRole('none'); setNegotiatingCreator(null); }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: C.textSecondary, cursor: 'pointer', fontWeight: 600 }}>Switch</button>
                      </div>
                    </div>
                    {/* Only show discovery search if a campaign exists */}
                    {campaigns.length > 0 && (
                      <div style={{ position: 'relative', marginBottom: '14px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" placeholder="Search creators..." style={{ width: '100%', background: C.card, border: 'none', borderRadius: '12px', padding: '12px 12px 12px 40px', color: C.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '0 16px 16px' }}>
                    {/* New Campaign Creator Modal */}
                    {showCampaignCreator && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'480px', width:'95vw', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
                          <button onClick={() => setShowCampaignCreator(false)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:C.textMuted, fontSize:'22px', cursor:'pointer', lineHeight:1 }}>x</button>
                          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'16px' }}>Create Campaign</div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Brand name *</div>
                            <input type="text" value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Your brand name" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Campaign title *</div>
                            <input type="text" value={newCampaignTitle} onChange={e=>setNewCampaignTitle(e.target.value)} placeholder="e.g. Spring Product Launch" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>About your product / campaign *</div>
                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'6px' }}>Creators need to understand what they are promoting. Be specific — what is the product, who is it for, and what makes it worth their audience's trust.</div>
                            <textarea value={newCampaignAbout} onChange={e=>setNewCampaignAbout(e.target.value)} rows={4} placeholder="e.g. We build CI/CD tooling for startups. 50K+ teams use our pipeline automation. Looking for authentic dev voices to demo our v3 launch features." style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Campaign description *</div>
                            <textarea value={newCampaignDesc} onChange={e=>setNewCampaignDesc(e.target.value)} rows={2} placeholder="Briefly describe the type of content and goal of this campaign" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom:'12px', background:`${C.primary}08`, border:`1px solid ${C.primary}30`, borderRadius:'8px', padding:'10px 12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Targeting creators with</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.primary }}>{activeBrandSkin}</div>
                            <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'3px' }}>Auto-matched from your selected ValueSkin. Only creators with this skin will see your campaign.</div>
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Creator level range *</div>
                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'6px' }}>Select min and max level. Only creators within this range can apply.</div>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                              <span style={{ fontSize:'10px', color:C.textMuted, fontWeight:600, width:24 }}>Min</span>
                              {[1,2,3,4,5].map(l => (
                                <button key={l} onClick={()=>{ setNewCampaignMinLevel(l); if (l > newCampaignMaxLevel) setNewCampaignMaxLevel(l); }} style={{ flex:1, padding:'7px 0', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer', background:newCampaignMinLevel===l?C.primary:C.bg, color:newCampaignMinLevel===l?'#fff':C.textSecondary, border:`1px solid ${newCampaignMinLevel===l?C.primary:C.border}` }}>L{l}</button>
                              ))}
                            </div>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'6px' }}>
                              <span style={{ fontSize:'10px', color:C.textMuted, fontWeight:600, width:24 }}>Max</span>
                              {[1,2,3,4,5].map(l => (
                                <button key={l} onClick={()=>{ setNewCampaignMaxLevel(l); if (l < newCampaignMinLevel) setNewCampaignMinLevel(l); }} disabled={l < newCampaignMinLevel} style={{ flex:1, padding:'7px 0', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor: l < newCampaignMinLevel ? 'not-allowed' : 'pointer', background:newCampaignMaxLevel===l?'#22c55e':C.bg, color:newCampaignMaxLevel===l?'#fff': l < newCampaignMinLevel ? C.border : C.textSecondary, border:`1px solid ${newCampaignMaxLevel===l?'#22c55e':C.border}`, opacity: l < newCampaignMinLevel ? 0.4 : 1 }}>L{l}</button>
                              ))}
                            </div>
                            <div style={{ fontSize:'10px', color:C.primary, marginTop:'4px', fontWeight:600 }}>Accepting Level {newCampaignMinLevel}{newCampaignMaxLevel !== newCampaignMinLevel ? ` to ${newCampaignMaxLevel}` : ' only'}</div>
                          </div>
                          <div style={{ display:'flex', gap:'10px', marginBottom:'12px' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Budget per creator ($) *</div>
                              <input type="text" value={newCampaignBudget} onChange={e=>setNewCampaignBudget(e.target.value.replace(/[^0-9]/g,''))} placeholder="5000" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Creators to hire *</div>
                              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                <button onClick={()=>setNewCampaignCreatorCount(c=>Math.max(1,c-1))} style={{ width:32, height:32, borderRadius:'6px', background:C.bg, border:`1px solid ${C.border}`, color:C.text, fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                                <div style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontWeight:700, textAlign:'center' }}>{newCampaignCreatorCount}</div>
                                <button onClick={()=>setNewCampaignCreatorCount(c=>Math.min(50,c+1))} style={{ width:32, height:32, borderRadius:'6px', background:C.bg, border:`1px solid ${C.border}`, color:C.text, fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
                              </div>
                            </div>
                          </div>
                          {newCampaignBudget && (
                            <div style={{ background:'rgba(0,212,106,0.06)', border:'1px solid rgba(0,212,106,0.2)', borderRadius:'8px', padding:'10px 12px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <div style={{ fontSize:'10px', color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Total escrow required</div>
                                <div style={{ fontSize:'11px', color:C.textSecondary, marginTop:'2px' }}>${parseInt(newCampaignBudget||'0').toLocaleString()} × {newCampaignCreatorCount} creator{newCampaignCreatorCount!==1?'s':''}</div>
                              </div>
                              <div style={{ fontSize:'20px', fontWeight:800, color:C.success }}>${(parseInt(newCampaignBudget||'0')*newCampaignCreatorCount).toLocaleString()}</div>
                            </div>
                          )}
                          <div style={{ display:'flex', gap:'10px', marginBottom:'12px' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Location</div>
                              <input type="text" value={newCampaignLocation} onChange={e=>setNewCampaignLocation(e.target.value)} placeholder="USA / Remote / Global" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                            </div>
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Deliverables</div>
                            <input type="text" value={newCampaignDeliverables} onChange={e=>setNewCampaignDeliverables(e.target.value)} placeholder="e.g. 2x Reels, 3x Stories" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'6px' }}>Non-negotiables</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                              {['NDA required','Usage rights: 90 days','Usage rights: 30 days','Exclusivity: 30 days','Exclusivity: 60 days','On-camera required','English only'].map(n => (
                                <button key={n} onClick={()=>setNewCampaignNonNeg(prev=>prev.includes(n)?prev.filter(x=>x!==n):[...prev,n])} style={{ padding:'4px 9px', borderRadius:'6px', fontSize:'10px', fontWeight:600, cursor:'pointer', background:newCampaignNonNeg.includes(n)?'rgba(239,68,68,0.12)':C.bg, color:newCampaignNonNeg.includes(n)?C.textMuted:C.textSecondary, border:`1px solid ${newCampaignNonNeg.includes(n)?'rgba(239,68,68,0.4)':C.border}` }}>{n}</button>
                              ))}
                            </div>
                          </div>
                          {/* Compensation type */}
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'6px' }}>Compensation type *</div>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              {['Paid','Paid + Barter','Barter only','Performance-based'].map(t => (
                                <button key={t} onClick={()=>setNewCampaignCompensation(t)} style={{ padding:'5px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer', background:newCampaignCompensation===t?`${C.primary}15`:C.bg, color:newCampaignCompensation===t?C.primary:C.textSecondary, border:`1px solid ${newCampaignCompensation===t?C.primary:C.border}` }}>{t}</button>
                              ))}
                            </div>
                          </div>

                          {/* Script mode selection */}
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'6px' }}>Script negotiation mode *</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                              <button onClick={()=>setNewCampaignScriptMode('non_negotiable')} style={{ padding:'10px 12px', borderRadius:'8px', textAlign:'left', background:newCampaignScriptMode==='non_negotiable'?`${C.primary}15`:C.bg, border:`1px solid ${newCampaignScriptMode==='non_negotiable'?C.primary:C.border}`, cursor:'pointer' }}>
                                <div style={{ fontSize:'12px', fontWeight:700, color:newCampaignScriptMode==='non_negotiable'?C.primary:C.text, marginBottom:'2px' }}>Non-negotiable (Locked)</div>
                                <div style={{ fontSize:'10px', color:C.textMuted }}>You provide the exact script creators must use</div>
                              </button>
                              <button onClick={()=>setNewCampaignScriptMode('discussion')} style={{ padding:'10px 12px', borderRadius:'8px', textAlign:'left', background:newCampaignScriptMode==='discussion'?`${C.primary}15`:C.bg, border:`1px solid ${newCampaignScriptMode==='discussion'?C.primary:C.border}`, cursor:'pointer' }}>
                                <div style={{ fontSize:'12px', fontWeight:700, color:newCampaignScriptMode==='discussion'?C.primary:C.text, marginBottom:'2px' }}>Collaborative (Both Edit)</div>
                                <div style={{ fontSize:'10px', color:C.textMuted }}>Both parties negotiate and edit the script together</div>
                              </button>
                              <button onClick={()=>setNewCampaignScriptMode('creator_freedom')} style={{ padding:'10px 12px', borderRadius:'8px', textAlign:'left', background:newCampaignScriptMode==='creator_freedom'?`${C.primary}15`:C.bg, border:`1px solid ${newCampaignScriptMode==='creator_freedom'?C.primary:C.border}`, cursor:'pointer' }}>
                                <div style={{ fontSize:'12px', fontWeight:700, color:newCampaignScriptMode==='creator_freedom'?C.primary:C.text, marginBottom:'2px' }}>Creator Freedom</div>
                                <div style={{ fontSize:'10px', color:C.textMuted }}>Creator has complete freedom; you only review and approve</div>
                              </button>
                            </div>
                          </div>

                          {/* Non-negotiable script text input */}
                          {newCampaignScriptMode === 'non_negotiable' && (
                            <div style={{ marginBottom:'12px' }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Script to provide (locked) *</div>
                              <textarea value={newCampaignScriptText} onChange={e=>setNewCampaignScriptText(e.target.value)} rows={3} placeholder="Paste the exact script creators must follow..." style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }} />
                            </div>
                          )}

                          {/* Collaborative script text input (optional starter) */}
                          {newCampaignScriptMode === 'discussion' && (
                            <div style={{ marginBottom:'12px' }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Starting script (optional)</div>
                              <textarea value={newCampaignScriptText} onChange={e=>setNewCampaignScriptText(e.target.value)} rows={3} placeholder="Provide a starting point — creators can edit and suggest changes..." style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }} />
                            </div>
                          )}

                          {/* Exclusivity & Usage Rights */}
                          <div style={{ display:'flex', gap:'10px', marginBottom:'12px' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Exclusivity</div>
                              <select value={newCampaignExclusivity} onChange={e=>setNewCampaignExclusivity(e.target.value)} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }}>
                                <option value="None">None</option>
                                <option value="14 days">14 days</option>
                                <option value="30 days">30 days</option>
                                <option value="60 days">60 days</option>
                                <option value="90 days">90 days</option>
                              </select>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Usage rights</div>
                              <select value={newCampaignUsageRights} onChange={e=>setNewCampaignUsageRights(e.target.value)} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }}>
                                <option value="30 days, social only">30 days, social only</option>
                                <option value="60 days, social only">60 days, social only</option>
                                <option value="90 days, all platforms">90 days, all platforms</option>
                                <option value="120 days, all platforms">120 days, all platforms</option>
                                <option value="180 days, all platforms">180 days, all platforms</option>
                                <option value="Perpetual">Perpetual</option>
                              </select>
                            </div>
                          </div>
                          {/* Target audience */}
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Target audience *</div>
                            <input type="text" value={newCampaignAudienceTarget} onChange={e=>setNewCampaignAudienceTarget(e.target.value)} placeholder="e.g. Developers, 25-40" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                          {/* Requirements — what creators must meet */}
                          <div style={{ marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Creator requirements</div>
                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'6px' }}>Creators must match these to see the campaign. Include audience age, language, or specific requirements.</div>
                            <div style={{ fontSize:'9px', color:C.textMuted, marginBottom:'6px', fontStyle:'italic' }}>Examples: "Audience age 25-34", "English speaking", "Must have 100K+ followers"</div>
                            <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
                              <input type="text" value={newCampaignReqInput} onChange={e=>setNewCampaignReqInput(e.target.value)} placeholder="e.g. Audience age 25-34, English speaking, GitHub profile" onKeyDown={e => { if (e.key === 'Enter' && newCampaignReqInput.trim()) { e.preventDefault(); setNewCampaignRequirements(prev=>[...prev,newCampaignReqInput.trim()]); setNewCampaignReqInput(''); }}} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'7px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                              <button onClick={()=>{ if (newCampaignReqInput.trim()) { setNewCampaignRequirements(prev=>[...prev,newCampaignReqInput.trim()]); setNewCampaignReqInput(''); }}} style={{ background:C.primary, border:'none', borderRadius:'8px', padding:'7px 12px', color:'#fff', fontSize:'11px', fontWeight:600, cursor:'pointer' }}>Add</button>
                            </div>
                            {newCampaignRequirements.length > 0 && (
                              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                {newCampaignRequirements.map((req, idx) => (
                                  <div key={idx} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:C.text, padding:'4px 8px', background:C.bg, borderRadius:'6px', border:`1px solid ${C.border}` }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span style={{ flex:1 }}>{req}</span>
                                    <button onClick={()=>setNewCampaignRequirements(prev=>prev.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:'14px', lineHeight:1 }}>x</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'4px' }}>Application deadline</div>
                            <input type="date" value={newCampaignDeadline} onChange={e=>setNewCampaignDeadline(e.target.value)} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>

                          {/* Point of Contact */}
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', color:C.textMuted, fontWeight:600, marginBottom:'2px' }}>Point of Contact</div>
                            <div style={{ fontSize:'10px', color:C.textMuted, marginBottom:'8px' }}>The person creators should reference for this campaign. Shown to both parties in the deal room.</div>
                            <input type="text" value={newCampaignPocName} onChange={e=>setNewCampaignPocName(e.target.value)} placeholder="Full name" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const, marginBottom:'8px' }} />
                            <div style={{ position:'relative', marginBottom:'8px' }}>
                              <span style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:C.textMuted, fontSize:'13px' }}>@</span>
                              <input type="text" value={newCampaignPocHandle} onChange={e=>setNewCampaignPocHandle(e.target.value)} placeholder="instagramhandle" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px 8px 24px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                            </div>
                            <input type="text" value={newCampaignPocRole} onChange={e=>setNewCampaignPocRole(e.target.value)} placeholder="Role / title (e.g. Partnerships Manager)" style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, padding:'8px 10px', fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }} />
                          </div>

                          <button
                            onClick={() => {
                              const missing: string[] = [];
                              if (!newCampaignTitle.trim()) missing.push('Title');
                              if (!newCampaignAbout.trim()) missing.push('About product/campaign');
                              if (!newCampaignDesc.trim()) missing.push('Description');
                              if (!newCampaignBudget) missing.push('Budget');
                              if (!newCampaignAudienceTarget.trim()) missing.push('Target audience');
                              if (missing.length > 0) { setPurchaseToast(`Missing: ${missing.join(', ')}`); setTimeout(()=>setPurchaseToast(null),4000); return; }
                              const escrowPool = parseInt(newCampaignBudget||'0') * newCampaignCreatorCount;
                              const newC: Campaign = {
                                id:Date.now(), brandName:profileName, brandProfession:activeBrandSkin??'', title:newCampaignTitle, description:newCampaignDesc, about:newCampaignAbout, requiredProfessions:[activeBrandSkin ?? ''], minLevel:newCampaignMinLevel, maxLevel:newCampaignMaxLevel, budget:newCampaignBudget, deadline:newCampaignDeadline, location:newCampaignLocation, nonNegotiables:newCampaignNonNeg, deliverables:newCampaignDeliverables, compensationType:newCampaignCompensation, exclusivity:newCampaignExclusivity, usageRights:newCampaignUsageRights, audienceTarget:newCampaignAudienceTarget, requirements:newCampaignRequirements, scriptMode:newCampaignScriptMode, scriptText:newCampaignScriptText, status:'open', applicants:0, creatorCount:newCampaignCreatorCount, escrowFunded:false, escrowPool, escrowAllocated:0,
                                poc: newCampaignPocName.trim() ? {
                                  name: newCampaignPocName.trim(),
                                  contactHandle: newCampaignPocHandle.trim().startsWith('@') ? newCampaignPocHandle.trim() : `@${newCampaignPocHandle.trim()}`,
                                  role: newCampaignPocRole.trim(),
                                } : undefined,
                              };
                              persistCampaigns([...campaigns, newC]);
                              firebaseCreateCampaign(newC);
                              setShowCampaignCreator(false);
                              setLastCreatedCampaignId(newC.id);
                              setPendingCampaignForEscrow(newC);
                              setShowEscrowFundingModal(true);
                              setEscrowFundingInProgress2(false);
                              setBatchSendCreatorIds(new Set());
                              setNewCampaignTitle(''); setNewCampaignDesc(''); setNewCampaignAbout(''); setNewCampaignBudget(''); setNewCampaignDeadline(''); setNewCampaignProfessions([]); setNewCampaignMinLevel(1); setNewCampaignMaxLevel(5); setNewCampaignLocation(''); setNewCampaignDeliverables(''); setNewCampaignNonNeg([]); setNewCampaignCompensation('Paid'); setNewCampaignExclusivity('None'); setNewCampaignUsageRights('30 days, social only'); setNewCampaignAudienceTarget(''); setNewCampaignRequirements([]); setNewCampaignReqInput(''); setNewCampaignCreatorCount(1); setNewCampaignPocName(''); setNewCampaignPocHandle(''); setNewCampaignPocRole(''); setNewCampaignScriptMode('creator_freedom'); setNewCampaignScriptText('');
                            }}
                            style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'11px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer' }}
                          >
                            Publish Campaign
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Escrow Funding Modal — shown after campaign publish, before batch send */}
                    {showEscrowFundingModal && pendingCampaignForEscrow && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'28px', maxWidth:'440px', width:'95vw', border:`1px solid ${C.border}` }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                            <div style={{ width:36, height:36, borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            </div>
                            <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>Fund Escrow</div>
                          </div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'20px', lineHeight:1.5 }}>
                            Deposit funds upfront to cover all creators in this campaign. Funds are held securely and released per each creator's agreed payment milestones. Unused funds are returned if fewer creators are hired.
                          </div>

                          {/* Campaign summary */}
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'14px' }}>
                            <div style={{ fontSize:'12px', fontWeight:700, color:C.text, marginBottom:'10px' }}>{pendingCampaignForEscrow.title}</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                              {[
                                { label:'Per creator', value:`$${parseInt(pendingCampaignForEscrow.budget||'0').toLocaleString()}` },
                                { label:'Creators hiring', value:`${pendingCampaignForEscrow.creatorCount || 1}` },
                              ].map(row => (
                                <div key={row.label} style={{ background:C.surfaceAlt, borderRadius:'6px', padding:'8px 10px' }}>
                                  <div style={{ fontSize:'10px', color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'3px' }}>{row.label}</div>
                                  <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{row.value}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop:'10px', padding:'10px', background:'rgba(0,212,106,0.06)', border:'1px solid rgba(0,212,106,0.2)', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:'12px', color:C.textSecondary, fontWeight:600 }}>Total escrow deposit</span>
                              <span style={{ fontSize:'20px', fontWeight:800, color:C.success }}>${(pendingCampaignForEscrow.escrowPool||0).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Payment milestone breakdown */}
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'12px', marginBottom:'16px' }}>
                            <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>How funds are released per creator</div>
                            {[
                              { label:'Advance (on deal acceptance)', pct:30 },
                              { label:'On content upload', pct:40 },
                              { label:'On brand approval', pct:30 },
                            ].map(m => (
                              <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:`1px solid ${C.border}` }}>
                                <span style={{ fontSize:'11px', color:C.textSecondary }}>{m.label}</span>
                                <span style={{ fontSize:'11px', fontWeight:700, color:C.text }}>{m.pct}%</span>
                              </div>
                            ))}
                          </div>

                          {/* Escrow progress bar */}
                          {escrowFundingInProgress2 && (
                            <div style={{ marginBottom:'14px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:C.textMuted, marginBottom:'6px' }}>
                                <span>Processing deposit...</span>
                                <span style={{ color:'#f59e0b', fontWeight:600 }}>Verifying</span>
                              </div>
                              <div style={{ width:'100%', height:'6px', background:C.card, borderRadius:'3px', overflow:'hidden' }}>
                                <div style={{ width:'70%', height:'100%', background:'#f59e0b', borderRadius:'3px', transition:'width 1.5s ease' }} />
                              </div>
                            </div>
                          )}

                          <button
                            disabled={escrowFundingInProgress2}
                            onClick={() => {
                              setEscrowFundingInProgress2(true);
                              setTimeout(() => {
                                persistCampaigns(campaigns.map(c => c.id === pendingCampaignForEscrow.id ? { ...c, escrowFunded: true } : c));

                                // AUTO-MATCH: Find matching creators
                                const matched = autoMatchCreators(pendingCampaignForEscrow, BRAND_MARKETPLACE_CREATORS);
                                setAutoMatchedCreators(matched);

                                // Send notifications
                                const notifs = sendAutoMatchNotifications(
                                  pendingCampaignForEscrow.id,
                                  pendingCampaignForEscrow.title,
                                  profileName,
                                  matched
                                );
                                setCreatorNotifications(prev => [...prev, ...notifs]);

                                setEscrowFundingInProgress2(false);
                                setShowEscrowFundingModal(false);
                                setShowBatchSendModal(true);
                                setPurchaseToast(`Escrow funded — $${(pendingCampaignForEscrow.escrowPool||0).toLocaleString()} secured. Found ${matched.length} matching creators.`);
                                setTimeout(() => setPurchaseToast(null), 4000);
                              }, 2000);
                            }}
                            style={{ width:'100%', background: escrowFundingInProgress2 ? C.border : C.primary, border:'none', borderRadius:'10px', padding:'13px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: escrowFundingInProgress2 ? 'not-allowed' : 'pointer', opacity: escrowFundingInProgress2 ? 0.6 : 1, marginBottom:'8px' }}
                          >
                            {escrowFundingInProgress2 ? 'Finding matching creators...' : `Deposit $${(pendingCampaignForEscrow.escrowPool||0).toLocaleString()} into Escrow`}
                          </button>
                          <div style={{ fontSize:'10px', color:C.textMuted, textAlign:'center', lineHeight:1.5 }}>
                            Funds are non-transferable until released per milestone. Unused funds return within 5 business days.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feature 4: Auto-Matched Creators Modal */}
                    {showBatchSendModal && lastCreatedCampaignId && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'520px', width:'95vw', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
                          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Auto-Matched Creators</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>System found {autoMatchedCreators.length} creators matching your campaign. Select who to invite.</div>

                          {autoMatchedCreators.length === 0 ? (
                            <div style={{ padding:'40px 20px', textAlign:'center', color:C.textSecondary }}>
                              <div style={{ fontSize:'14px', marginBottom:'8px' }}>No matching creators found</div>
                              <div style={{ fontSize:'12px' }}>Try adjusting your campaign requirements</div>
                            </div>
                          ) : (
                            <div style={{ maxHeight:'400px', overflowY:'auto', marginBottom:'16px', border:`1px solid ${C.border}`, borderRadius:'8px', background:C.bg }}>
                              {autoMatchedCreators.map((match, idx) => {
                                const creator = BRAND_MARKETPLACE_CREATORS.find(c => c.handle === match.creatorHandle);
                                return (
                                  <div
                                    key={match.creatorHandle}
                                    style={{
                                      padding:'14px 12px',
                                      borderBottom: idx < autoMatchedCreators.length - 1 ? `1px solid ${C.border}` : 'none',
                                      display:'flex',
                                      gap:'12px',
                                      alignItems:'flex-start',
                                      cursor:'pointer',
                                      background: batchSendCreatorIds.has(idx) ? `${C.primary}10` : 'transparent',
                                      borderLeft: batchSendCreatorIds.has(idx) ? `3px solid ${C.primary}` : '3px solid transparent',
                                      transition:'background 0.15s, border-color 0.15s'
                                    }}
                                    onClick={() => {
                                      setBatchSendCreatorIds(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(idx)) newSet.delete(idx);
                                        else newSet.add(idx);
                                        return newSet;
                                      });
                                    }}
                                  >
                                    <input type="checkbox" checked={batchSendCreatorIds.has(idx)} onChange={() => {}} style={{ cursor:'pointer', width:'18px', height:'18px', accentColor:C.primary, marginTop:'2px', flexShrink:0 }} />
                                    <div style={{ flex:1 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                                        <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{match.creatorName}</div>
                                        <div style={{ fontSize:'12px', fontWeight:700, background:`${C.primary}15`, color:C.primary, padding:'2px 8px', borderRadius:'4px' }}>{match.matchScore}%</div>
                                      </div>
                                      <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'6px' }}>{match.creatorProfession} · {creator?.followers} followers</div>
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                                        {match.reasons.map((reason, i) => (
                                          <div key={i} style={{ fontSize:'10px', background:C.card, color:C.textMuted, padding:'3px 8px', borderRadius:'4px' }}>{reason}</div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div style={{ marginBottom:'16px', padding:'10px 12px', background:`${C.primary}08`, border:`1px solid ${C.primary}30`, borderRadius:'8px' }}>
                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>{batchSendCreatorIds.size} selected</div>
                            <div style={{ fontSize:'11px', color:C.textSecondary }}>Each selected creator will receive an invitation</div>
                          </div>

                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={() => { setShowBatchSendModal(false); setLastCreatedCampaignId(null); setBatchSendCreatorIds(new Set()); setAutoMatchedCreators([]); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'11px', color:C.text, fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                            <button onClick={() => { batchSendCreatorIds.forEach(idx => { const match = autoMatchedCreators[idx]; const creator = BRAND_MARKETPLACE_CREATORS.find(c => c.handle === match.creatorHandle); const campaign = campaigns.find(c => c.id === lastCreatedCampaignId); const oppIdx = activeOpportunities.findIndex(o => o.brand === campaign?.title); if (creator && campaign) { const app: SharedApplication = { id:Date.now() + idx, campaignId:lastCreatedCampaignId ?? 0, campaignTitle:campaign.title || 'Campaign', creatorProfession:creator.valueSkin || '', creatorHandle:creator.handle || '', creatorName:creator.name, status:'invited' as SharedApplication['status'], appliedAt:new Date().toISOString(), opportunityIndex: oppIdx >= 0 ? oppIdx : 0 }; firebaseCreateApplication(app); firebaseSendNotification(creator.handle || '', 'campaign', `${profileName} invited you to: ${campaign.title || 'Campaign'}`); } }); setPurchaseToast(`Invitations sent to ${batchSendCreatorIds.size} creator${batchSendCreatorIds.size !== 1 ? 's' : ''}`); setTimeout(() => setPurchaseToast(null), 3000); setShowBatchSendModal(false); setLastCreatedCampaignId(null); setBatchSendCreatorIds(new Set()); setAutoMatchedCreators([]); }} style={{ flex:1, background:batchSendCreatorIds.size > 0 ? C.primary : C.border, border:'none', borderRadius:'8px', padding:'11px', color:'#fff', fontWeight:700, fontSize:'13px', cursor: batchSendCreatorIds.size > 0 ? 'pointer' : 'not-allowed', opacity: batchSendCreatorIds.size > 0 ? 1 : 0.5 }}>Send to {batchSendCreatorIds.size} Creator{batchSendCreatorIds.size !== 1 ? 's' : ''}</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cancel Deal Modal */}
                    {showCancelDealModal && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'380px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Cancel this deal?</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>This action cannot be undone. The brand will be notified.</div>
                          <div style={{ fontSize:'11px', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Reason</div>
                          {['Scheduling conflict', 'Terms changed after agreement', 'Found better opportunity', 'Brand unresponsive', 'Personal reasons', 'Other'].map(reason => (
                            <button key={reason} onClick={() => setCancelReason(reason)} style={{ display:'block', width:'100%', textAlign:'left', background: cancelReason === reason ? `${C.primary}12` : C.card, border: `1px solid ${cancelReason === reason ? C.primary : C.border}`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color:C.text, cursor:'pointer', marginBottom:'4px', fontWeight: cancelReason === reason ? 600 : 400 }}>
                              {reason}
                            </button>
                          ))}
                          <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                            <button onClick={() => { setShowCancelDealModal(false); setCancelReason(''); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Keep Deal</button>
                            <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); setCreatorDealLifecycle('checklist'); setDealUploadSimulated(false); setDeliverableStatuses({}); setDeliverableLinks({}); setDeliverableLinkInputs({}); setPaymentMilestones({ advance:'pending', upload:'pending', approval:'pending' }); setShowCancelDealModal(false); setCancelReason(''); setPurchaseToast('Deal cancelled'); setTimeout(() => setPurchaseToast(null), 3000); }} disabled={!cancelReason} style={{ flex:1, background: cancelReason ? '#ef4444' : C.border, border:'none', borderRadius:'8px', padding:'10px', color:'#fff', fontWeight:600, fontSize:'13px', cursor: cancelReason ? 'pointer' : 'not-allowed', opacity: cancelReason ? 1 : 0.5 }}>Cancel Deal</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feature 2: Creator Profile Modal */}
                    {/* Dispute Modal */}
                    {showDisputeModal !== null && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'400px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>File a Dispute</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>Disputes are reviewed within 48 hours. Provide evidence to support your claim.</div>
                          <div style={{ fontSize:'11px', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Reason</div>
                          {['Brand did not pay after approval', 'Brand used content beyond agreed rights', 'Brand violated exclusivity terms', 'Content was used without credit', 'Payment amount was incorrect', 'Other'].map(reason => (
                            <button key={reason} onClick={() => setDisputeReason(reason)} style={{ display:'block', width:'100%', textAlign:'left', background: disputeReason === reason ? `${C.primary}12` : C.card, border: `1px solid ${disputeReason === reason ? C.primary : C.border}`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color:C.text, cursor:'pointer', marginBottom:'4px', fontWeight: disputeReason === reason ? 600 : 400 }}>
                              {reason}
                            </button>
                          ))}
                          <div style={{ marginTop:'10px' }}>
                            <div style={{ fontSize:'11px', fontWeight:600, color:C.textMuted, marginBottom:'4px' }}>Evidence (describe or paste links)</div>
                            <textarea value={disputeEvidence} onChange={e => setDisputeEvidence(e.target.value)} placeholder="Describe what happened, include screenshots or links..." rows={3} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, resize:'none', boxSizing:'border-box' }} />
                          </div>
                          <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                            <button onClick={() => { setShowDisputeModal(null); setDisputeReason(''); setDisputeEvidence(''); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                            <button onClick={() => {
                              setCompletedDeals(prev => prev.map(d => d.id === showDisputeModal ? { ...d, disputed: true, disputeReason, disputeStatus: 'filed' as const } : d));
                              setPurchaseToast('Dispute filed — under review');
                              setTimeout(() => setPurchaseToast(null), 3000);
                              setShowDisputeModal(null); setDisputeReason(''); setDisputeEvidence('');
                            }} disabled={!disputeReason} style={{ flex:1, background: disputeReason ? '#ef4444' : C.border, border:'none', borderRadius:'8px', padding:'10px', color:'#fff', fontWeight:600, fontSize:'13px', cursor: disputeReason ? 'pointer' : 'not-allowed', opacity: disputeReason ? 1 : 0.5 }}>File Dispute</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tip Modal */}
                    {showTipModal && tipForDealId !== null && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'400px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Send a Tip 💰</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>Thank this creator for excellent work. Tips go directly to them with zero platform fees.</div>
                          <div style={{ marginBottom:'14px' }}>
                            <div style={{ fontSize:'11px', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Tip amount ($) *</div>
                            <input type="number" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="Enter amount" min="1" style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:C.text, boxSizing:'border-box' }} />
                          </div>
                          <div style={{ marginBottom:'14px', padding:'10px 12px', background:`${C.warning}12`, border:`1px solid ${C.warning}30`, borderRadius:'8px' }}>
                            <div style={{ fontSize:'11px', color:C.warning, fontWeight:600 }}>Direct payout</div>
                            <div style={{ fontSize:'10px', color:C.textSecondary, marginTop:'2px' }}>${tipAmount ? parseInt(tipAmount).toLocaleString() : '0'}.00 will go straight to the creator. No commission, no fees.</div>
                          </div>
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={() => { setShowTipModal(false); setTipAmount(''); setTipForDealId(null); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                            <button onClick={() => { if (tipAmount && completedDeals[tipForDealId!]) { const updatedDeals = [...completedDeals]; updatedDeals[tipForDealId!] = { ...updatedDeals[tipForDealId!], tipped: (updatedDeals[tipForDealId!].tipped || 0) + parseInt(tipAmount) }; setCompletedDeals(updatedDeals); setPurchaseToast(`💰 Tip of $${parseInt(tipAmount).toLocaleString()} sent to ${completedDeals[tipForDealId!].brand}`); setTimeout(() => setPurchaseToast(null), 3000); setShowTipModal(false); setTipAmount(''); setTipForDealId(null); } }} disabled={!tipAmount || parseInt(tipAmount) < 1} style={{ flex:1, background: (tipAmount && parseInt(tipAmount) >= 1) ? C.warning : C.border, border:'none', borderRadius:'8px', padding:'10px', color:tipAmount && parseInt(tipAmount) >= 1 ? '#000' : C.text, fontWeight:600, fontSize:'13px', cursor: (tipAmount && parseInt(tipAmount) >= 1) ? 'pointer' : 'not-allowed', opacity: (tipAmount && parseInt(tipAmount) >= 1) ? 1 : 0.5 }}>Send Tip</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showCreatorProfileModal && selectedProfileCreator && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'500px', width:'100%', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
                          <button onClick={() => { setShowCreatorProfileModal(false); setSelectedProfileCreator(null); }} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:C.textMuted, fontSize:'22px', cursor:'pointer', lineHeight:1 }}>x</button>
                          <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', marginBottom:'16px' }}>
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfileCreator.name.replace(/\s/g,'')}`} alt={selectedProfileCreator.name} style={{ width:'60px', height:'60px', borderRadius:'50%', background:C.surfaceAlt }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>{selectedProfileCreator.name}</div>
                              <a href={`https://portfolio.valueskins.com/${selectedProfileCreator.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:C.primary, textDecoration:'none' }}>{selectedProfileCreator.handle}</a>
                              <div style={{ fontSize:'11px', color:C.textSecondary, marginTop:'4px' }}>4.8★ rating from {(selectedProfileCreator.name.charCodeAt(0) % 15) + 5} deals</div>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px', padding:'10px 12px', background:C.card, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                            <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Quick Stats</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.followers}</div><div style={{ fontSize:'9px', color:C.textMuted }}>Followers</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.engagement}</div><div style={{ fontSize:'9px', color:C.textMuted }}>Engagement</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.dealCompletionRate}%</div><div style={{ fontSize:'9px', color:C.textMuted }}>Completion Rate</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>${(selectedProfileCreator.minDealUsd / 1000).toFixed(1)}K</div><div style={{ fontSize:'9px', color:C.textMuted }}>Min Deal</div></div>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>ValueSkin</div>
                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, background:C.card, padding:'10px 12px', borderRadius:'8px', border:`1px solid ${C.border}` }}>{selectedProfileCreator.valueSkin}</div>
                          </div>
                          {/* Feature 7: Public Profile Link */}
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Share Profile</div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                              <div style={{ flex:1, fontSize:'12px', color:C.primary, background:C.card, padding:'10px 12px', borderRadius:'8px', border:`1px solid ${C.border}`, fontFamily:'monospace', wordBreak:'break-all' }}>valueskins.com/@{selectedProfileCreator.handle.replace('@','')}</div>
                              <button onClick={() => { navigator.clipboard.writeText(`valueskins.com/@${selectedProfileCreator.handle.replace('@','')}`); setProfileLinkCopied(true); setTimeout(() => setProfileLinkCopied(false), 2000); }} style={{ padding:'10px 12px', background:profileLinkCopied ? C.success : C.primary, border:'none', borderRadius:'8px', color:'#fff', fontWeight:700, fontSize:'12px', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
                                {profileLinkCopied ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Audience</div>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              <span style={{ fontSize:'10px', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceAgeRange}</span>
                              <span style={{ fontSize:'10px', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceLocation}</span>
                              <span style={{ fontSize:'10px', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceLang}</span>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Deal Types</div>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              {selectedProfileCreator.dealTypes.map(dt => (
                                <span key={dt} style={{ fontSize:'10px', fontWeight:600, padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{dt}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Portfolio</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                              {selectedProfileCreator.portfolio.map((p, idx) => (
                                <div key={idx} style={{ fontSize:'11px', color:C.text, padding:'6px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}` }}>▶ {p}</div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => { setShowCreatorProfileModal(false); setSelectedProfileCreator(null); }} style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'11px', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Close</button>
                        </div>
                      </div>
                    )}

                    {/* Brand Identity — skin selector or redirect to store */}
                    {campaigns.length > 0 && (
                      brandValueSkins.length > 0 ? (
                        <div style={{ background:C.card, border:`1px solid rgba(230,81,0,0.3)`, borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                            <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Active ValueSkin</div>
                            {brandValueSkins.length < 3 && (
                              <button onClick={() => setActiveView('store')} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', fontSize:'10px', color:C.textSecondary, cursor:'pointer', fontWeight:600 }}>+ Add Skin</button>
                            )}
                          </div>
                          <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                            {brandValueSkins.map(skin => {
                              const isActive = activeBrandSkin === skin;
                              const badge = PROFESSION_BADGES[skin];
                              return (
                                <button
                                  key={skin}
                                  onClick={() => setActiveBrandSkin(skin)}
                                  style={{
                                    flex: 1, padding:'10px 8px', borderRadius:'10px', cursor:'pointer', transition:'all 0.15s',
                                    background: isActive ? `${badge?.color ?? C.primary}15` : C.bg,
                                    border: `2px solid ${isActive ? (badge?.color ?? C.primary) : C.border}`,
                                  }}
                                >
                                  {getStickerForProfession(skin) ? (
                                    <img src={getStickerForProfession(skin)!} alt={skin} style={{ width:'32px', height:'32px', objectFit:'contain', margin:'0 auto 4px' }} />
                                  ) : (
                                    <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', color: badge?.color ?? C.primary, marginBottom:'3px' }}>
                                      {badge?.abbreviation ?? skin.slice(0,3).toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ fontSize:'11px', color: isActive ? C.text : C.textSecondary, fontWeight: isActive ? 600 : 400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {skin}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {activeBrandSkin && (
                            <div style={{ fontSize:'11px', color:C.textSecondary, lineHeight:1.4 }}>
                              Campaigns and proposals you create will be under <strong style={{ color:C.text }}>{activeBrandSkin}</strong>. Creators with this ValueSkin will see you as a match.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
                          <div style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'8px' }}>Your Brand Identity</div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ fontSize:'12px', color:C.textMuted }}>Purchase a ValueSkin to start contacting creators</div>
                            <button onClick={() => setActiveView('store')} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'11px', fontWeight:700, color:'#fff', cursor:'pointer' }}>Get ValueSkin</button>
                          </div>
                        </div>
                      )
                    )}

                    {marketplaceTab === 'creators' && (<>
                    {campaigns.length === 0 ? (
                      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'22px 18px', marginBottom:'16px', textAlign:'center' }}>
                        <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Create a campaign first</div>
                        <div style={{ fontSize:'12px', color:C.textSecondary, lineHeight:1.5, marginBottom:'14px' }}>
                          Creator suggestions unlock after you publish your first campaign brief. Once the niche and requirements are set, matching creators will appear here.
                        </div>
                        <button onClick={() => setMarketplaceTab('campaigns')} style={{ background:C.primary, border:'none', borderRadius:'8px', padding:'10px 14px', color:'#fff', fontWeight:700, fontSize:'12px', cursor:'pointer' }}>
                          Go to Campaigns
                        </button>
                      </div>
                    ) : (<>
                    {/* Matching Rule Banner */}
                    <div style={{ background: 'rgba(0,102,204,0.06)', border: `1px solid rgba(0,102,204,0.15)`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>ValueSkin Matching Active</div>
                        <div style={{ fontSize: '11px', color: C.textSecondary }}>Only creators holding the ValueSkin you select below will appear. Matching is deterministic and server-enforced.</div>
                      </div>
                    </div>

                    {/* Saved Searches */}
                    {adminShowSavedSearches && savedSearches.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Saved Searches</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {savedSearches.map(s => (
                            <button key={s.id} onClick={() => { setBrandSearchMode('profession'); setBrandSearchQuery(s.profession); setFilterAudienceAge(s.age); setFilterAudienceLoc(s.loc); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}40` }}>
                              {s.label}
                              <span onClick={e => { e.stopPropagation(); setSavedSearches(prev => prev.filter(x => x.id !== s.id)); }} style={{ marginLeft: '2px', color: C.textMuted, fontSize: '12px' }}>×</span>
                            </button>
                          ))}
                          <button onClick={() => { const label = `${brandSearchQuery || 'Any'}, ${filterAudienceAge || 'Any age'}, ${filterAudienceLoc || 'Any loc'}`; setSavedSearches(prev => [...prev, { id: Date.now(), label, profession: brandSearchQuery, age: filterAudienceAge ?? '', loc: filterAudienceLoc }]); }}
                            style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` }}>
                            + Save current search
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Deal Templates */}
                    {adminShowDealTemplates && savedDealTemplates.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Deal Templates</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {savedDealTemplates.map(t => (
                            <button key={t.id} onClick={() => { setBrandBriefTitle(t.name); setBrandBriefDeliverables(t.deliverables); setBrandBudget(t.budget); setBrandCampaignType(t.type); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'rgba(230,81,0,0.08)', color: C.textSecondary, border: '1px solid rgba(230,81,0,0.25)' }}>
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Bar */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {(['profession', 'name', 'general'] as const).map(mode => (
                          <button key={mode} onClick={() => { setBrandSearchMode(mode); setBrandSearchQuery(''); }}
                            style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
                              background: brandSearchMode === mode ? C.primary : C.card,
                              color: brandSearchMode === mode ? '#fff' : C.textSecondary,
                              border: `1px solid ${brandSearchMode === mode ? C.primary : C.border}`,
                            }}>{mode}</button>
                        ))}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          value={brandSearchQuery}
                          onChange={e => setBrandSearchQuery(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder={
                            brandSearchMode === 'profession' ? 'Search by profession (e.g. Piano Player, Fitness Coach...)' :
                            brandSearchMode === 'name' ? 'Search by creator name or handle...' :
                            'Search creators, professions, or handles...'
                          }
                          style={{ width: '100%', padding: '10px 36px 10px 12px', background: C.card, border: `1px solid ${brandSearchQuery ? C.primary : C.border}`, borderRadius: '10px', color: C.text, fontSize: '13px', boxSizing: 'border-box' as const, outline: 'none' }}
                        />
                        {brandSearchQuery && (
                          <button onClick={() => setBrandSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '16px' }}>×</button>
                        )}
                      </div>
                      {brandSearchQuery && brandSearchMode === 'profession' && (
                        <div style={{ marginTop: '6px', padding: '8px 10px', background: 'rgba(0,102,204,0.06)', borderRadius: '8px', fontSize: '11px', color: C.textSecondary }}>
                          Showing exact <strong style={{ color: C.text }}>{brandSearchQuery}</strong> matches first, then related professions
                        </div>
                      )}
                    </div>

                    {/* Advanced Audience & Deal Filters */}
                    <div style={{ marginBottom: '14px' }}>
                      <button onClick={() => setShowAudienceFilters(p => !p)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: showAudienceFilters ? '10px 10px 0 0' : '10px', padding: '9px 14px', cursor: 'pointer', color: C.textSecondary, fontSize: '11px', fontWeight: 700 }}>
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.6px' }}>Audience & Deal Filters</span>
                        <span>{showAudienceFilters ? '▲' : '▼'}</span>
                      </button>
                      {showAudienceFilters && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px' }}>
                          {/* Audience Age Range */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Audience Age Range</div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {[null, '13-17', '18-24', '25-34', '35-44', '45-54', '55+'].map(a => (
                                <button key={a ?? 'all'} onClick={() => setFilterAudienceAge(a)}
                                  style={{ padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    background: filterAudienceAge === a ? `${C.primary}25` : C.bg,
                                    color: filterAudienceAge === a ? C.primary : C.textSecondary,
                                    border: `1px solid ${filterAudienceAge === a ? C.primary : C.border}`,
                                  }}>{a ?? 'Any'}</button>
                              ))}
                            </div>
                          </div>
                          {/* Audience Language */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Audience Language</div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {[null, 'English', 'Spanish', 'Hindi', 'Portuguese', 'Arabic', 'Mandarin'].map(l => (
                                <button key={l ?? 'all'} onClick={() => setFilterAudienceLang(l)}
                                  style={{ padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    background: filterAudienceLang === l ? `${C.primary}25` : C.bg,
                                    color: filterAudienceLang === l ? C.primary : C.textSecondary,
                                    border: `1px solid ${filterAudienceLang === l ? C.primary : C.border}`,
                                  }}>{l ?? 'Any'}</button>
                              ))}
                            </div>
                          </div>
                          {/* Audience Location + Min Deal side by side */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Audience Location</div>
                              <input value={filterAudienceLoc} onChange={e => setFilterAudienceLoc(e.target.value)} placeholder="e.g. USA" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const, outline: 'none' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Min Deal Size (USD)</div>
                              <input value={filterMinDeal} onChange={e => setFilterMinDeal(e.target.value)} type="number" placeholder="e.g. 1000" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const, outline: 'none' }} />
                            </div>
                          </div>
                          {/* Deal Type */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Deal Type</div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {[null, 'Paid', 'Gifted Product', 'Equity', 'Barter', 'Revenue Share', 'Ambassador'].map(d => (
                                <button key={d ?? 'all'} onClick={() => setFilterDealType(d)}
                                  style={{ padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    background: filterDealType === d ? `${C.primary}25` : C.bg,
                                    color: filterDealType === d ? C.primary : C.textSecondary,
                                    border: `1px solid ${filterDealType === d ? C.primary : C.border}`,
                                  }}>{d ?? 'Any'}</button>
                              ))}
                            </div>
                          </div>
                          {/* Response Time Max */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Max Response Time</div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              {[null, 4, 12, 24, 48].map(h => (
                                <button key={h ?? 'any'} onClick={() => setFilterResponseMax(h)}
                                  style={{ flex: 1, padding: '5px 4px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    background: filterResponseMax === h ? `${C.primary}25` : C.bg,
                                    color: filterResponseMax === h ? C.primary : C.textSecondary,
                                    border: `1px solid ${filterResponseMax === h ? C.primary : C.border}`,
                                  }}>{h ? `≤${h}h` : 'Any'}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        {activeBrandSkin ? `${activeBrandSkin} Creators` : 'Select a ValueSkin above'}
                      </div>
                      <button
                        onClick={() => setFilterBarterOnly(prev => !prev)}
                        style={{
                          fontSize: '11px', fontWeight: 600,
                          color: filterBarterOnly ? C.textSecondary : C.textSecondary,
                          background: filterBarterOnly ? 'rgba(16,185,129,0.1)' : 'transparent',
                          border: `1px solid ${filterBarterOnly ? C.textSecondary : C.border}`,
                          padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                        }}
                      >
                        {filterBarterOnly ? 'Barter Only' : 'Show All'}
                      </button>
                    </div>
                    {(() => {
                      const q = brandSearchQuery.trim().toLowerCase();
                      // Show creators with valueSkin matching the active brand skin
                      // Preserve original index (_origIdx) so deal room lookup works after filtering
                      const creatorsForSkin = backendCreators.length > 0 ? backendCreators : [];
                      let results = creatorsForSkin.filter(c =>
                        (!filterBarterOnly || c.willingToBarter) &&
                        (!filterAudienceAge || c.audienceAgeRange === filterAudienceAge) &&
                        (!filterAudienceLang || c.audienceLang === filterAudienceLang) &&
                        (!filterAudienceLoc.trim() || c.audienceLocation.toLowerCase().includes(filterAudienceLoc.trim().toLowerCase())) &&
                        (!filterMinDeal || c.minDealUsd >= Number(filterMinDeal)) &&
                        (!filterDealType || c.dealTypes.includes(filterDealType)) &&
                        (!filterResponseMax || c.responseTimeHrs <= filterResponseMax)
                      );
                      if (q) {
                        // Always search across name, handle, and profession regardless of mode
                        const nameMatches = results.filter(c => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q));
                        const profExact = results.filter(c => c.valueSkin.toLowerCase() === q && !nameMatches.includes(c));
                        const profPartial = results.filter(c => c.valueSkin.toLowerCase().includes(q) && c.valueSkin.toLowerCase() !== q && !nameMatches.includes(c));
                        // Name matches always show first, then profession matches
                        if (brandSearchMode === 'name') {
                          results = nameMatches;
                        } else if (brandSearchMode === 'profession') {
                          results = [...profExact, ...profPartial, ...nameMatches.filter(c => !profExact.includes(c) && !profPartial.includes(c))];
                        } else {
                          results = [...nameMatches, ...profExact, ...profPartial];
                        }
                      }
                      return (
                        <>
                          {campaigns.length === 0 && (
                            <div style={{ background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '32px 24px', textAlign: 'center' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Create a campaign first</div>
                              <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.6, maxWidth: '520px', margin: '0 auto 20px' }}>
                                Creator discovery unlocks after you create a campaign. Once the brief is live, you can review matching creators and start deals from here.
                              </div>
                              <button onClick={() => setMarketplaceTab('campaigns')} style={{ background: C.primary, border: 'none', borderRadius: '8px', padding: '10px 18px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                Create Campaign
                              </button>
                            </div>
                          )}
                          {campaigns.length > 0 && results.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '30px 20px', color: C.textMuted }}>
                              <div style={{ fontSize: '14px', marginBottom: '4px' }}>No creators found</div>
                              <div style={{ fontSize: '11px' }}>Try a different search term or clear filters.</div>
                            </div>
                          )}
                          {campaigns.length > 0 && results.map((creator, i) => {
                      const origIdx = (creator as any)._origIdx ?? i;
                      const badge = PROFESSION_BADGES[creator.valueSkin];
                      const abbr = badge?.abbreviation ?? creator.valueSkin.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
                      const badgeColor = badge?.color ?? C.primary;
                      const isNegotiating = negotiatingCreator === origIdx;
                      return (
                        <div key={i} data-creator-idx={origIdx} style={{ background: C.card, borderRadius: '10px', padding: '12px', marginBottom: '10px', border: `1px solid ${isNegotiating ? C.primary : C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.name.replace(/\s/g, '')}`}
                            alt={creator.name}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>{creator.name}</div>
                            <a href={`https://portfolio.valueskins.com/${creator.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11px', color: C.primary, textDecoration: 'none' }}>{creator.handle}</a>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '12px', color: C.text }}>{creator.rate}</div>
                          </div>

                          {!isNegotiating ? (
                            (() => {
                              const hasMatch = activeBrandSkin === creator.valueSkin;
                              const noBrandSkin = brandValueSkins.length === 0;
                              return (
                                <div>
                                  {!hasMatch && !noBrandSkin && (
                                    <div style={{ background:'rgba(230,81,0,0.06)', border:'1px solid rgba(230,81,0,0.2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'8px', fontSize:'11px', color:C.textSecondary }}>
                                      No shared ValueSkin — you are {activeBrandSkin}, this creator is {creator.valueSkin}
                                    </div>
                                  )}
                                  {noBrandSkin && (
                                    <div style={{ background:'rgba(230,81,0,0.06)', border:'1px solid rgba(230,81,0,0.2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'8px', fontSize:'11px', color:C.textSecondary }}>
                                      Get a brand ValueSkin to contact creators
                                    </div>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (noBrandSkin) { setPurchaseToast('Get a brand ValueSkin first'); setTimeout(() => setPurchaseToast(null), 3000); return; }
                                      if (!hasMatch) { setPurchaseToast('No shared ValueSkin with this creator'); setTimeout(() => setPurchaseToast(null), 3000); return; }
                                      // Check if there's already an active deal with this creator
                                      const existingPrefix = `${creator.name}|${creator.valueSkin}|`;
                                      const existingDealKey = Object.keys(dealStates).find(key => key.startsWith(existingPrefix) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief');
                                      if (existingDealKey) {
                                        // Resume existing deal — restore all state from deal
                                        const existingOppIdx = parseInt(existingDealKey.split('|')[2] || '0');
                                        const existingDeal = dealStates[existingDealKey];
                                        setNegotiatingCreator(origIdx);
                                        setBrandCurrentOppIndex(existingOppIdx);
                                        if (existingDeal?.briefTitle) setBrandBriefTitle(existingDeal.briefTitle);
                                        if (existingDeal?.offerAmount) setBrandBudget(existingDeal.offerAmount);
                                      } else {
                                        // No active deal — brands must create a campaign first
                                        setPurchaseToast('Create a campaign first to reach this creator');
                                        setTimeout(() => setPurchaseToast(null), 3000);
                                      }
                                    }}
                                    style={{ width:'100%', background: hasMatch ? (creator.featured ? C.primary : C.surfaceAlt) : C.surfaceAlt, border: hasMatch && creator.featured ? 'none' : `1px solid ${hasMatch ? C.border : 'rgba(230,81,0,0.3)'}`, padding: '10px 16px', borderRadius: '8px', color: hasMatch ? '#fff' : C.warning, fontWeight: '600', cursor: 'pointer', fontSize: '14px', opacity: hasMatch ? 1 : 0.7 }}
                                  >
                                    {noBrandSkin ? 'No ValueSkin' : hasMatch ? (Object.keys(dealStates).find(key => key.startsWith(`${creator.name}|${creator.valueSkin}|`) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief') ? 'View Deal' : 'Create Campaign') : 'No Shared ValueSkin'}
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '14px', border: `1px solid rgba(230,81,0,0.3)` }}>
                              {/* Brand Deal Room Back Button */}
                              <button onClick={() => setNegotiatingCreator(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '0 0 8px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                Back to creators
                              </button>
                              {/* Deal Room Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                  <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.name.replace(/\s/g, '')}`}
                                    alt={creator.name}
                                    style={{ width:'34px', height:'34px', borderRadius:'50%', background:C.surfaceAlt, flexShrink:0 }}
                                  />
                                  <div>
                                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                      </svg>
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Deal Room</span>
                                    </div>
                                    <a
                                      href={`https://portfolio.valueskins.com/${creator.handle.replace('@', '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ fontSize:'12px', fontWeight:700, color:C.text, textDecoration:'none', display:'block', marginTop:'2px' }}
                                      onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                                      onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                                    >{creator.name}</a>
                                    {activeBrandSkin && <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'1px' }}>Your identity: {activeBrandSkin}{brandValueSkins.length > 0 && ' · Verified'}</div>}
                                  </div>
                                </div>
                                {brandDealPhase === 'pending' && (
                                  <div style={{ fontSize: '10px', color: C.textSecondary, background: C.surfaceAlt, padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                    Expires in 23h 47m
                                  </div>
                                )}
                                {brandDealPhase === 'counter' && (
                                  <div style={{ fontSize: '10px', color: C.textSecondary, background: C.surfaceAlt, padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                    Respond within 23h 12m
                                  </div>
                                )}
                              </div>

                              {/* Deal Lifecycle Phase Indicator — brand view */}
                              <div style={{ marginBottom:'12px', padding:'8px 10px', background:C.bg, borderRadius:'8px', border:`1px solid ${C.border}` }}>
                                <div style={{ fontSize:'9px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'6px', letterSpacing:'0.5px' }}>Deal Progression</div>
                                <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                                  {(['brief', 'pending', 'counter', 'accepted'] as const).map((phase, idx, arr) => {
                                    const phaseNames = { brief: 'Brief', pending: 'Sent', counter: 'Counter', accepted: 'Accepted' };
                                    const phaseOrder = ['brief', 'pending', 'counter', 'accepted'];
                                    const currentIdx = phaseOrder.indexOf(brandDealPhase);
                                    const isCompleted = idx < currentIdx;
                                    const isActive = idx === currentIdx;
                                    return (
                                      <React.Fragment key={phase}>
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                                          <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:isCompleted?C.success:isActive?C.primary:C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, color:isCompleted||isActive?'#fff':C.textMuted }}>{isCompleted?'\u2713':idx+1}</div>
                                          <div style={{ fontSize:'7px', color:isActive?C.primary:C.textMuted, fontWeight:isActive?700:400, textAlign:'center', minWidth:'36px' }}>{phaseNames[phase]}</div>
                                        </div>
                                        {idx < arr.length - 1 && <div style={{ flex:1, height:'2px', background:isCompleted?C.success:C.border, margin:'0 1px', marginTop:'-8px' }} />}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Phase 1: No active deal — prompt to create campaign */}
                              {brandDealPhase === 'brief' && (
                                <>
                                  <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📢</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>No active deal with {creator.name}</div>
                                    <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '20px', lineHeight: 1.6 }}>
                                      Create a campaign and invite {creator.name} to start a deal. Once they accept the invite, you can negotiate and send offers here.
                                    </div>
                                    <button onClick={() => { setNegotiatingCreator(null); setShowCampaignCreator(true); }} style={{ background: C.primary, border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                      Create Campaign
                                    </button>
                                  </div>
                                </>
                              )}

                              {/* Phase 2: Make offer */}
                              {brandDealPhase === 'offer' && (
                                <>
                                  {/* Brief summary */}
                                  <div style={{ background: C.bg, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: '10px', color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Brief</div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{brandBriefTitle}</div>
                                    <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>{brandCampaignType}</div>
                                    {brandBriefAbout && <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', lineHeight: 1.4 }}><span style={{ fontWeight: 600, color: C.textSecondary }}>Brand: </span>{brandBriefAbout}</div>}
                                    {brandBriefCampaignDesc && <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px', lineHeight: 1.4 }}><span style={{ fontWeight: 600, color: C.textSecondary }}>Campaign: </span>{brandBriefCampaignDesc}</div>}
                                    <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', lineHeight: 1.4 }}>{brandBriefDeliverables}</div>
                                    {brandOfferNonNegotiable && <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(239,68,68,0.85)', marginTop: '6px', padding: '3px 6px', background: 'rgba(239,68,68,0.07)', borderRadius: '4px', display: 'inline-block' }}>Non-negotiable offer</div>}
                                  </div>

                                  <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '8px', fontWeight: 600 }}>Creator's rate card</div>
                                    <div style={{ background: C.bg, borderRadius: '8px', padding: '10px', marginBottom: '12px', border: `1px solid ${C.border}` }}>
                                      {creator.rateCard && Object.entries(creator.rateCard).length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {Object.entries(creator.rateCard).map(([format, rate]) => (
                                            <div key={format} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.text }}>
                                              <span style={{ textTransform: 'capitalize', color: C.textMuted }}>{format}</span>
                                              <span style={{ fontWeight: 600 }}>{parseInt(String(rate).replace(/[^0-9]/g, '')).toLocaleString() ? `$${parseInt(String(rate).replace(/[^0-9]/g, '')).toLocaleString()}` : 'N/A'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '12px', color: C.textMuted }}>Standard rate: ${parseInt(creator.rate).toLocaleString()}/post</div>
                                      )}
                                    </div>

                                    <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px', fontWeight: 600 }}>Your offer</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>$</span>
                                      <input
                                        type="text"
                                        value={brandBudget}
                                        onChange={(e) => setBrandBudget(e.target.value.replace(/[^0-9]/g, ''))}
                                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '7px 10px', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', outline: 'none', width: '110px' }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = C.warning; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                                      />
                                      <span style={{ fontSize: '12px', color: C.textMuted }}>/any format</span>
                                    </div>
                                  </div>

                                  {/* Privacy note */}
                                  <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                    </svg>
                                    Only visible to you and {creator.name} · Auto-expires in 24h
                                  </div>

                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        // Write offer amount + brief to shared deal state so creator sees it
                                        if (brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const offerMsg = { id: Date.now(), sender: 'brand' as const, text: `Brand offer: $${parseInt(brandBudget).toLocaleString()}/post for ${brandBriefTitle}`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, {
                                            phase: 'pending',
                                            offerAmount: brandBudget,
                                            briefTitle: brandBriefTitle,
                                            chatMessages: [...existingMsgs, offerMsg],
                                            // Ensure context is always saved
                                            creatorName: creator.name,
                                            creatorSkin: creator.valueSkin,
                                            creatorMarketplaceIndex: negotiatingCreator ?? undefined,
                                          });
                                        }
                                        setBrandDealPhase('pending');
                                      }}
                                      style={{ flex: 1, background: C.warning, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Send Offer
                                    </button>
                                    <button onClick={() => setBrandDealPhase('brief')} style={{ background: 'none', border: `1px solid ${C.border}`, padding: '9px 12px', borderRadius: '8px', color: C.textSecondary, cursor: 'pointer', fontSize: '12px' }}>Back</button>
                                  </div>
                                </>
                              )}

                              {/* Phase 3: Pending — waiting for creator response */}
                              {brandDealPhase === 'pending' && (
                                <>
                                  <div style={{ textAlign: 'center', padding: '10px 0 14px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                      </svg>
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Offer Sent</div>
                                    <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.5, marginBottom: '14px' }}>
                                      ${brandBudget}/post · {brandCampaignType}<br />
                                      Waiting for {creator.name} to respond
                                    </div>
                                  </div>

                                  <div style={{ textAlign:'center', padding:'8px', fontSize:'11px', color:C.textMuted }}>
                                    Creator will respond from their deal room
                                  </div>
                                </>
                              )}

                              {/* Phase 3a: Soft hold active — creator accepted, brand must fund escrow */}
                              {brandDealPhase === 'softhold' && (
                                <>
                                  {/* Phase status bar */}
                                  <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'14px', padding:'8px 10px', background:'rgba(0,150,136,0.06)', borderRadius:'8px', border:'1px solid rgba(0,150,136,0.2)' }}>
                                    {[
                                      { label:'Offer Sent', done: true },
                                      { label:'Creator Accepted', done: true },
                                      { label:'Fund Escrow', done: brandDeal?.escrowFunded, active: !brandDeal?.escrowFunded },
                                      { label:'Work & Approve', done: false },
                                    ].map((s, i) => (
                                      <div key={i} style={{ display:'flex', alignItems:'center', gap:'4px', flex: i < 3 ? 'none' : 1 }}>
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                                          <div style={{ width:'18px', height:'18px', borderRadius:'50%', background: s.done ? C.success : s.active ? C.primary : C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'#fff', fontWeight:700 }}>
                                            {s.done ? '✓' : i + 1}
                                          </div>
                                          <div style={{ fontSize:'8px', color: s.done ? C.success : s.active ? C.primary : C.textMuted, fontWeight: s.active ? 700 : 400, whiteSpace:'nowrap' }}>{s.label}</div>
                                        </div>
                                        {i < 3 && <div style={{ width:'16px', height:'1px', background: s.done ? C.success : C.border, marginBottom:'10px' }} />}
                                      </div>
                                    ))}
                                  </div>

                                  {!brandDeal?.escrowFunded ? (
                                    <>
                                      <div style={{ background:'rgba(0,150,136,0.06)', border:'1px solid rgba(0,150,136,0.2)', borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                        <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>✅ Creator Accepted Your Offer</div>
                                        <div style={{ fontSize:'11px', color:C.textSecondary, lineHeight:1.5 }}>
                                          {creator.name} is ready to begin. Fund escrow to release the advance and start the deal.
                                        </div>
                                      </div>
                                      {(() => {
                                        const totalAmount = parseInt(brandBudget) || 5000;
                                        const commission = Math.round(totalAmount * platformCommissionPct / 100);
                                        const creatorPayout = commissionPaidBy === 'brand' ? totalAmount : totalAmount - commission;
                                        const brandDeposit = commissionPaidBy === 'brand' ? totalAmount + commission : totalAmount;
                                        const advanceToCreator = Math.round(creatorPayout * 0.3);
                                        return (
                                          <div style={{ background:C.bg, borderRadius:'10px', padding:'14px', border:`1px solid ${C.border}`, marginBottom:'12px' }}>
                                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>Escrow Breakdown</div>
                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'6px', padding:'6px 8px', background:'rgba(46,125,50,0.06)', borderRadius:'4px', border:'1px solid rgba(46,125,50,0.15)' }}>
                                              <span style={{ color:C.success, fontWeight:600 }}>Advance (30%)</span>
                                              <span style={{ color:C.success, fontWeight:700 }}>${advanceToCreator.toLocaleString()} — paid to creator immediately</span>
                                            </div>
                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                                              <span style={{ color:C.textMuted }}>Milestone (40%)</span>
                                              <span style={{ color:C.text, fontWeight:600 }}>${Math.round(creatorPayout * 0.4).toLocaleString()} — on content delivery</span>
                                            </div>
                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                                              <span style={{ color:C.textMuted }}>Completion (30%)</span>
                                              <span style={{ color:C.text, fontWeight:600 }}>${Math.round(creatorPayout * 0.3).toLocaleString()} — on your approval</span>
                                            </div>
                                            {commissionPaidBy === 'brand' && (
                                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginTop:'6px', padding:'4px 8px', background:'rgba(0,149,246,0.04)', borderRadius:'4px' }}>
                                                <span style={{ color:C.textMuted }}>Platform fee ({platformCommissionPct}%)</span>
                                                <span style={{ color:C.textSecondary, fontWeight:600 }}>${commission.toLocaleString()}</span>
                                              </div>
                                            )}
                                            <button
                                              onClick={() => {
                                                const now = new Date();
                                                const timeStr = now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit', hour12:false });
                                                const advanceMsg = { id: Date.now(), sender: 'brand' as const, text: `Escrow funded: $${totalAmount.toLocaleString()} deposited. Advance of $${advanceToCreator.toLocaleString()} (30%) paid to creator.`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                                const existingMsgs = brandDeal?.chatMessages || [];
                                                if (brandDealKey) {
                                                  updateDeal(brandDealKey, {
                                                    escrowFunded: true,
                                                    brandApprovalPhase: 'funded',
                                                    creatorDealLifecycle: 'deliverables',
                                                    paymentMilestones: { advance: 'released', upload: 'pending', approval: 'pending' },
                                                    chatMessages: [...existingMsgs, advanceMsg],
                                                  });
                                                }
                                                firebaseSendNotification(creator.name, 'application', `Advance paid: $${advanceToCreator.toLocaleString()} deposited to your account. Begin your deliverables.`);
                                                setPurchaseToast(`Escrow funded — $${advanceToCreator.toLocaleString()} advance paid to ${creator.name}`);
                                                setTimeout(() => setPurchaseToast(null), 4000);
                                              }}
                                              style={{ width:'100%', background:C.success, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'13px', marginTop:'10px' }}
                                            >
                                              Deposit ${brandDeposit.toLocaleString()} into Escrow
                                            </button>
                                          </div>
                                        );
                                      })()}
                                    </>
                                  ) : (
                                    <div style={{ textAlign:'center', padding:'16px 0' }}>
                                      {(() => {
                                        const dealPhase = brandDealPhase;
                                        const freshDeal = brandDealKey ? dealStates[brandDealKey] : null;
                                        const isFunded = freshDeal?.escrowFunded ?? brandDeal?.escrowFunded;
                                        const creatorLifecycle = freshDeal?.creatorDealLifecycle ?? brandDeal?.creatorDealLifecycle;
                                        const hasSubmittedDeliverables = Object.keys((freshDeal?.deliverableLinks || brandDeal?.deliverableLinks || {}) as Record<number, string>).length > 0;
                                        let statusTitle = 'Escrow Funded';
                                        let statusMsg = 'Creator has been notified to begin work';
                                        let statusIcon = C.success;

                                        if (dealPhase === 'offer_sent') {
                                          statusTitle = 'Waiting for Creator';
                                          statusMsg = 'Creator is reviewing your offer...';
                                          statusIcon = C.primary;
                                        } else if (dealPhase === 'counter' || dealPhase === 'negotiation') {
                                          statusTitle = 'Negotiating';
                                          statusMsg = 'Creator is countering your offer...';
                                          statusIcon = C.primary;
                                        } else if (dealPhase === 'last_offer') {
                                          statusTitle = 'Final Negotiation';
                                          statusMsg = 'Creator has submitted a counter-offer. Review to proceed.';
                                          statusIcon = C.primary;
                                        } else if (dealPhase === 'softhold' && !isFunded) {
                                          statusTitle = 'Deal Accepted';
                                          statusMsg = 'Creator is ready. Fund escrow to begin.';
                                          statusIcon = C.success;
                                        } else if (dealPhase === 'softhold' && isFunded && creatorLifecycle === 'deliverables' && !hasSubmittedDeliverables) {
                                          statusTitle = 'Awaiting Deliverables';
                                          statusMsg = 'Creator is preparing content...';
                                          statusIcon = C.primary;
                                        } else if (dealPhase === 'softhold' && isFunded && (creatorLifecycle === 'submitted' || hasSubmittedDeliverables)) {
                                          statusTitle = 'Reviewing Deliverables';
                                          statusMsg = 'Creator has submitted their work';
                                          statusIcon = C.primary;
                                        }

                                        return (
                                          <>
                                            <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:`${statusIcon === C.warning ? 'rgba(255,171,0,0.1)' : statusIcon === C.primary ? 'rgba(0,149,246,0.1)' : 'rgba(46,125,50,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                              {statusIcon === C.warning ? (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={statusIcon} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                              ) : (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={statusIcon} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                              )}
                                            </div>
                                            <div style={{ fontSize:'14px', fontWeight:700, color:statusIcon }}>{statusTitle}</div>
                                            <div style={{ fontSize:'12px', color:C.textSecondary, marginTop:'4px' }}>{statusMsg}</div>
                                          </>
                                        );
                                      })()}
                                      {(() => {
                                        const freshDeal = brandDealKey ? dealStates[brandDealKey] : null;
                                        const creatorLifecycle = freshDeal?.creatorDealLifecycle ?? brandDeal?.creatorDealLifecycle;
                                        const bdLinks = (freshDeal?.deliverableLinks || brandDeal?.deliverableLinks || {}) as Record<number, string>;
                                        const hasSubmittedDeliverables = Object.keys(bdLinks).length > 0;
                                        return (creatorLifecycle === 'submitted' || hasSubmittedDeliverables) && (freshDeal?.brandApprovalPhase ?? brandDeal?.brandApprovalPhase) !== 'approved';
                                      })() && (() => {
                                        const freshDeal = brandDealKey ? dealStates[brandDealKey] : null;
                                        const bdLinks = (freshDeal?.deliverableLinks || brandDeal?.deliverableLinks || {}) as Record<number, string>;
                                        const agreedAmt = parseInt(agreedDealAmount || brandBudget || '5000');
                                        const approvalAmt = Math.round(agreedAmt * 0.3);
                                        return (
                                          <div style={{ marginTop:'14px', textAlign:'left' }}>
                                            <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>Review Submitted Deliverables</div>
                                            {Object.entries(bdLinks).length > 0 ? Object.entries(bdLinks).map(([idx, link]) => (
                                              <div key={idx} style={{ background:C.bg, borderRadius:'8px', padding:'10px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                                                <div style={{ fontSize:'12px', fontWeight:600, color:C.text, marginBottom:'4px' }}>Deliverable #{parseInt(idx) + 1}</div>
                                                <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize:'10px', color:C.primary, textDecoration:'none', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link}</a>
                                              </div>
                                            )) : (
                                              <div style={{ background:C.bg, borderRadius:'8px', padding:'10px', border:`1px solid ${C.border}`, marginBottom:'8px', fontSize:'11px', color:C.textSecondary }}>
                                                Creator submitted deliverables — review pending
                                              </div>
                                            )}
                                            <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
                                              <button
                                                onClick={() => {
                                                  if (brandDealKey) {
                                                    updateDeal(brandDealKey, {
                                                      brandApprovalPhase: 'approved',
                                                      paymentMilestones: { advance: 'released', upload: 'released', approval: 'released' },
                                                      creatorDealLifecycle: 'approved'
                                                    });
                                                    setBrandApprovalPhase('approved');
                                                    firebaseSendNotification('Creator', 'application', `Deliverables approved! Final payment released: $${approvalAmt.toLocaleString()}`);
                                                  }
                                                  setPurchaseToast(`Approved — $${approvalAmt.toLocaleString()} released to creator`);
                                                  setTimeout(() => setPurchaseToast(null), 3500);
                                                }}
                                                style={{ flex:1, background:C.success, border:'none', padding:'9px', borderRadius:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}
                                              >
                                                Approve
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (brandDealKey) {
                                                    firebaseSendNotification('Creator', 'application', 'Brand requested revision — please update your deliverables');
                                                  }
                                                  setPurchaseToast('Revision requested — creator notified');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }}
                                                style={{ flex:1, background:'none', border:`1px solid ${C.border}`, padding:'9px', borderRadius:'8px', color:C.textSecondary, fontWeight:600, cursor:'pointer', fontSize:'12px' }}
                                              >
                                                Request Revision
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      {brandDeal?.brandApprovalPhase === 'approved' && (
                                        <div style={{ marginTop:'12px', padding:'10px', background:'rgba(0,212,106,0.08)', border:`1px solid rgba(0,212,106,0.25)`, borderRadius:'8px', fontSize:'12px', color:C.success, fontWeight:600 }}>
                                          ✅ Deal complete — all payments released
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Phase 4: Counter received — brand reviewing */}
                              {brandDealPhase === 'counter' && (
                                <>
                                  <div style={{ background: 'rgba(230,81,0,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: `1px solid rgba(230,81,0,0.2)` }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary, marginBottom: '6px' }}>Counter-Offer Received</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '22px', fontWeight: 800, color: C.text }}>${agreedDealAmount}</span>
                                      <span style={{ fontSize: '12px', color: C.textMuted }}>/post</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: C.textSecondary }}>
                                      Your offer was ${brandBudget} · difference: +${(parseInt(agreedDealAmount) - parseInt(brandBudget)).toLocaleString()}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '10px', lineHeight: 1.4 }}>Review the counter-offer and choose a response. The creator will be notified once you act.</div>
                                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <button
                                      onClick={() => {
                                        const now = new Date();
                                        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                        const acceptMsg = { id: Date.now(), sender: 'brand' as const, text: `Brand accepted offer: $${parseInt(agreedDealAmount).toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                        const existingMsgs = brandDeal?.chatMessages || [];
                                        if (brandDealKey) {
                                          updateDeal(brandDealKey, {
                                            phase: 'pending',
                                            offerAmount: agreedDealAmount,
                                            counterAmount: '',
                                            brandApprovalPhase: 'accepted',
                                            chatMessages: [...existingMsgs, acceptMsg],
                                          });
                                        }
                                        setBrandApprovalPhase('accepted');
                                        setPurchaseToast('Counter-offer accepted — creator will see your acceptance');
                                        setTimeout(() => setPurchaseToast(null), 3000);
                                      }}
                                      style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Accept ${agreedDealAmount}
                                    </button>
                                    <button
                                      onClick={() => { setBrandCounterAmount(brandBudget); setBrandDealPhase('brand_reviewing'); }}
                                      style={{ flex: 1, background: C.primary, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Counter Again
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        if (brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const lastOfferMsg = { id: Date.now(), sender: 'brand' as const, text: `Final offer: $${parseInt(brandBudget).toLocaleString()}/post — take it or leave it`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, { phase: 'last_offer', chatMessages: [...existingMsgs, lastOfferMsg] });
                                        }
                                      }}
                                      style={{ flex: 1, background: 'none', border: `1px solid ${C.warning}`, padding: '8px', borderRadius: '8px', color: C.warning, fontWeight: 600, cursor: 'pointer', fontSize: '11px' }}
                                    >
                                      This is our last offer
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const rejectMsg = { id: Date.now(), sender: 'brand' as const, text: 'Brand has withdrawn from this deal.', time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, { phase: 'rejected', chatMessages: [...existingMsgs, rejectMsg] });
                                        }
                                        setNegotiatingCreator(null); setBrandBriefTitle(''); setBrandBriefDeliverables(''); setBrandBriefAbout(''); setBrandBriefCampaignDesc('');
                                      }}
                                      style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.4)`, padding: '8px', borderRadius: '8px', color: 'rgba(239,68,68,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '11px' }}
                                    >
                                      Reject creator
                                    </button>
                                  </div>
                                </>
                              )}

                              {/* Phase 4a: Brand sends counter */}
                              {brandDealPhase === 'brand_reviewing' && (
                                <>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>Send your counter</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 800, color: C.text }}>$</span>
                                    <input
                                      type="text"
                                      value={brandCounterAmount}
                                      onChange={(e) => setBrandCounterAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '6px 10px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', outline: 'none', width: '110px' }}
                                      onFocus={(e) => { e.currentTarget.style.borderColor = C.primary; }}
                                      onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                                    />
                                    <span style={{ fontSize: '12px', color: C.textMuted }}>/post</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        if (brandCounterAmount && brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const counterMsg = { id: Date.now(), sender: 'brand' as const, text: `Brand counter-offer: $${parseInt(brandCounterAmount).toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, {
                                            phase: 'pending',
                                            offerAmount: brandCounterAmount,
                                            counterAmount: '',
                                            brandResponseAmount: brandCounterAmount,
                                            chatMessages: [...existingMsgs, counterMsg],
                                          });
                                          setBrandBudget(brandCounterAmount);
                                          setBrandCounterAmount('');
                                        }
                                      }}
                                      style={{ flex: 1, background: brandCounterAmount ? C.primary : C.border, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: brandCounterAmount ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                                    >
                                      Send Counter
                                    </button>
                                    <button onClick={() => setBrandDealPhase('counter')} style={{ background: 'none', border: `1px solid ${C.border}`, padding: '9px 12px', borderRadius: '8px', color: C.textSecondary, cursor: 'pointer', fontSize: '12px' }}>Back</button>
                                  </div>
                                </>
                              )}

                              {/* Phase 4b: Last offer — creator has time to accept or lose deal */}
                              {brandDealPhase === 'last_offer' && (
                                <>
                                  <div style={{ background: 'rgba(230,81,0,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: `1px solid rgba(230,81,0,0.3)` }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.warning, marginBottom: '4px' }}>Last offer sent</div>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '2px' }}>${brandBudget}<span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 400 }}>/post</span></div>
                                    <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.4 }}>
                                      {creator.name} has been notified this is your final offer. If they reject, they are disqualified from this campaign. They have 24h to respond.
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => { setNegotiatingCreator(null); setBrandDealPhase('brief'); setBrandBriefTitle(''); setBrandBriefDeliverables(''); setBrandBriefAbout(''); setBrandBriefCampaignDesc(''); }}
                                    style={{ width: '100%', background: 'none', border: `1px solid ${C.border}`, padding: '8px', borderRadius: '8px', color: C.textSecondary, cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    Withdraw & close
                                  </button>
                                </>
                              )}

                              {/* Phase 4c: Creator submitted formal offer — brand must approve */}
                              {brandDealPhase === 'formal_offer' && (
                                <>
                                  <div style={{ background: 'rgba(0,149,246,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: `1px solid rgba(0,149,246,0.2)` }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.primary, marginBottom: '4px' }}>Creator Submitted Final Offer</div>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '2px' }}>${agreedDealAmount}<span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 400 }}>/post</span></div>
                                    <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.4 }}>
                                      {creator.name} has locked their terms. Review and approve to proceed, or reject to end the negotiation.
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        if (brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const approveMsg = { id: Date.now(), sender: 'brand' as const, text: `Brand approved formal offer at $${parseInt(agreedDealAmount).toLocaleString()}/post. Deal is locked.`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, { phase: 'accepted', brandApprovalPhase: 'accepted', chatMessages: [...existingMsgs, approveMsg] });
                                        }
                                      }}
                                      style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Approve &amp; Lock Deal
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (brandDealKey) {
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const rejectMsg = { id: Date.now(), sender: 'brand' as const, text: 'Brand rejected the formal offer.', time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, { phase: 'rejected', chatMessages: [...existingMsgs, rejectMsg] });
                                        }
                                        setNegotiatingCreator(null);
                                      }}
                                      style={{ flex: 1, background: 'none', border: `1px solid rgba(239,68,68,0.4)`, padding: '9px', borderRadius: '8px', color: 'rgba(239,68,68,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </>
                              )}

                              {/* Phase 5: Accepted */}
                              {brandDealPhase === 'accepted' && (
                                <>
                                  <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal Accepted!</div>
                                    <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '16px' }}>
                                      ${agreedDealAmount}/post · {brandCampaignType}
                                    </div>
                                  </div>

                                  {/* Escrow stages — only for paid/c2c_paid */}
                                  {(dealType === 'paid' || dealType === 'c2c_paid') && (() => {
                                    const totalDeal = parseInt(agreedDealAmount) || 0;
                                    const commission = Math.round(totalDeal * platformCommissionPct / 100);
                                    const creatorPayout = commissionPaidBy === 'brand' ? totalDeal : totalDeal - commission;
                                    const advancePaid = brandDeal?.paymentMilestones?.advance === 'released';
                                    return (
                                      <div style={{ marginBottom: '12px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Payment Breakdown</div>
                                        {/* Total + commission summary */}
                                        <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'rgba(0,149,246,0.04)', borderRadius:'6px', marginBottom:'6px', border:`1px solid rgba(0,149,246,0.15)` }}>
                                          <div>
                                            <div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>Agreed Amount</div>
                                            <div style={{ fontSize:'10px', color:C.textMuted }}>Platform fee: {platformCommissionPct}% (${commission.toLocaleString()}) {commissionPaidBy === 'brand' ? '— paid by brand' : '— deducted from creator'}</div>
                                          </div>
                                          <div style={{ textAlign:'right' }}>
                                            <div style={{ fontSize:'14px', fontWeight:800, color:C.text }}>${commissionPaidBy === 'brand' ? (totalDeal + commission).toLocaleString() : totalDeal.toLocaleString()}</div>
                                            <div style={{ fontSize:'10px', color:C.success }}>Creator gets ${creatorPayout.toLocaleString()}</div>
                                          </div>
                                        </div>
                                        {/* Milestone stages */}
                                        {[
                                          { stage: 'Advance', pct: 30, status: advancePaid ? 'Paid to creator' : brandApprovalPhase === 'accepted' ? 'Awaiting escrow deposit' : 'Held in escrow', released: advancePaid },
                                          { stage: 'Milestone', pct: 40, status: brandDeal?.paymentMilestones?.upload === 'released' ? 'Paid to creator' : 'Released on content delivery', released: brandDeal?.paymentMilestones?.upload === 'released' },
                                          { stage: 'Completion', pct: 30, status: brandDeal?.paymentMilestones?.approval === 'released' ? 'Paid to creator' : 'Released on your approval', released: brandDeal?.paymentMilestones?.approval === 'released' },
                                        ].map((s, si) => (
                                          <div key={si} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: s.released ? 'rgba(46,125,50,0.04)' : C.bg, borderRadius: '6px', marginBottom: '4px', border: `1px solid ${s.released ? 'rgba(46,125,50,0.2)' : C.border}` }}>
                                            <div>
                                              <div style={{ fontSize: '12px', fontWeight: 600, color: s.released ? C.success : C.text }}>{s.stage} ({s.pct}%)</div>
                                              <div style={{ fontSize: '10px', color: s.released ? C.success : C.textMuted }}>{s.status}</div>
                                            </div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: s.released ? C.success : C.text }}>
                                              ${Math.round(creatorPayout * s.pct / 100).toLocaleString()}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}

                                  {brandApprovalPhase === 'accepted' && (() => {
                                    // Show script approval for c2c_collab before moving to funding
                                    if (dealType === 'c2c_collab' && !brandScriptApproved) {
                                      return (
                                        <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '12px', marginBottom: '12px' }}>
                                          <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Review Script</div>
                                          <div style={{ background: C.surfaceAlt, borderRadius: '6px', padding: '10px', marginBottom: '10px', maxHeight: '120px', overflowY: 'auto', fontSize: '10px', color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                            {scriptDraft || 'No script provided yet. Initiator will submit their creative direction.'}
                                          </div>
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            {!brandScriptApproved ? (
                                              <button
                                                onClick={() => {
                                                  if (brandDealKey) {
                                                    updateDeal(brandDealKey, { brandScriptApproved: true });
                                                  }
                                                  setPurchaseToast('Script approved — creator can now proceed');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }}
                                                style={{ flex: 1, background: C.primary, border: 'none', borderRadius: '6px', padding: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '11px' }}
                                              >
                                                Approve Script
                                              </button>
                                            ) : (
                                              <div style={{ flex: 1, background: 'rgba(0,212,106,0.08)', border: `1px solid rgba(0,212,106,0.2)`, borderRadius: '6px', padding: '8px', color: C.success, fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
                                                ✓ Approved
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    switch(dealType) {
                                      case 'paid':
                                      case 'c2c_paid':
                                        if (brandDeal?.phase === 'accepted') {
                                          const briefText = `${brandBriefAbout || ''} ${brandBriefCampaignDesc || ''} ${brandBriefDeliverables || ''}`;
                                          const hasSensitiveContent = isSensitiveContent(briefText) || isSensitiveContent(brandBriefTitle);
                                          return (
                                            <>
                                              {hasSensitiveContent && (
                                                <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>⚠️ Verify Disclaimer Compliance</div>
                                                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                                                    This campaign involves regulated topics. <strong>Ensure the creator includes clear disclaimers</strong> in their content (e.g., "personal opinion," "consult a professional"). Review <a href="/terms" style={{ color: C.primary, textDecoration: 'underline' }}>Terms &amp; Conditions</a> for full guidelines.
                                                  </div>
                                                </div>
                                              )}
                                              <button
                                                onClick={() => setBrandApprovalPhase('funding')}
                                                style={{ width: '100%', background: C.primary, border: 'none', padding: '9px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                              >
                                                Fund Escrow to Begin
                                              </button>
                                            </>
                                          );
                                        }
                                        return (
                                          <div style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, padding: '9px', borderRadius: '8px', color: C.textMuted, fontWeight: 600, textAlign: 'center', fontSize: '13px' }}>
                                            Waiting for creator to accept offer
                                          </div>
                                        );
                                      case 'barter':
                                        return (
                                          <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px' }}>
                                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Prepare Product Shipment</div>
                                            <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'10px' }}>Enter tracking information when you ship the product</div>
                                            <input
                                              type="text"
                                              value={goodsTrackingInput}
                                              onChange={e => setGoodsTrackingInput(e.target.value)}
                                              placeholder="Tracking number (e.g., 1Z999AA1012345678)"
                                              style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', color:C.text, padding:'8px 10px', fontSize:'11px', fontFamily:'inherit', outline:'none', marginBottom:'10px', boxSizing:'border-box' }}
                                            />
                                            {activeDeal?.isInternationalDeal && (
                                              <label style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'10px', cursor:'pointer' }}>
                                                <input
                                                  type="checkbox"
                                                  checked={intlCustomsAcknowledged}
                                                  onChange={e => setIntlCustomsAcknowledged(e.target.checked)}
                                                  style={{ marginTop:'3px', cursor:'pointer' }}
                                                />
                                                <span style={{ fontSize:'11px', color:C.textSecondary, lineHeight:1.4 }}>I confirm this shipment complies with applicable customs and import regulations for the creator's country.</span>
                                              </label>
                                            )}
                                            <button
                                              disabled={!goodsTrackingInput || (activeDeal?.isInternationalDeal && !intlCustomsAcknowledged)}
                                              onClick={() => {
                                                setGoodsTrackerStatus('goods_shipped');
                                                if (brandDealKey) {
                                                  updateDeal(brandDealKey, { goodsTrackerStatus: 'goods_shipped', goodsTrackingNumber: goodsTrackingInput, customsComplianceAcknowledged: intlCustomsAcknowledged });
                                                }
                                                setBrandApprovalPhase('funding');
                                                setPurchaseToast('Shipment marked as sent');
                                                setTimeout(() => setPurchaseToast(null), 3000);
                                              }}
                                              style={{ width:'100%', background: goodsTrackingInput && (!activeDeal?.isInternationalDeal || intlCustomsAcknowledged) ? C.primary : C.border, border:'none', borderRadius:'6px', padding:'8px', color:'#fff', fontWeight:600, cursor: goodsTrackingInput && (!activeDeal?.isInternationalDeal || intlCustomsAcknowledged) ? 'pointer' : 'not-allowed', opacity: goodsTrackingInput && (!activeDeal?.isInternationalDeal || intlCustomsAcknowledged) ? 1 : 0.5, fontSize:'11px' }}
                                            >
                                              Mark as Shipped
                                            </button>
                                          </div>
                                        );
                                      case 'c2c_collab':
                                        return (
                                          <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', textAlign:'center' }}>
                                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Waiting for Content</div>
                                            <div style={{ fontSize:'11px', color:C.textSecondary }}>The initiator is creating your collaborative content. You'll approve it when they submit.</div>
                                          </div>
                                        );
                                      default:
                                        return null;
                                    }
                                  })()}
                                  {(dealType === 'paid' || dealType === 'c2c_paid') && brandApprovalPhase === 'funding' && (() => {
                                    const totalAmount = parseInt(agreedDealAmount) || 5000;
                                    const originalOffer = parseInt(brandDeal?.offerAmount || brandBudget || '0') || 0;
                                    const alreadyInEscrow = brandDeal?.escrowFunded ? originalOffer : 0;
                                    const additionalNeeded = Math.max(0, totalAmount - alreadyInEscrow);
                                    const commission = Math.round(additionalNeeded * platformCommissionPct / 100);
                                    const additionalDeposit = commissionPaidBy === 'brand' ? additionalNeeded + commission : additionalNeeded;
                                    const creatorPayout = commissionPaidBy === 'brand' ? totalAmount : totalAmount - Math.round(totalAmount * platformCommissionPct / 100);
                                    const advanceToCreator = Math.round(creatorPayout * 0.3);
                                    const isTopUp = alreadyInEscrow > 0 && additionalNeeded > 0;
                                    return (
                                      <div style={{ marginTop:'12px' }}>
                                        <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>Fund Escrow Account</div>
                                        {isTopUp && (
                                          <div style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:'8px', padding:'10px', marginBottom:'10px', fontSize:'11px', color:C.textSecondary, lineHeight:1.5 }}>
                                            <strong style={{ color:'#f59e0b' }}>Counter-offer top-up:</strong> ${alreadyInEscrow.toLocaleString()} already in escrow from original offer. Only the additional <strong style={{ color:C.text }}>${additionalNeeded.toLocaleString()}</strong> is due now.
                                          </div>
                                        )}
                                        <div style={{ background:C.bg, borderRadius:'10px', padding:'14px', border:`1px solid ${C.border}`, marginBottom:'12px' }}>
                                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'10px', lineHeight:1.5 }}>
                                            {isTopUp
                                              ? <>Deposit additional <strong style={{ color:C.text }}>${additionalDeposit.toLocaleString()}</strong> {commissionPaidBy === 'brand' ? `(includes ${platformCommissionPct}% fee: $${commission.toLocaleString()})` : ''}. Total deal: <strong style={{ color:C.success }}>${totalAmount.toLocaleString()}</strong>.</>
                                              : <>Deposit <strong style={{ color:C.text }}>${additionalDeposit.toLocaleString()}</strong> into escrow {commissionPaidBy === 'brand' ? `(includes ${platformCommissionPct}% fee: $${commission.toLocaleString()})` : ''}. Creator receives <strong style={{ color:C.success }}>${creatorPayout.toLocaleString()}</strong>.</>
                                            }
                                          </div>
                                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'6px', padding:'6px 8px', background:'rgba(46,125,50,0.06)', borderRadius:'4px', border:'1px solid rgba(46,125,50,0.15)' }}>
                                            <span style={{ color:C.success, fontWeight:600 }}>Advance (30%)</span>
                                            <span style={{ color:C.success, fontWeight:700 }}>${advanceToCreator.toLocaleString()} — paid to creator immediately</span>
                                          </div>
                                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                                            <span style={{ color:C.textMuted }}>Milestone (40%)</span>
                                            <span style={{ color:C.text, fontWeight:600 }}>${Math.round(creatorPayout * 0.4).toLocaleString()} — on content delivery</span>
                                          </div>
                                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                                            <span style={{ color:C.textMuted }}>Completion (30%)</span>
                                            <span style={{ color:C.text, fontWeight:600 }}>${Math.round(creatorPayout * 0.3).toLocaleString()} — on your approval</span>
                                          </div>
                                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginTop:'6px', padding:'4px 8px', background:'rgba(0,149,246,0.04)', borderRadius:'4px' }}>
                                            <span style={{ color:C.textMuted }}>Platform fee ({platformCommissionPct}%)</span>
                                            <span style={{ color:C.textSecondary, fontWeight:600 }}>${commission.toLocaleString()}</span>
                                          </div>
                                        </div>
                                        <div style={{ background:'rgba(0,102,204,0.06)', border:'1px solid rgba(0,102,204,0.15)', borderRadius:'8px', padding:'10px', marginBottom:'12px', fontSize:'11px', color:C.textSecondary, lineHeight:1.5 }}>
                                          On deposit, the advance (${advanceToCreator.toLocaleString()}) is paid directly to the creator. Remaining funds are held in escrow and released per milestones. Platform fee is deducted automatically.
                                        </div>
                                        <button
                                          onClick={() => {
                                            setBrandApprovalPhase('funded');
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const advanceMsg = { id: Date.now(), sender: 'brand' as const, text: isTopUp ? `Top-up deposited: $${additionalNeeded.toLocaleString()} additional (total escrow: $${totalAmount.toLocaleString()}). Advance of $${advanceToCreator.toLocaleString()} (30%) paid to creator.` : `Escrow funded: $${totalAmount.toLocaleString()} deposited. Advance of $${advanceToCreator.toLocaleString()} (30%) paid to creator. Platform fee: $${commission.toLocaleString()} (${platformCommissionPct}%).`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                            const existingMsgs = brandDeal?.chatMessages || [];
                                            if (brandDealKey) {
                                              updateDeal(brandDealKey, {
                                                escrowFunded: true,
                                                brandApprovalPhase: 'funded',
                                                creatorDealLifecycle: 'deliverables',
                                                paymentMilestones: { advance: 'released', upload: 'pending', approval: 'pending' },
                                                chatMessages: [...existingMsgs, advanceMsg],
                                              });
                                            }
                                            // Notify creator that advance has been paid
                                            firebaseSendNotification(creator.name, 'application', `Advance paid: $${advanceToCreator.toLocaleString()} has been deposited to your account (30% of $${creatorPayout.toLocaleString()} deal)`);
                                            setPurchaseToast(`Escrow funded — $${advanceToCreator.toLocaleString()} advance paid to ${creator.name}`);
                                            setTimeout(() => setPurchaseToast(null), 4000);
                                            setTimeout(() => setBrandApprovalPhase('reviewing'), 2000);
                                          }}
                                          style={{ width:'100%', background:C.success, border:'none', padding:'10px', borderRadius:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'13px' }}
                                        >
                                          {isTopUp ? `Deposit Additional $${additionalDeposit.toLocaleString()}` : `Deposit $${additionalDeposit.toLocaleString()} into Escrow`}
                                        </button>
                                      </div>
                                    );
                                  })()}
                                  {(dealType === 'paid' || dealType === 'c2c_paid') && brandApprovalPhase === 'funded' && (
                                    <div style={{ textAlign:'center', padding:'16px 0' }}>
                                      <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(46,125,50,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                      </div>
                                      <div style={{ fontSize:'14px', fontWeight:700, color:C.success }}>Escrow Funded</div>
                                      <div style={{ fontSize:'12px', color:C.textSecondary, marginTop:'4px' }}>Creator has been notified to begin work</div>
                                    </div>
                                  )}
                                  {dealType === 'barter' && brandApprovalPhase === 'funding' && (
                                    <div style={{ background:'rgba(34,197,94,0.06)', border:`1px solid rgba(34,197,94,0.2)`, borderRadius:'8px', padding:'12px', marginTop:'12px' }}>
                                      <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Shipment Sent</div>
                                      <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Tracking information delivered to creator. Waiting for them to confirm receipt.</div>
                                      <button
                                        onClick={() => {
                                          setGoodsTrackerStatus('goods_shipped');
                                          setBrandApprovalPhase('reviewing');
                                          if (brandDealKey) {
                                            updateDeal(brandDealKey, { goodsTrackerStatus: 'goods_shipped' });
                                          }
                                          setTimeout(() => setPurchaseToast('Creator will confirm receipt'), 2000);
                                        }}
                                        style={{ width:'100%', background:C.success, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'11px' }}
                                      >
                                        Continue to Content Review
                                      </button>
                                    </div>
                                  )}
                                  {dealType === 'c2c_collab' && brandApprovalPhase === 'funding' && (
                                    <div style={{ background:'rgba(59,130,246,0.06)', border:`1px solid rgba(59,130,246,0.2)`, borderRadius:'8px', padding:'12px', marginTop:'12px' }}>
                                      <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Ready for Content</div>
                                      <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Waiting for initiator to submit collaborative content.</div>
                                      <button
                                        onClick={() => {
                                          setBrandApprovalPhase('reviewing');
                                          setTimeout(() => setPurchaseToast('Waiting for content submission'), 2000);
                                        }}
                                        style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'11px' }}
                                      >
                                        Continue
                                      </button>
                                    </div>
                                  )}
                                  {brandApprovalPhase === 'reviewing' && (() => {
                                    // Read deliverable data from the shared deal state (brandDeal) so brand sees what creator submitted
                                    const bdLinks = (brandDeal?.deliverableLinks || {}) as Record<number, string>;
                                    const bdStatuses = (brandDeal?.deliverableStatuses || {}) as Record<number, string>;
                                    const bdLifecycle = brandDeal?.creatorDealLifecycle;

                                    if (dealType === 'paid' || dealType === 'c2c_paid') {
                                      const hasSubmissions = Object.keys(bdLinks).length > 0;
                                      const canApprove = bdLifecycle === 'submitted' || hasSubmissions;
                                      return (
                                        <div style={{ marginTop:'12px' }}>
                                          <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>Review Creator Deliverables</div>
                                          {bdLifecycle === 'submitted' || hasSubmissions ? (
                                            <>
                                              {Object.entries(bdLinks).map(([idx, link]) => (
                                                <div key={idx} style={{ background:C.bg, borderRadius:'8px', padding:'12px', border:`1px solid ${C.border}`, marginBottom:'8px' }}>
                                                  <div style={{ fontSize:'12px', fontWeight:600, color:C.text, marginBottom:'4px' }}>Deliverable #{parseInt(idx) + 1}</div>
                                                  <div style={{ fontSize:'10px', color: bdStatuses[parseInt(idx)] === 'approved' ? C.success : C.primary, marginBottom:'4px' }}>
                                                    {bdStatuses[parseInt(idx)] === 'approved' ? 'Approved' : 'Submitted — awaiting your review'}
                                                  </div>
                                                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize:'10px', color:C.primary, textDecoration:'none', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link}</a>
                                                </div>
                                              ))}
                                              {Object.keys(bdLinks).length === 0 && (
                                                <div style={{ background:C.bg, borderRadius:'8px', padding:'12px', border:`1px solid ${C.border}`, marginBottom:'10px', fontSize:'11px', color:C.textSecondary }}>
                                                  Creator submitted deliverables — review pending
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div style={{ background:'rgba(245,158,11,0.06)', border:`1px solid rgba(245,158,11,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                                              <div style={{ fontSize:'11px', color:'#f59e0b' }}>Creator has not yet submitted deliverables</div>
                                            </div>
                                          )}
                                          <div style={{ display:'flex', gap:'8px' }}>
                                            <button
                                              disabled={!canApprove}
                                              onClick={() => {
                                                const agreedAmt = parseInt(agreedDealAmount || '5000');
                                                const approvalAmt = Math.round(agreedAmt * 0.3);
                                                setBrandApprovalPhase('approved');
                                                if (brandDealKey) {
                                                  updateDeal(brandDealKey, {
                                                    brandApprovalPhase: 'approved',
                                                    paymentMilestones: { advance: 'released', upload: 'released', approval: 'released' },
                                                    creatorDealLifecycle: 'approved'
                                                  });
                                                  firebaseSendNotification('Creator', 'application', `Deliverables approved! Final payment released: $${approvalAmt.toLocaleString()}`);
                                                }
                                                setPurchaseToast(`Approved and deal completed — $${approvalAmt.toLocaleString()} approval payment released to creator`);
                                                setTimeout(() => setPurchaseToast(null), 3500);
                                              }}
                                              style={{ flex:1, background: canApprove ? C.success : C.border, border:'none', padding:'9px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor: canApprove ? 'pointer' : 'not-allowed', fontSize:'13px', opacity: canApprove ? 1 : 0.5 }}
                                            >
                                              Approve
                                            </button>
                                            <button
                                              onClick={() => {
                                                if (brandDealKey) {
                                                  firebaseSendNotification('Creator', 'application', `Brand requested revision — please update your deliverables`);
                                                }
                                                setPurchaseToast('Revision requested — creator notified');
                                                setTimeout(() => setPurchaseToast(null), 3000);
                                              }}
                                              style={{ flex:1, background:'none', border:`1px solid ${C.border}`, padding:'9px', borderRadius:'8px', color:C.textSecondary, fontWeight:600, cursor:'pointer', fontSize:'13px' }}
                                            >
                                              Request Revision
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    } else if (dealType === 'barter' || dealType === 'c2c_collab') {
                                      const contentLink = bdLinks[0] || '';
                                      return (
                                        <div style={{ marginTop:'12px' }}>
                                          <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>Review Content</div>
                                          {contentLink ? (
                                            <div style={{ background:C.bg, borderRadius:'8px', padding:'12px', border:`1px solid ${C.border}`, marginBottom:'10px' }}>
                                              <div style={{ fontSize:'12px', fontWeight:600, color:C.text, marginBottom:'4px' }}>Instagram Post</div>
                                              <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px' }}>Submitted {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                                              <a href={contentLink} target="_blank" rel="noopener noreferrer" style={{ fontSize:'10px', color:C.primary, textDecoration:'none', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'8px' }}>{contentLink}</a>
                                            </div>
                                          ) : (
                                            <div style={{ background:'rgba(239,68,68,0.06)', border:`1px solid rgba(239,68,68,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'10px' }}>
                                              <div style={{ fontSize:'11px', color:'#ef4444' }}>Content not yet submitted</div>
                                            </div>
                                          )}
                                          <div style={{ display:'flex', gap:'8px' }}>
                                            <button
                                              disabled={!contentLink}
                                              onClick={() => {
                                                setBrandApprovalPhase('approved');
                                                if (dealType === 'barter') {
                                                  setGoodsTrackerStatus('content_approved');
                                                  if (brandDealKey) {
                                                    updateDeal(brandDealKey, { goodsTrackerStatus: 'content_approved', brandApprovalPhase: 'approved' });
                                                  }
                                                }
                                                if (dealType === 'c2c_collab') {
                                                  setC2cContentStatus('content_approved');
                                                  if (brandDealKey) {
                                                    updateDeal(brandDealKey, { c2cContentStatus: 'content_approved', brandApprovalPhase: 'approved' });
                                                  }
                                                }
                                                firebaseSendNotification('Creator', 'application', 'Content approved!');
                                                setPurchaseToast('Approved and deal completed');
                                                setTimeout(() => setPurchaseToast(null), 3000);
                                              }}
                                              style={{ flex:1, background: contentLink ? C.success : C.border, border:'none', padding:'9px', borderRadius:'8px', color:'#fff', fontWeight:600, cursor: contentLink ? 'pointer' : 'not-allowed', fontSize:'13px', opacity: contentLink ? 1 : 0.5 }}
                                            >
                                              Approve Content
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {brandApprovalPhase === 'approved' && (
                                    <div style={{ textAlign:'center', padding:'12px 0', marginTop:'12px' }}>
                                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                      </div>
                                      <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Approved and Deal Completed</div>
                                      <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'12px' }}>Payment released: ${parseInt(agreedDealAmount).toLocaleString()}</div>
                                      <button
                                        onClick={() => { if (brandDealKey && brandDeal) downloadDealSummary(brandDealKey, brandDeal); }}
                                        style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'9px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px', marginBottom:'12px' }}
                                      >
                                        Download Legal Deal Summary
                                      </button>
                                      {/* Brand rating for creator */}
                                      {!brandRatingSubmitted ? (
                                        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'12px', textAlign:'left' }}>
                                          <div style={{ fontSize:'11px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Rate this creator</div>
                                          <div style={{ display:'flex', gap:'6px', marginBottom:'10px', justifyContent:'center' }}>
                                            {[1,2,3,4,5].map(star => (
                                              <button key={star} onClick={() => setBrandDealRating(star)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'24px', color: star <= brandDealRating ? '#f59e0b' : C.border, transition:'color 0.1s', padding:'2px' }}>
                                                {star <= brandDealRating ? '\u2605' : '\u2606'}
                                              </button>
                                            ))}
                                          </div>
                                          <textarea value={brandRatingComment} onChange={e => setBrandRatingComment(e.target.value)} placeholder="How was working with this creator?" rows={2} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, resize:'none', boxSizing:'border-box' }} />
                                          <button onClick={() => { setBrandRatingSubmitted(true); if (brandDealKey) { updateDeal(brandDealKey, { brandRating: brandDealRating, brandRatingComment: brandRatingComment, displayBrandRating: false }); } setPurchaseToast('Rating submitted'); setTimeout(() => setPurchaseToast(null), 3000); }} disabled={brandDealRating === 0} style={{ width:'100%', background: brandDealRating > 0 ? C.primary : C.border, border:'none', padding:'8px', borderRadius:'6px', color:'#fff', fontWeight:600, fontSize:'12px', cursor: brandDealRating > 0 ? 'pointer' : 'not-allowed', marginTop:'8px', opacity: brandDealRating > 0 ? 1 : 0.5 }}>
                                            Submit Rating
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ background:'rgba(0,102,204,0.06)', border:`1px solid rgba(0,102,204,0.2)`, borderRadius:'8px', padding:'10px', marginBottom:'12px' }}>
                                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'8px' }}>
                                            Rating submitted: {brandDealRating}/5
                                          </div>
                                          <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:C.text, cursor:'pointer' }}>
                                            <input type="checkbox" checked={displayBrandRating} onChange={e => { setDisplayBrandRating(e.target.checked); if (brandDealKey) { updateDeal(brandDealKey, { displayBrandRating: e.target.checked }); } }} style={{ cursor:'pointer' }} />
                                            Show this review on my brand profile
                                          </label>
                                        </div>
                                      )}
                                      <button onClick={() => { setNegotiatingCreator(null); setBrandDealPhase('brief'); setBrandApprovalPhase('accepted'); setBrandDealRating(0); setBrandRatingComment(''); setBrandRatingSubmitted(false); }} style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'8px', color:'#fff', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>Done</button>
                                    </div>
                                  )}
                                  {/* Deal Room Chat — brand side, shows all messages from shared state */}
                                  {(() => {
                                    const brandChatMsgs = (brandDeal?.chatMessages || []) as Array<{id: number; sender: string; text: string; time: string; isoTime?: string; seen?: boolean}>;
                                    return (
                                      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                                        <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                          Negotiation
                                          {brandChatMsgs.length > 0 && <span style={{ fontSize: '9px', color: C.textMuted, fontWeight: 400 }}>{brandChatMsgs.length} messages</span>}
                                        </div>
                                        {brandChatMsgs.length > 0 && (
                                          <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom:'8px' }}>
                                            {brandChatMsgs.map((msg, mi) => (
                                              <div key={msg.id || mi} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'brand' ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                                                <div style={{ maxWidth: '85%', background: msg.sender === 'brand' ? 'rgba(0,149,246,0.08)' : C.surfaceAlt, borderRadius: '8px', padding: '6px 10px' }}>
                                                  <div style={{ fontSize: '10px', fontWeight: 600, color: msg.sender === 'brand' ? C.primary : C.text, marginBottom: '2px' }}>{msg.sender === 'brand' ? 'You' : creator.name}</div>
                                                  <div style={{ fontSize: '11px', color: C.text, lineHeight: 1.4 }}>{msg.text}</div>
                                                </div>
                                                <div style={{ fontSize: '9px', color: C.textMuted, marginTop: '2px' }}>{msg.time}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {/* Brand chat input — negotiate terms, deliverables, timeline */}
                                        <form onSubmit={(e) => {
                                          e.preventDefault();
                                          if (!brandChatInput.trim() || !brandDealKey) return;
                                          const now = new Date();
                                          const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                          const newMsg = { id: Date.now(), sender: 'brand' as const, text: brandChatInput.trim(), time: timeStr, isoTime: now.toISOString(), seen: false };
                                          const existingMsgs = brandDeal?.chatMessages || [];
                                          updateDeal(brandDealKey, { chatMessages: [...existingMsgs, newMsg] });
                                          setBrandChatInput('');
                                        }} style={{ display: 'flex', gap: '4px' }}>
                                          <input
                                            type="text"
                                            value={brandChatInput}
                                            onChange={(e) => setBrandChatInput(e.target.value)}
                                            placeholder="Negotiate terms, deliverables, timeline..."
                                            style={{ flex: 1, padding: '6px 10px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '14px', color: C.text, fontSize: '11px', outline: 'none' }}
                                          />
                                          <button type="submit" disabled={!brandChatInput.trim()} style={{ padding: '6px 12px', background: brandChatInput.trim() ? C.primary : `${C.primary}40`, color: '#fff', border: 'none', borderRadius: '14px', fontSize: '10px', fontWeight: 600, cursor: brandChatInput.trim() ? 'pointer' : 'not-allowed' }}>Send</button>
                                        </form>
                                      </div>
                                    );
                                  })()}
                                  {/* POC Contact Card — brand side, visible at all brand deal phases */}
                                  {brandDeal?.poc && (
                                    <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                          <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{brandDeal.poc.name}</div>
                                          <div style={{ fontSize: '11px', color: C.primary, marginTop: '1px' }}>{brandDeal.poc.contactHandle}</div>
                                          {brandDeal.poc.role && <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '1px' }}>{brandDeal.poc.role}</div>}
                                        </div>
                                        <button
                                          onClick={() => {
                                            const pocHandle = brandDeal.poc?.contactHandle?.replace('@', '') || '';
                                            if (pocHandle) {
                                              window.open(`https://portfolio.valueskins.com/${pocHandle}`, '_blank');
                                            }
                                            setPurchaseToast(`Opening ${brandDeal.poc?.name || 'POC'}'s profile`);
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ background: C.primary, border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                                        >
                                          Message
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                          {/* Similar Creators */}
                          {campaigns.length > 0 && adminShowSimilarCreators && results.length > 0 && (
                            <div style={{ marginTop: '8px', padding: '12px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Similar Creators</div>
                              <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '8px' }}>Based on your most-viewed creator this session:</div>
                              {BRAND_MARKETPLACE_CREATORS.filter((_, idx) => idx !== 0).slice(0, 2).map((c, si) => {
                                const b = PROFESSION_BADGES[c.valueSkin];
                                return (
                                  <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderTop: si > 0 ? `1px solid ${C.border}` : 'none' }}>
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name.replace(/\s/g,'')}`} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.surfaceAlt }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{c.name}</div>
                                      <div style={{ fontSize: '10px', color: C.textSecondary }}>{c.valueSkin} · {c.followers} · {c.engagement}</div>
                                    </div>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: b?.color ?? C.primary, background: `${b?.color ?? C.primary}15`, padding: '2px 6px', borderRadius: '6px' }}>{c.matchScore}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    </>)}
                    </>)}

                    {/* Campaign tabs: Your Campaigns — collapsible, does NOT hide the creator list */}
                    <div style={{ marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
                      <button
                        onClick={() => setCampaignsSectionOpen(v => !v)}
                        style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'0 0 14px', cursor:'pointer' }}
                      >
                        <span style={{ fontSize:'12px', fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.5px', display:'flex', alignItems:'center', gap:'6px' }}>
                          Your Campaigns
                          {campaigns.length > 0 && <span style={{ fontSize:'10px', background:C.primary, color:'#fff', padding:'1px 5px', borderRadius:'8px' }}>{campaigns.length}</span>}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" style={{ transform: campaignsSectionOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>

                      {campaignsSectionOpen && (<>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          {campaigns.length > 0 && (() => {
                            const hasActiveDealCreators = campaigns.some(camp => {
                              const applicants = sharedApplications.filter(a => a.campaignId === camp.id && a.status !== 'invited');
                              return applicants.some(app => {
                                // Find any deal associated with this creator and campaign
                                const creatorDeal = Object.entries(dealStates).find(([key, deal]) => {
                                  return deal?.creatorName === app.creatorName && deal?.escrowFunded && ['deliverables', 'submitted', 'approved'].includes(deal?.creatorDealLifecycle || '');
                                });
                                return !!creatorDeal;
                              });
                            });
                            return (
                              <button
                                disabled={hasActiveDealCreators}
                                onClick={() => { persistCampaigns([]); setSharedApplications([]); setDealStates({}); }}
                                title={hasActiveDealCreators ? 'Cannot delete campaigns with active creator work in progress' : ''}
                                style={{ background:'none', border:`1px solid rgba(239,68,68,0.3)`, borderRadius:'6px', padding:'5px 10px', fontSize:'11px', fontWeight:600, color: hasActiveDealCreators ? '#888' : '#ef4444', cursor: hasActiveDealCreators ? 'not-allowed' : 'pointer', opacity: hasActiveDealCreators ? 0.5 : 1 }}
                              >
                                Clear all
                              </button>
                            );
                          })()}
                          <button onClick={() => setShowCampaignCreator(true)} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:700, color:'#fff', cursor:'pointer', marginLeft:'auto' }}>+ New Campaign</button>
                        </div>
                        {(() => {
                          const activeDealCampaigns = campaigns.filter(camp => {
                            const applicants = sharedApplications.filter(a => a.campaignId === camp.id && a.status !== 'invited');
                            return applicants.some(app => {
                              // Find any deal associated with this creator and campaign
                              const creatorDeal = Object.entries(dealStates).find(([key, deal]) => {
                                return deal?.creatorName === app.creatorName && deal?.escrowFunded && ['deliverables', 'submitted', 'approved'].includes(deal?.creatorDealLifecycle || '');
                              });
                              return !!creatorDeal;
                            });
                          });
                          return activeDealCampaigns.length > 0 ? (
                            <div style={{ background: 'rgba(237,73,86,0.08)', border: `1px solid rgba(237,73,86,0.25)`, borderRadius:'8px', padding:'10px 12px', marginBottom:'12px', fontSize:'11px', color: C.danger, fontWeight:600 }}>
                              ⚠️ {activeDealCampaigns.length} campaign{activeDealCampaigns.length !== 1 ? 's have' : ' has'} creators actively working. You cannot delete campaigns with ongoing deals. Complete or cancel work first.
                            </div>
                          ) : null;
                        })()}
                        {(() => {
                          const activeCampaigns = liveCampaigns.filter(c => c.status !== 'expired');
                          return activeCampaigns.length === 0 ? (
                            <div style={{ textAlign:'center', padding:'24px 20px', color:C.textMuted }}>
                              <div style={{ fontSize:'13px', marginBottom:'4px' }}>No campaigns yet</div>
                              <div style={{ fontSize:'11px' }}>Create a campaign to start receiving creator applications.</div>
                            </div>
                          ) : activeCampaigns.map((c,i) => (
                          <div key={i} style={{ background:C.card, borderRadius:'12px', padding:'14px', marginBottom:'10px', border:`1px solid ${C.border}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', flexWrap:'wrap', gap:'4px' }}>
                              <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{c.title}</span>
                              <span style={{ fontSize:'12px', fontWeight:700, color:C.success }}>${parseInt(c.budget||'0').toLocaleString()}</span>
                            </div>
                            {c.brandName && <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'4px' }}>by {c.brandName}</div>}
                            <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px', lineHeight:1.4 }}>{c.description}</div>
                            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'6px' }}>
                              {c.requiredProfessions.map(p => <span key={p} style={{ fontSize:'10px', fontWeight:600, color:C.primary, background:`${C.primary}12`, padding:'2px 7px', borderRadius:'6px', border:`1px solid ${C.primary}30` }}>{p}</span>)}
                            </div>
                            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'10px', color:C.textMuted, marginBottom: c.nonNegotiables?.length ? '6px':'8px' }}>
                              <span>Level: L{c.minLevel||1}{(c.maxLevel && c.maxLevel !== c.minLevel) ? `–L${c.maxLevel}` : ''}</span>
                              {c.location && <span>{c.location}</span>}
                              {c.deliverables && <span>{c.deliverables}</span>}
                            </div>
                            {c.nonNegotiables && c.nonNegotiables.length > 0 && (
                              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
                                {c.nonNegotiables.map(n=><span key={n} style={{ fontSize:'10px', color:C.textMuted, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', padding:'2px 7px', borderRadius:'6px' }}>{n}</span>)}
                              </div>
                            )}
                            {(c.creatorCount || c.escrowPool) && (
                              <div style={{ display:'flex', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                                {c.creatorCount && <span style={{ fontSize:'10px', color:C.textSecondary, background:C.surfaceAlt, padding:'2px 8px', borderRadius:'6px' }}>Hiring {c.creatorCount} creator{c.creatorCount!==1?'s':''}</span>}
                                {c.escrowPool && (
                                  <span style={{ fontSize:'10px', fontWeight:700, color: c.escrowFunded ? C.success : C.warning, background: c.escrowFunded ? 'rgba(0,212,106,0.08)' : 'rgba(255,171,0,0.08)', border: `1px solid ${c.escrowFunded ? 'rgba(0,212,106,0.25)' : 'rgba(255,171,0,0.25)'}`, padding:'2px 8px', borderRadius:'6px', display:'flex', alignItems:'center', gap:'4px' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    {c.escrowFunded ? `$${c.escrowPool.toLocaleString()} in escrow` : `$${c.escrowPool.toLocaleString()} escrow pending`}
                                  </span>
                                )}
                              </div>
                            )}
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:'10px', color:C.textMuted }}>{c.deadline?`Deadline ${c.deadline}`:''}</span>
                              <span style={{ fontSize:'10px', fontWeight:700, color:c.status==='expired'?C.textMuted:c.status==='open'?C.success:'#888', background:c.status==='expired'?'rgba(239,68,68,0.1)':c.status==='open'?C.surfaceAlt:'rgba(136,136,136,0.1)', padding:'2px 8px', borderRadius:'6px', textTransform:'uppercase' }}>{c.status}</span>
                            </div>
                          </div>
                        ))
                        })()}
                      </>)}
                    </div>

                    {/* Past Campaigns — expired campaigns */}
                    {(() => {
                      const expiredCampaigns = liveCampaigns.filter(c => c.status === 'expired');
                      return expiredCampaigns.length > 0 ? (
                        <div style={{ marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
                          <button
                            onClick={() => setCampaignsSectionOpen(v => !v)}
                            style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'0 0 14px', cursor:'pointer' }}
                          >
                            <span style={{ fontSize:'12px', fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.5px', display:'flex', alignItems:'center', gap:'6px' }}>
                              Past Campaigns
                              {expiredCampaigns.length > 0 && <span style={{ fontSize:'10px', background:C.textMuted, color:'#fff', padding:'1px 5px', borderRadius:'8px' }}>{expiredCampaigns.length}</span>}
                            </span>
                          </button>
                          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginTop:'10px' }}>
                            {expiredCampaigns.map((c,i) => (
                              <div key={i} style={{ background:C.card, borderRadius:'12px', padding:'14px', marginBottom:'10px', border:`1px solid ${C.border}`, opacity:0.7 }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', flexWrap:'wrap', gap:'4px' }}>
                                  <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{c.title}</span>
                                  <span style={{ fontSize:'12px', fontWeight:700, color:C.success }}>${parseInt(c.budget||'0').toLocaleString()}</span>
                                </div>
                                {c.brandName && <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'4px' }}>by {c.brandName}</div>}
                                <div style={{ fontSize:'11px', color:C.textSecondary, marginBottom:'8px', lineHeight:1.4 }}>{c.description}</div>
                                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'6px' }}>
                                  {c.requiredProfessions.map(p => <span key={p} style={{ fontSize:'10px', fontWeight:600, color:C.primary, background:`${C.primary}12`, padding:'2px 7px', borderRadius:'6px', border:`1px solid ${C.primary}30` }}>{p}</span>)}
                                </div>
                                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'10px', color:C.textMuted, marginBottom: c.nonNegotiables?.length ? '6px':'8px' }}>
                                  <span>Level: L{c.minLevel||1}{(c.maxLevel && c.maxLevel !== c.minLevel) ? `–L${c.maxLevel}` : ''}</span>
                                  {c.location && <span>{c.location}</span>}
                                  {c.deliverables && <span>{c.deliverables}</span>}
                                </div>
                                {c.nonNegotiables && c.nonNegotiables.length > 0 && (
                                  <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
                                    {c.nonNegotiables.map(n=><span key={n} style={{ fontSize:'10px', color:C.textMuted, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', padding:'2px 7px', borderRadius:'6px' }}>{n}</span>)}
                                  </div>
                                )}
                                {(c.creatorCount || c.escrowPool) && (
                                  <div style={{ display:'flex', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                                    {c.creatorCount && <span style={{ fontSize:'10px', color:C.textSecondary, background:C.surfaceAlt, padding:'2px 8px', borderRadius:'6px' }}>Hired {c.creatorCount} creator{c.creatorCount!==1?'s':''}</span>}
                                    {c.escrowPool && (
                                      <span style={{ fontSize:'10px', fontWeight:700, color: c.escrowFunded ? C.success : C.warning, background: c.escrowFunded ? 'rgba(0,212,106,0.08)' : 'rgba(255,171,0,0.08)', border: `1px solid ${c.escrowFunded ? 'rgba(0,212,106,0.25)' : 'rgba(255,171,0,0.25)'}`, padding:'2px 8px', borderRadius:'6px', display:'flex', alignItems:'center', gap:'4px' }}>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        {c.escrowFunded ? `$${c.escrowPool.toLocaleString()} in escrow` : `$${c.escrowPool.toLocaleString()} escrow pending`}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                  <span style={{ fontSize:'10px', color:C.textMuted }}>{c.deadline?`Expired ${c.deadline}`:''}</span>
                                  <span style={{ fontSize:'10px', fontWeight:700, color:C.textMuted, background:'rgba(239,68,68,0.1)', padding:'2px 8px', borderRadius:'6px', textTransform:'uppercase' }}>Expired</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Applications Received */}
                    <div style={{ marginTop:'16px' }}>
                      <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'14px' }}>Applicants</div>
                      {sharedApplications.filter(a => a.status !== 'invited').length === 0 ? (
                        <div style={{ textAlign:'center', padding:'24px 20px', color:C.textMuted }}>
                          <div style={{ fontSize:'13px', marginBottom:'4px' }}>No proposals yet</div>
                          <div style={{ fontSize:'11px' }}>Creators will appear here once they enter negotiations or apply to campaigns.</div>
                        </div>
                      ) : sharedApplications.filter(a => a.status !== 'invited').slice(0, 15).map((app,i) => {
                        const camp = campaigns.find(c=>c.id===app.campaignId);
                        const displayName = app.creatorName || app.creatorHandle;
                        const igUrl = app.creatorWebsiteUrl || `https://portfolio.valueskins.com/${app.creatorHandle.replace('@', '')}`;
                        const allApps = sharedApplications.filter(a => a.status !== 'invited');
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 0', borderBottom: i < Math.min(15, allApps.length) - 1 ? `1px solid ${C.border}` : 'none' }}>
                            {/* Avatar */}
                            <a href={igUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                              <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName.replace(/[\s@]/g, '')}`}
                                alt={displayName}
                                style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.card }}
                              />
                            </a>
                            {/* Compact Info */}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{displayName}</span>
                                {app.creatorLevel && (
                                  <span style={{ fontSize:'9px', fontWeight:700, color:'#fff', background:app.creatorLevel>=4?C.primary:app.creatorLevel>=2?C.warning:C.textMuted, padding:'1px 5px', borderRadius:'3px' }}>Lv{app.creatorLevel}</span>
                                )}
                                {(() => {
                                  const creatorData = BRAND_MARKETPLACE_CREATORS.find(c => c.handle === app.creatorHandle || c.name === app.creatorName);
                                  // Use opportunityIndex from application (set when campaign was sent)
                                  const oppIdx = app.opportunityIndex ?? 0;
                                  const dealKey = creatorData ? `${creatorData.name}|${creatorData.valueSkin}|${oppIdx}` : null;
                                  const deal = dealKey ? getOrCreateDeal(dealKey) : null;
                                  return deal?.phase === 'counter' ? (
                                    <span style={{ fontSize:'8px', fontWeight:700, color:'#fff', background:C.warning, padding:'2px 6px', borderRadius:'4px', textTransform:'uppercase' }}>Counter waiting</span>
                                  ) : null;
                                })()}
                              </div>
                              <div style={{ fontSize:'11px', color:C.textSecondary, display:'flex', alignItems:'center', gap:'6px' }}>
                                {app.creatorHandle}
                                {app.creatorMatchScore && <span style={{ color:C.primary, fontWeight:600 }}>· {app.creatorMatchScore}</span>}
                              </div>
                            </div>
                            {/* Action */}
                            <div style={{ flexShrink:0, display:'flex', gap:'6px' }}>
                              {app.status === 'pending' ? (
                                <button onClick={() => { persistApplications(sharedApplications.map(a=>a.id===app.id?{...a,status:'accepted' as const}:a)); setPurchaseToast('Accepted'); setTimeout(()=>setPurchaseToast(null),3000); }} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'11px', fontWeight:600, color:'#fff', cursor:'pointer' }}>Accept</button>
                              ) : (
                                <>
                                  <span style={{ fontSize:'10px', fontWeight:600, color:app.status==='accepted'?C.success:C.textMuted, textTransform:'uppercase' }}>{app.status}</span>
                                  {app.status === 'accepted' && (() => {
                                    const creatorData = BRAND_MARKETPLACE_CREATORS.find(c => c.handle === app.creatorHandle || c.name === app.creatorName);
                                    return creatorData ? (
                                      <button onClick={() => { setNegotiatingCreator(BRAND_MARKETPLACE_CREATORS.indexOf(creatorData)); setBrandCurrentOppIndex(app.opportunityIndex ?? 0); }} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'4px 10px', fontSize:'10px', fontWeight:600, color:'#fff', cursor:'pointer' }}>Deal Room</button>
                                    ) : null;
                                  })()}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {sharedApplications.filter(a => a.status !== 'invited').length > 15 && (
                        <div style={{ textAlign:'center', padding:'12px 0', borderTop:`1px solid ${C.border}` }}>
                          <button style={{ background:'none', border:'none', color:C.primary, fontSize:'12px', fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>View more ({sharedApplications.filter(a => a.status !== 'invited').length - 15})</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {/* Past Deals section */}
              <div style={{ marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
                  <span style={{ fontSize:'12px', fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.5px' }}>Past Deals</span>
                  <span style={{ fontSize:'10px', background:C.primary, color:'#fff', padding:'2px 6px', borderRadius:'8px' }}>
                    {Object.values(dealStates).filter(d => d.brandApprovalPhase === 'approved' || d.creatorDealLifecycle === 'approved').length}
                  </span>
                </div>
                {(() => {
                  const completedDeals = Object.entries(dealStates).filter(([_, d]) => d.brandApprovalPhase === 'approved' || d.creatorDealLifecycle === 'approved').map(([key, deal]) => ({key, ...deal}));
                  if (completedDeals.length === 0) {
                    return <div style={{ fontSize:'12px', color:C.textSecondary, padding:'16px', textAlign:'center' }}>No completed deals yet</div>;
                  }
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {completedDeals.map((deal) => {
                        const [creatorName, skinName] = deal.key.split('|');
                        const dealAmount = deal.agreementAmount || deal.offerAmount || '0';
                        const creatorRating = deal.creatorRating || 0;
                        const brandRating = deal.brandRating || 0;
                        const completedDate = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                        return (
                          <div key={deal.key} style={{ background:C.card, borderRadius:'8px', padding:'12px', border:`1px solid ${C.border}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'8px' }}>
                              <div>
                                <div style={{ fontSize:'13px', fontWeight:600, color:C.text, marginBottom:'2px' }}>{creatorName} × {skinName}</div>
                                <div style={{ fontSize:'11px', color:C.textSecondary }}>{deal.type || 'Deal'} · {completedDate}</div>
                              </div>
                              <div style={{ fontSize:'13px', fontWeight:700, color:C.success }}>${parseInt(dealAmount).toLocaleString()}</div>
                            </div>
                            {(creatorRating > 0 || brandRating > 0) && (
                              <div style={{ display:'flex', gap:'16px', fontSize:'11px', color:C.textSecondary, paddingTop:'8px', borderTop:`1px solid ${C.border}` }}>
                                {creatorRating > 0 && <span>Creator rated: {'★'.repeat(creatorRating)}</span>}
                                {brandRating > 0 && <span>Brand rated: {'★'.repeat(brandRating)}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ── MESSAGES VIEW — DMs + Communities (skin-gated DMs) ── */}
          {activeView === 'messages' && (
            <>
              {activeCommunity === null && activeDmId === null ? (
                <>
                  {/* Header */}
                  <div style={{ height: '52px', display: 'flex', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Messages</span>
                  </div>

                  {/* Filter tabs — DMs | Communities */}
                  <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                    {(['dms', 'communities'] as const).map(tab => (
                      <button key={tab} onClick={() => setMessagesTab(tab)}
                        style={{ flex: 1, padding: '12px 0', fontSize: '13px', fontWeight: messagesTab === tab ? 700 : 500,
                          color: messagesTab === tab ? C.text : C.textMuted, background: 'none', border: 'none',
                          borderBottom: messagesTab === tab ? `2px solid ${C.primary}` : '2px solid transparent',
                          cursor: 'pointer', transition: 'all 0.15s' }}>
                        {tab === 'dms' ? 'DMs' : 'Communities'}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: '0' }}>
                    {/* DMs tab — fake Instagram-style DMs */}
                    {messagesTab === 'dms' && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {[
                          { id: 1, name: 'Alex Rivera', handle: '@alex_codes', avatar: 'AR', lastMsg: 'Hey, saw your latest post. Really cool work on the API design!', time: '2m', unread: true, online: true },
                          { id: 2, name: 'Priya Singh', handle: '@priya_builds', avatar: 'PS', lastMsg: 'Thanks for the referral! Got the interview.', time: '15m', unread: true, online: false },
                          { id: 3, name: 'Marcus Tran', handle: '@ml_marcus', avatar: 'MT', lastMsg: 'Sent you the architecture diagram', time: '1h', unread: false, online: true },
                          { id: 4, name: 'Sarah Kim', handle: '@sarahk_data', avatar: 'SK', lastMsg: 'Can we sync on the dataset tomorrow?', time: '3h', unread: false, online: false },
                          { id: 5, name: 'Jordan Blake', handle: '@jblake_ops', avatar: 'JB', lastMsg: 'Pipeline is green now. Pushed the fix.', time: '5h', unread: false, online: false },
                          { id: 6, name: 'Elena Rodriguez', handle: '@elena_cooks', avatar: 'ER', lastMsg: 'Recipe collab sounds great, let me know the details', time: '1d', unread: false, online: false },
                          { id: 7, name: 'Tommy Nguyen', handle: '@tommy_ai', avatar: 'TN', lastMsg: 'Check out this paper on multimodal embeddings', time: '2d', unread: false, online: true },
                        ].map(dm => (
                          <div key={dm.id} onClick={() => setActiveDmId(dm.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', transition: 'background 0.12s', borderBottom: `1px solid ${C.border}` }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <div style={{ position: 'relative' }}>
                              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: C.textMuted, border: `1px solid ${C.border}` }}>
                                {dm.avatar}
                              </div>
                              {dm.online && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '12px', height: '12px', borderRadius: '50%', background: C.success, border: `2px solid ${C.bg}` }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                <span style={{ fontSize: '14px', fontWeight: dm.unread ? 700 : 500, color: C.text }}>{dm.name}</span>
                                <span style={{ fontSize: '11px', color: dm.unread ? C.primary : C.textMuted }}>{dm.time}</span>
                              </div>
                              <div style={{ fontSize: '13px', color: dm.unread ? C.text : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: dm.unread ? 500 : 400 }}>
                                {dm.lastMsg}
                              </div>
                            </div>
                            {dm.unread && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.primary, flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Communities tab — skin-gated group DMs */}
                    {messagesTab === 'communities' && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Create community button */}
                        {hasValueSkin && messagesTab === 'communities' && (
                          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                            <button onClick={() => setMessagesTab('create')}
                              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px dashed ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; }}>
                              + New Community
                            </button>
                          </div>
                        )}
                        {(() => {
                          const userProfessions = Object.values(valueSkins).filter(Boolean).map(s => s!.profession);
                          const matchedChannels = CHANNELS.filter(ch =>
                            ch.gateType === 'any_valueskin' ? hasValueSkin :
                            ch.allowedProfessions.some(p => userProfessions.includes(p))
                          );
                          if (!hasValueSkin) return (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                              <div style={{ fontSize: '13px', marginBottom: '6px' }}>Get a ValueSkin to join communities</div>
                              <div style={{ fontSize: '11px', marginBottom: '12px' }}>Communities are DMs with a ValueSkin as the entry barrier</div>
                              <button onClick={() => setActiveView('store')} style={{ background: C.primary, border: 'none', borderRadius: '8px', color: '#fff', padding: '8px 20px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>Go to Store</button>
                            </div>
                          );
                          if (matchedChannels.length === 0) return (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                              <div style={{ fontSize: '13px', marginBottom: '6px' }}>No communities match your ValueSkins yet</div>
                              <div style={{ fontSize: '11px' }}>Communities for {userProfessions.join(', ')} will appear here</div>
                            </div>
                          );
                          return matchedChannels.map(ch => {
                            const joined = joinedCommunities.includes(ch.id);
                            return (
                              <div key={ch.id} onClick={() => { if (joined) setActiveCommunity(ch.id); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: joined ? 'pointer' : 'default', transition: 'background 0.12s', borderBottom: `1px solid ${C.border}` }}
                                onMouseEnter={e => { if (joined) e.currentTarget.style.background = C.surfaceAlt; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: ch.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '12px' }}>
                                  {ch.avatarAbbr}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{ch.name}</span>
                                    <span style={{ fontSize: '9px', fontWeight: 600, color: C.primary, background: `${C.primary}12`, padding: '1px 5px', borderRadius: '4px' }}>
                                      {ch.requiredSkin || 'Any Skin'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '13px', color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ch.lastMessage.author}: {ch.lastMessage.text}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '11px', color: C.textMuted }}>{ch.lastMessage.time}</span>
                                  {!joined && (
                                    <button onClick={e => { e.stopPropagation(); setJoinedCommunities([...joinedCommunities, ch.id]); if (ch.requiredSkin) addSkinXP(ch.requiredSkin, 25); }}
                                      style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: C.primary, color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                      Join
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* Create community form */}
                    {messagesTab === 'create' && (
                      <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <button onClick={() => setMessagesTab('communities')} style={{ background: 'none', border: 'none', color: C.primary, fontSize: '13px', cursor: 'pointer', padding: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>New Community</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</div>
                            <input type="text" value={newCommName} onChange={e => setNewCommName(e.target.value)} placeholder="e.g. SWE Underground"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '13px', boxSizing: 'border-box' as const }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                            <textarea value={newCommDesc} onChange={e => setNewCommDesc(e.target.value)} placeholder="What is this community about?" rows={2}
                              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '13px', boxSizing: 'border-box' as const, fontFamily: 'inherit', resize: 'none' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ValueSkin Required to Join</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={() => setNewCommGateType('any_valueskin')}
                                style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                  border: `1px solid ${newCommGateType === 'any_valueskin' ? C.primary : C.border}`,
                                  background: newCommGateType === 'any_valueskin' ? `${C.primary}12` : C.surface,
                                  color: newCommGateType === 'any_valueskin' ? C.primary : C.textMuted }}>
                                Any ValueSkin
                              </button>
                              {ownedSkins.map(({ profession }) => (
                                <button key={profession} onClick={() => { setNewCommGateType('specific'); setNewCommProfessions([profession]); }}
                                  style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                    border: `1px solid ${newCommGateType === 'specific' && newCommProfessions.includes(profession) ? C.primary : C.border}`,
                                    background: newCommGateType === 'specific' && newCommProfessions.includes(profession) ? `${C.primary}12` : C.surface,
                                    color: newCommGateType === 'specific' && newCommProfessions.includes(profession) ? C.primary : C.textMuted }}>
                                  {profession}
                                </button>
                              ))}
                            </div>
                            <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '6px' }}>Only people with this ValueSkin can join</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {(['public', 'private'] as const).map(v => (
                              <button key={v} onClick={() => setNewCommVisibility(v)}
                                style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                  border: `1px solid ${newCommVisibility === v ? C.primary : C.border}`,
                                  background: newCommVisibility === v ? `${C.primary}10` : C.surface,
                                  color: newCommVisibility === v ? C.primary : C.text }}>
                                {v === 'public' ? 'Public' : 'Private'}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => {
                            if (newCommName.trim()) {
                              setJoinedCommunities([...joinedCommunities, CHANNELS.length + joinedCommunities.length]);
                              setNewCommName(''); setNewCommDesc('');
                              setMessagesTab('communities');
                              setPurchaseToast('Community created');
                              setTimeout(() => setPurchaseToast(null), 3000);
                            }
                          }} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            Create Community
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : activeDmId !== null ? (
                <>
                  {/* DM Chat View — exact Instagram DM UI */}
                  {(() => {
                    const dmMeta: Record<number, { name: string; handle: string; avatar: string; online: boolean }> = {
                      1: { name: 'Alex Rivera', handle: '@alex_codes', avatar: 'AR', online: true },
                      2: { name: 'Priya Singh', handle: '@priya_builds', avatar: 'PS', online: false },
                      3: { name: 'Marcus Tran', handle: '@ml_marcus', avatar: 'MT', online: true },
                      4: { name: 'Sarah Kim', handle: '@sarahk_data', avatar: 'SK', online: false },
                      5: { name: 'Jordan Blake', handle: '@jblake_ops', avatar: 'JB', online: false },
                      6: { name: 'Elena Rodriguez', handle: '@elena_cooks', avatar: 'ER', online: false },
                      7: { name: 'Tommy Nguyen', handle: '@tommy_ai', avatar: 'TN', online: true },
                    };
                    const meta = dmMeta[activeDmId];
                    const msgs = dmMessages[activeDmId] || [];
                    if (!meta) return null;
                    const sendDm = () => {
                      if (!dmInput.trim()) return;
                      const now = new Date();
                      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                      const newMsg = { id: Date.now(), sender: 'me' as const, text: dmInput, time: timeStr };
                      setDmMessages(prev => ({ ...prev, [activeDmId!]: [...(prev[activeDmId!] || []), newMsg] }));
                      setDmInput('');
                      // Small XP for engagement — first owned skin gets credit
                      const firstSkin = ownedSkins[0];
                      if (firstSkin) addSkinXP(firstSkin.profession, 2);
                    };
                    return (
                      <>
                        {/* DM header */}
                        <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px', background: C.surface }}>
                          <button onClick={() => setActiveDmId(null)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                          <div style={{ position: 'relative' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: C.textMuted, border: `1px solid ${C.border}` }}>
                              {meta.avatar}
                            </div>
                            {meta.online && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: C.success, border: `2px solid ${C.surface}` }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{meta.name}</div>
                            <div style={{ fontSize: '11px', color: meta.online ? C.success : C.textMuted }}>{meta.online ? 'Active now' : meta.handle}</div>
                          </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {msgs.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start' }}>
                              <div style={{
                                maxWidth: '75%', padding: '10px 14px', borderRadius: msg.sender === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: msg.sender === 'me' ? C.primary : C.card,
                                color: msg.sender === 'me' ? '#fff' : C.text,
                                fontSize: '14px', lineHeight: 1.4,
                                border: msg.sender === 'me' ? 'none' : `1px solid ${C.border}`,
                              }}>
                                <div>{msg.text}</div>
                                <div style={{ fontSize: '10px', color: msg.sender === 'me' ? 'rgba(255,255,255,0.6)' : C.textMuted, marginTop: '4px', textAlign: 'right' }}>{msg.time}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Input */}
                        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="text" value={dmInput} onChange={e => setDmInput(e.target.value)} placeholder="Message..."
                            onKeyDown={e => { if (e.key === 'Enter') sendDm(); }}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: '22px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '14px', outline: 'none' }} />
                          <button onClick={sendDm} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: dmInput.trim() ? C.primary : C.surfaceAlt, color: dmInput.trim() ? '#fff' : C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* Community Chat View — group DM with skin badge */}
                  {(() => {
                    const channel = CHANNELS.find(c => c.id === activeCommunity);
                    if (!channel) return null;
                    return (
                      <>
                        <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px', background: C.surface }}>
                          <button onClick={() => setActiveCommunity(null)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: channel.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '11px' }}>
                            {channel.avatarAbbr}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{channel.name}</span>
                              <span style={{ fontSize: '9px', fontWeight: 600, color: C.primary, background: `${C.primary}12`, padding: '1px 5px', borderRadius: '4px' }}>{channel.requiredSkin || 'Any Skin'}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: C.textSecondary }}>{channel.memberCount.toLocaleString()} members</div>
                          </div>
                        </div>

                        {/* Description banner */}
                        <div style={{ padding: '8px 16px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, fontSize: '11px', color: C.textSecondary }}>
                          {channel.description}
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {(communityMessages[channel.id] || channel.messages).map(msg => (
                            <div key={msg.id} style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: C.textMuted, border: `1px solid ${C.border}` }}>
                                {msg.author.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{msg.author}</span>
                                  <span style={{ fontSize: '10px', color: C.textMuted }}>{msg.time}</span>
                                </div>
                                <div style={{ fontSize: '14px', color: C.text, lineHeight: 1.45 }}>{msg.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Input */}
                        {(() => {
                          const sendCommunityMsg = () => {
                            if (!dmInput.trim()) return;
                            const now = new Date();
                            const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                            const newMsg = { id: Date.now(), author: profileName, handle: '@you', text: dmInput, time: timeStr };
                            setCommunityMessages(prev => ({
                              ...prev,
                              [channel.id]: [...(prev[channel.id] || channel.messages), newMsg],
                            }));
                            setDmInput('');
                            if (channel.requiredSkin) addSkinXP(channel.requiredSkin, 5);
                          };
                          return (
                            <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input type="text" value={dmInput} onChange={e => setDmInput(e.target.value)} placeholder="Message..."
                                onKeyDown={e => { if (e.key === 'Enter') sendCommunityMsg(); }}
                                style={{ flex: 1, padding: '10px 14px', borderRadius: '22px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '14px', outline: 'none' }} />
                              <button onClick={sendCommunityMsg} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: dmInput.trim() ? C.primary : C.surfaceAlt, color: dmInput.trim() ? '#fff' : C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                              </button>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {activeView === 'admin' && (
            <>
              <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', paddingLeft: '20px', fontWeight: 'bold', fontSize: '16px', background: C.surface }}>
                Admin Panel
                <span style={{ fontSize: '11px', fontWeight: 600, color: C.primary, background: `rgba(0,102,204,0.1)`, padding: '3px 8px', borderRadius: '6px', marginLeft: '10px' }}>Meta</span>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Insights Tab — Visible Metrics
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Configure which metrics appear in the public Insights tab on creator profiles. Toggle metrics on or off to customize the experience.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      { key: 'score', label: 'Reputation Score', description: 'Overall verified score out of 1000 with progress bar' },
                      { key: 'engagement', label: 'Engagement Rate', description: 'Audience engagement percentage metric' },
                      { key: 'onTime', label: 'On-Time Delivery', description: 'Reliability metric for brand partnerships' },
                      { key: 'deals', label: 'Deals Completed', description: 'Total number of completed brand deals' },
                      { key: 'rating', label: 'Brand Rating', description: 'Average rating from brand partnerships' },
                      { key: 'trustLevel', label: 'Trust Level', description: 'Visual trust level indicator (1-5)' },
                      { key: 'breakdown', label: 'Score Breakdown', description: 'Detailed factor-by-factor score analysis' },
                    ] as const).map(({ key, label, description }) => (
                      <div
                        key={key}
                        onClick={() => setVisibleInsights(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px', background: C.card, borderRadius: '10px',
                          border: `1px solid ${visibleInsights[key] ? C.primary : C.border}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: C.textMuted }}>{description}</div>
                        </div>
                        <div style={{
                          width: '44px', height: '24px', borderRadius: '12px',
                          background: visibleInsights[key] ? C.primary : C.border,
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '12px',
                        }}>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: '2px',
                            left: visibleInsights[key] ? '22px' : '2px',
                            transition: 'left 0.2s',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'rgba(0,102,204,0.06)', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                    Changes are applied instantly to the Insights tab on all creator profiles. Visit Profile → Insights tab to preview.
                  </div>
                </div>

                {/* ValueSkin Pricing Control */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    ValueSkin Pricing
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Set the credit cost per tier. All professions use global defaults unless overridden.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { tier: 'community', label: 'Community tier', desc: 'Join communities only' },
                      { tier: 'marketplace', label: 'Marketplace tier', desc: 'Communities + brand deals' },
                    ].map(({ tier, label, desc }) => (
                      <div
                        key={tier}
                        style={{
                          padding: '14px 16px', background: C.card, borderRadius: '10px',
                          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: C.textMuted }}>{desc}</div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={tier === 'community' ? communityTierCredits : marketplaceTierCredits}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (tier === 'community') setCommunityTierCredits(val);
                            else setMarketplaceTierCredits(val);
                          }}
                          style={{
                            width: '60px', padding: '8px', borderRadius: '6px',
                            border: `1px solid ${C.border}`, background: C.surface, color: C.text,
                            textAlign: 'center', fontSize: '13px', fontWeight: 600,
                          }}
                        />
                        <span style={{ fontSize: '12px', color: C.textSecondary, minWidth: '80px' }}>
                          ${(tier === 'community' ? communityTierCredits : marketplaceTierCredits) * 0.1}.00 USD
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setPurchaseToast('Pricing updated');
                      setTimeout(() => setPurchaseToast(null), 3000);
                    }}
                    style={{
                      width: '100%', marginTop: '16px', padding: '12px 16px', borderRadius: '6px',
                      border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    Save Pricing
                  </button>
                </div>

                {/* Platform Commission Control */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Deal Commission
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Set the platform commission percentage charged on every completed deal.
                  </p>
                  {/* Commission Payer Toggle */}
                  <div style={{ marginBottom: '16px', padding: '12px 14px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>
                      Commission Paid By
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setCommissionPaidBy('brand')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: commissionPaidBy === 'brand' ? C.primary : C.surface,
                          color: commissionPaidBy === 'brand' ? '#fff' : C.textSecondary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Brand (Creator keeps full amount)
                      </button>
                      <button
                        onClick={() => setCommissionPaidBy('creator')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: commissionPaidBy === 'creator' ? C.primary : C.surface,
                          color: commissionPaidBy === 'creator' ? '#fff' : C.textSecondary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Creator (Deducted from payout)
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>Commission rate</div>
                        <div style={{ fontSize: '11px', color: C.textMuted }}>Applied to all deal types (paid, c2c_paid)</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={platformCommissionPct}
                          onChange={(e) => setPlatformCommissionPct(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                          style={{ width: '56px', padding: '8px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, textAlign: 'center', fontSize: '15px', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>%</span>
                      </div>
                    </div>
                    {/* Commission slider */}
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={platformCommissionPct}
                      onChange={(e) => setPlatformCommissionPct(parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.textMuted, marginTop: '4px' }}>
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                    {/* Example calculation */}
                    <div style={{ marginTop: '12px', padding: '10px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Example: $10,000 deal @ {platformCommissionPct}%</div>
                      {commissionPaidBy === 'brand' ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                            <span style={{ color: C.textSecondary }}>Creator receives</span>
                            <span style={{ color: C.success, fontWeight: 700 }}>$10,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: C.textSecondary }}>Brand pays (total)</span>
                            <span style={{ color: C.primary, fontWeight: 700 }}>${(10000 + 10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '3px', paddingTop: '3px', borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
                            <span>ValueSkins revenue</span>
                            <span>${(10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                            <span style={{ color: C.textSecondary }}>Creator receives</span>
                            <span style={{ color: C.success, fontWeight: 700 }}>${(10000 - 10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: C.textSecondary }}>Brand pays (total)</span>
                            <span style={{ color: C.primary, fontWeight: 700 }}>$10,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '3px', paddingTop: '3px', borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
                            <span>ValueSkins revenue</span>
                            <span>${(10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPurchaseToast(`Commission set to ${platformCommissionPct}%`);
                      setTimeout(() => setPurchaseToast(null), 3000);
                    }}
                    style={{ width: '100%', marginTop: '12px', padding: '12px 16px', borderRadius: '6px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save Commission Rate
                  </button>
                </div>

                {/* Fraud Detection Dashboard */}
                <div style={{
                  borderRadius: '12px',
                  border: `1px solid ${C.borderLight}`,
                  padding: '16px',
                  marginTop: '20px',
                  backgroundColor: C.bg,
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: '12px', color: C.text }}>Fraud Detection Dashboard</h3>

                  {[
                    { id: 1, type: 'self_dealing', creator: '@alex_codes', severity: 'medium', time: '2 days ago' },
                    { id: 2, type: 'velocity_spike', creator: '@ml_marcus', severity: 'high', time: '5 hours ago' },
                    { id: 3, type: 'rating_collusion', creator: '@priya_builds', severity: 'low', time: '1 week ago' },
                  ].filter(s => !resolvedFraudSignals.includes(s.id)).map((signal) => (
                    <div key={signal.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: 'rgba(239,68,68,0.06)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                    }}>
                      <div>
                        <span style={{ fontWeight: 500, color: C.text }}>{signal.type}</span>
                        {' | '}
                        <span style={{ color: C.textSecondary }}>{signal.creator}</span>
                        {' | '}
                        <span style={{
                          padding: '2px 6px',
                          backgroundColor: signal.severity === 'high' ? C.textMuted : signal.severity === 'medium' ? '#f59e0b' : C.textSecondary,
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}>
                          {signal.severity.toUpperCase()}
                        </span>
                        {' | '}
                        <span style={{ color: C.textSecondary, fontSize: '12px' }}>{signal.time}</span>
                      </div>
                      <button
                        onClick={() => setResolvedFraudSignals([...resolvedFraudSignals, signal.id])}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: C.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Resolve
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => alert('Scan queued — results in ~2 minutes')}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '10px',
                      backgroundColor: C.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Run Full Scan
                  </button>
                </div>
              </div>

              {/* ── CREATOR SAFETY CONTROLS ─────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Creator Safety Controls</div>
                </div>
                <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '18px', lineHeight: 1.5 }}>
                  Platform-level rules enforced on all outreach. Creators cannot override these — they set the floor. Brands that violate are throttled or suspended.
                </div>

                {/* DM / Proposal Rate Limit */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Brand Outreach Rate Limit</div>
                      <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>Max proposals a brand can send per day across all creators</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => setSafetyDmRateLimit(Math.max(1, safetyDmRateLimit - 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: C.primary, minWidth: '28px', textAlign: 'center' }}>{safetyDmRateLimit}</span>
                      <button onClick={() => setSafetyDmRateLimit(Math.min(100, safetyDmRateLimit + 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <input type="range" min={1} max={50} value={safetyDmRateLimit} onChange={e => setSafetyDmRateLimit(Number(e.target.value))} style={{ width: '100%', accentColor: C.primary }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.textMuted, marginTop: '2px' }}>
                    <span>1 (strict)</span><span>25 (standard)</span><span>50 (open)</span>
                  </div>
                </div>

                {/* Re-contact cooldown */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Re-contact Cooldown</div>
                      <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>Days a brand is blocked from re-contacting a creator after decline</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[7, 14, 30, 60, 90].map(d => (
                        <button key={d} onClick={() => setSafetyRecontactCooldown(d)}
                          style={{ padding: '4px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            background: safetyRecontactCooldown === d ? `${C.primary}20` : C.bg,
                            color: safetyRecontactCooldown === d ? C.primary : C.textMuted,
                            border: `1px solid ${safetyRecontactCooldown === d ? C.primary : C.border}`,
                          }}>{d}d</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Report-to-throttle threshold */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Auto-Throttle Threshold</div>
                      <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>Reports needed from creators before brand outreach is auto-suspended</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[1, 2, 3, 5, 10].map(n => (
                        <button key={n} onClick={() => setSafetyReportThreshold(n)}
                          style={{ padding: '4px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            background: safetyReportThreshold === n ? 'rgba(239,68,68,0.15)' : C.bg,
                            color: safetyReportThreshold === n ? C.textMuted : C.textMuted,
                            border: `1px solid ${safetyReportThreshold === n ? C.textMuted : C.border}`,
                          }}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Min brand trust score to contact */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Minimum Brand Trust Score to Contact</div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '10px' }}>Brands below this score see creator profiles but cannot initiate contact</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setSafetyMinBrandTrust(n)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          background: safetyMinBrandTrust === n ? `${C.primary}20` : C.bg,
                          color: safetyMinBrandTrust === n ? C.primary : C.textMuted,
                          border: `1px solid ${safetyMinBrandTrust === n ? C.primary : C.border}`,
                        }}>{'★'.repeat(n)}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '6px', textAlign: 'center' }}>
                    Current: min {safetyMinBrandTrust}★ — brands below are read-only
                  </div>
                </div>

                {/* New brand warm intro threshold */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>New Brand Warm Intro Gate</div>
                      <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>Brands with fewer than N completed deals must be vouched before cold outreach</div>
                    </div>
                    <button onClick={() => setSafetyNewBrandWarmIntro(p => !p)}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', backgroundColor: safetyNewBrandWarmIntro ? C.primary : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '2px', left: safetyNewBrandWarmIntro ? '22px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                  {safetyNewBrandWarmIntro && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: C.textSecondary }}>Gate brands with fewer than</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[0, 1, 3, 5, 10].map(n => (
                          <button key={n} onClick={() => setSafetyNewBrandDealCount(n)}
                            style={{ padding: '3px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                              background: safetyNewBrandDealCount === n ? `${C.primary}20` : C.bg,
                              color: safetyNewBrandDealCount === n ? C.primary : C.textMuted,
                              border: `1px solid ${safetyNewBrandDealCount === n ? C.primary : C.border}`,
                            }}>{n}</button>
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: C.textSecondary }}>completed deals</span>
                    </div>
                  )}
                </div>

                {/* Toggle switches row */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Platform-Wide Enforcement</div>
                  {([
                    { label: 'Require verified Brand ValueSkin to contact', desc: 'Unverified brands cannot initiate any outreach', value: safetyRequireVerifiedBrand, set: setSafetyRequireVerifiedBrand },
                    { label: 'Proposal form required (no free-text cold DMs)', desc: 'All contact must be a structured brief — not a message', value: safetyRequireBrief, set: setSafetyRequireBrief },
                    { label: 'Block off-platform contact requests', desc: 'Auto-flag messages asking for phone/email/WhatsApp', value: safetyOffPlatformBlock, set: setSafetyOffPlatformBlock },
                  ] as const).map(({ label, desc, value, set }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{label}</div>
                        <div style={{ fontSize: '10px', color: C.textSecondary, marginTop: '1px' }}>{desc}</div>
                      </div>
                      <button onClick={() => set((p: boolean) => !p)}
                        style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: value ? C.primary : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '2px', left: value ? '20px' : '2px', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={() => { setSavedSafetyToast(true); setTimeout(() => setSavedSafetyToast(false), 3000); }}
                  style={{ width: '100%', padding: '12px', background: C.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {savedSafetyToast ? 'Safety settings saved' : 'Save Safety Settings'}
                </button>

                {/* Live policy summary */}
                <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(0,102,204,0.05)', border: `1px solid rgba(0,102,204,0.15)`, borderRadius: '8px', fontSize: '11px', color: C.textSecondary, lineHeight: 1.7 }}>
                  <strong style={{ color: C.text, display: 'block', marginBottom: '4px' }}>Current Policy Summary</strong>
                  • Brands can send max <strong style={{ color: C.text }}>{safetyDmRateLimit}</strong> proposals/day<br/>
                  • Declined brand locked out for <strong style={{ color: C.text }}>{safetyRecontactCooldown} days</strong><br/>
                  • Auto-suspended after <strong style={{ color: C.text }}>{safetyReportThreshold}</strong> creator report{safetyReportThreshold !== 1 ? 's' : ''}<br/>
                  • Minimum brand trust to contact: <strong style={{ color: C.text }}>{'★'.repeat(safetyMinBrandTrust)}</strong><br/>
                  {safetyNewBrandWarmIntro && <>• Brands with &lt;{safetyNewBrandDealCount} deals need warm intro<br/></>}
                  {safetyRequireVerifiedBrand && <>• Verified Brand ValueSkin required<br/></>}
                  {safetyRequireBrief && <>• Proposal form mandatory — no cold DMs<br/></>}
                  {safetyOffPlatformBlock && <>• Off-platform contact requests auto-flagged<br/></>}
                </div>
              </div>

              {/* ── FEATURE FLAGS ───────────────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Feature Flags</div>
                  </div>
                  <span style={{ fontSize: '10px', color: C.textMuted }}>Toggle any feature platform-wide</span>
                </div>
                <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '16px' }}>
                  All features are on by default. Turn off to hide from all creators and brands instantly.
                </div>

                {([
                  { label: 'Rate Card', desc: 'Per-format pricing (Reel/Story/Post) visible on creator cards', value: adminShowRateCard, set: setAdminShowRateCard },
                  { label: 'Availability Calendar', desc: 'Creator "available from" date shown on cards and in search', value: adminShowAvailabilityCalendar, set: setAdminShowAvailabilityCalendar },
                  { label: 'Portfolio Samples', desc: 'Past brand work visible on creator cards', value: adminShowPortfolio, set: setAdminShowPortfolio },
                  { label: 'Deal Completion Rate', desc: 'Creator % of started deals finished — penalises ghosting', value: adminShowDealCompletion, set: setAdminShowDealCompletion },
                  { label: 'Verified Income Tier', desc: 'Trust badge showing lifetime earnings tier ($10K+, $50K+, etc)', value: adminShowIncomeTier, set: setAdminShowIncomeTier },
                  { label: 'First-Deal Badge', desc: 'Badge shown on creators open to discounted first collaboration', value: adminShowFirstDealBadge, set: setAdminShowFirstDealBadge },
                  { label: 'Exclusivity Slot Signal', desc: 'Shows "Slot taken until [date]" when creator is exclusive with a brand', value: adminShowExclusivitySignal, set: setAdminShowExclusivitySignal },
                  { label: 'Revision Limit Display', desc: 'Number of revisions included shown upfront on creator cards', value: adminShowRevisionLimit, set: setAdminShowRevisionLimit },
                  { label: 'Usage Rights Duration', desc: 'Days of usage rights shown before deal accepted', value: adminShowUsageRightsDuration, set: setAdminShowUsageRightsDuration },
                  { label: 'Brand Track Record', desc: 'Brand deals completed + avg payment time + creator ratings of brand', value: adminShowBrandTrackRecord, set: setAdminShowBrandTrackRecord },
                  { label: 'Mutual Rating System', desc: 'Both parties rate each other after deal close', value: adminShowMutualRating, set: setAdminShowMutualRating },
                  { label: 'Deal Templates', desc: 'Brands can save and reuse campaign brief templates', value: adminShowDealTemplates, set: setAdminShowDealTemplates },
                  { label: 'Saved Searches', desc: 'Brands get notified when a matching creator joins', value: adminShowSavedSearches, set: setAdminShowSavedSearches },
                  { label: 'Similar Creators', desc: 'Suggest creators similar to ones a brand already worked with', value: adminShowSimilarCreators, set: setAdminShowSimilarCreators },
                  { label: 'Long-Term Contracts', desc: 'Multi-month ambassador deals with recurring escrow milestones', value: adminAllowLongTermContracts, set: setAdminAllowLongTermContracts },
                ] as const).map(({ label, desc, value, set }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: value ? C.text : C.textMuted }}>{label}</div>
                      <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '1px' }}>{desc}</div>
                    </div>
                    <button onClick={() => set((p: boolean) => !p)}
                      style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: value ? C.primary : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '2px', left: value ? '20px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => { setAdminSavedFeaturesTab(true); setTimeout(() => setAdminSavedFeaturesTab(false), 3000); }}
                  style={{ width: '100%', marginTop: '16px', padding: '11px', background: C.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {adminSavedFeaturesTab ? 'Feature flags saved' : 'Save Feature Flags'}
                </button>
              </div>

              {/* ── DEAL COMMUNICATION MODE ───────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Deal Communication Mode</div>
                </div>
                <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                  Choose how brand deals and negotiations happen on the platform. This is a platform-level decision that affects all users.
                </div>

                {/* Option 1: ValueSkins Chatroom */}
                <div
                  onClick={() => setDealCommMode('valueskins_chatroom')}
                  style={{
                    background: dealCommMode === 'valueskins_chatroom' ? 'rgba(0,102,204,0.06)' : C.card,
                    border: `2px solid ${dealCommMode === 'valueskins_chatroom' ? C.primary : C.border}`,
                    borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>ValueSkins Deal Room</div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${dealCommMode === 'valueskins_chatroom' ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {dealCommMode === 'valueskins_chatroom' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.primary }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.6 }}>
                    Separate deal room environment purpose-built for negotiations. Offers, counters, contracts, and chat happen inside ValueSkins. Isolated from personal DMs.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['Immutable audit log', 'Hash-chain integrity', 'Exact-second timestamps', 'Seen receipts', 'Deal reference IDs', 'Contract signing'].map(f => (
                      <span key={f} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(0,102,204,0.1)', color: C.primary }}>{f}</span>
                    ))}
                  </div>
                </div>

                {/* Option 2: Platform DMs */}
                <div
                  onClick={() => setDealCommMode('platform_dms')}
                  style={{
                    background: dealCommMode === 'platform_dms' ? 'rgba(0,102,204,0.06)' : C.card,
                    border: `2px solid ${dealCommMode === 'platform_dms' ? C.primary : C.border}`,
                    borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Platform DMs (Instagram, etc.)</div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${dealCommMode === 'platform_dms' ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {dealCommMode === 'platform_dms' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.primary }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.6 }}>
                    Route deal conversations through the platform's existing DM system. Creators and brands communicate in the same inbox they already use. ValueSkins injects a compliance layer on top.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['Familiar UX', 'No context switching', 'Existing notification system'].map(f => (
                      <span key={f} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: C.textSecondary }}>{f}</span>
                    ))}
                  </div>
                </div>

                {/* Non-negotiable security notice */}
                <div style={{ background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#d32f2f' }}>Non-negotiable — applies to both modes</span>
                  </div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.6 }}>
                    Regardless of communication mode, the following security features are enforced on every deal message and cannot be disabled:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {[
                      { label: 'Immutable audit trail', desc: 'Every message, offer, counter, and phase change is stored as an append-only record. No edits, no deletions.' },
                      { label: 'Exact-second timestamps', desc: 'Send time, delivery time, and read time logged to the second in UTC for every message.' },
                      { label: 'Hash-chain integrity', desc: 'Each event is SHA-256 hashed with the previous event hash. Tampering with any record breaks the chain.' },
                      { label: 'Seen receipts with proof', desc: 'The exact moment the other party reads a message is recorded and visible to both sides.' },
                      { label: 'No ghosting enforcement', desc: 'Neither party can exit a live deal without selecting a documented rejection reason. Repeat offenders lose trust score.' },
                      { label: 'Exportable transcript', desc: 'Full deal history exportable as a legally defensible PDF at any time by either party.' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 2, flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text }}>{item.label}</div>
                          <div style={{ fontSize: '10px', color: C.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {dealCommMode === 'platform_dms' && (
                  <div style={{ background: 'rgba(230,81,0,0.06)', border: '1px solid rgba(230,81,0,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Integration requirements for Platform DMs</div>
                    <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.6 }}>
                      If DMs are chosen as the communication channel, the platform must expose the following hooks to ValueSkins:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                      {[
                        'Message webhook: every DM in a deal thread forwarded to ValueSkins for audit logging',
                        'Read receipt webhook: exact timestamp when recipient opens the message',
                        'Message metadata injection: ValueSkins appends audit ID and hash to each message payload',
                        'Thread isolation: deal-tagged DM threads are flagged and cannot be deleted by either party',
                        'Moderation override: platform moderators can freeze a deal thread on abuse reports',
                        'Export API: full thread exportable via API with all metadata for legal compliance',
                      ].map((req, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '10px', color: C.text, lineHeight: 1.5 }}>
                          <span style={{ color: C.primary, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setPurchaseToast(`Communication mode set to: ${dealCommMode === 'valueskins_chatroom' ? 'ValueSkins Deal Room' : 'Platform DMs with security layer'}`); setTimeout(() => setPurchaseToast(null), 3000); }}
                  style={{ width: '100%', marginTop: '14px', padding: '11px', background: C.primary, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Save Communication Mode
                </button>
              </div>
            </>
          )}

          {/* ── STORE VIEW ────────────────────────────────────── */}
          {activeView === 'store' && (
            <>
              {/* Store header */}
              <div style={{ padding: '12px 16px 0', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: C.text, display: 'block', marginBottom: '14px' }}>ValueSkins Closet</span>
                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search professions..."
                    style={{ width: '100%', background: C.card, border: 'none', borderRadius: '12px', padding: '12px 12px 12px 40px', color: C.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ padding: '0 16px 16px' }}>
                {/* Slot assignment pills */}
                {marketplaceRole !== 'brand' && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {SLOTS.map((slot) => {
                      const current = valueSkins[slot];
                      const active = assigningSlot === slot;
                      const slotColor = SLOT_COLORS[slot];
                      return (
                        <button
                          key={slot}
                          onClick={() => setAssigningSlot(active ? null : slot)}
                          style={{
                            flex: 1, padding: '10px 8px', borderRadius: '12px', cursor: 'pointer',
                            background: active ? `${slotColor}20` : C.card,
                            border: active ? `2px solid ${slotColor}` : '2px solid transparent',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: slotColor, marginBottom: '2px' }}>
                            {SLOT_LABELS[slot]}
                          </div>
                          <div style={{ fontSize: '13px', color: current ? C.text : C.textMuted, fontWeight: current ? 600 : 400 }}>
                            {current ? (PROFESSION_BADGES[current.profession]?.abbreviation ?? current.profession) : 'Empty'}
                          </div>
                          {current && (() => {
                            const level = getSkinLevel(current.profession);
                            const progress = getSkinXPProgress(current.profession);
                            const xp = skinXP[current.profession] || 0;
                            const thresholds = [0, 50, 200, 500, 1000];
                            const nextXP = level >= 5 ? 1000 : thresholds[level];
                            return (
                              <div style={{ marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 700, color: slotColor }}>Lv.{level}</span>
                                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: C.border, overflow: 'hidden' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: slotColor, borderRadius: '2px' }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: '8px', color: C.textMuted, marginTop: '1px' }}>{level >= 5 ? 'MAX' : `${xp}/${nextXP} XP`}</div>
                              </div>
                            );
                          })()}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Brand: owned skins summary */}
                {marketplaceRole === 'brand' && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Your ValueSkins ({brandValueSkins.length}/3)</div>
                    {brandValueSkins.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {brandValueSkins.map(skin => (
                          <span key={skin} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: C.primary, background: `${C.primary}15`, padding: '6px 14px', borderRadius: '20px' }}>
                            {skin}
                            <button onClick={(e) => { e.stopPropagation(); setBrandValueSkins(prev => prev.filter(s => s !== skin)); if (activeBrandSkin === skin) setActiveBrandSkin(brandValueSkins.find(s => s !== skin) || null); setPurchaseToast(`Removed ${skin} from brand skins`); setTimeout(() => setPurchaseToast(null), 3000); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>x</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {marketplaceRole !== 'brand' && !assigningSlot && (
                  <div style={{ fontSize: '13px', color: C.warning, marginBottom: '12px', fontWeight: 600 }}>
                    Select a slot above to assign a ValueSkin
                  </div>
                )}
                {assigningSlot && (
                  <div style={{ fontSize: '13px', color: SLOT_COLORS[assigningSlot], marginBottom: '12px', fontWeight: 600 }}>
                    Selecting for {SLOT_LABELS[assigningSlot]} slot
                  </div>
                )}

                {/* 2-column category grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {Object.values(PROFESSIONS).map((prof) => {
                    const isBrand = marketplaceRole === 'brand';
                    const brandOwns = isBrand && prof.subProfessions.some(sp => brandValueSkins.includes(sp));
                    const isCurrentSlotActive = !isBrand && assigningSlot && prof.subProfessions.includes(valueSkins[assigningSlot]?.profession ?? '');
                    const canClick = isBrand ? brandValueSkins.length < 3 : !!assigningSlot;
                    return (
                      <button
                        key={prof.name}
                        onClick={() => { if (canClick) { setStoreCategory(prof.name); setShowStoreModal(true); } }}
                        style={{
                          padding: '16px 14px', textAlign: 'left',
                          background: (isCurrentSlotActive || brandOwns) ? `${C.primary}12` : C.card,
                          border: 'none', borderRadius: '14px', cursor: canClick ? 'pointer' : 'default',
                          transition: 'all 0.15s', opacity: canClick ? 1 : 0.5,
                        }}
                      >
                        <div style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '4px' }}>{prof.name}</div>
                        <div style={{ fontSize: '12px', color: (isCurrentSlotActive || brandOwns) ? C.primary : C.textMuted, fontWeight: 600 }}>
                          {brandOwns ? 'Owned' : isCurrentSlotActive ? 'Active' : canClick ? `${prof.subProfessions.length} skins` : '\u2014'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── NOTIFICATIONS VIEW ────────────────────────────── */}
          {activeView === 'notifications' && (
            <>
              <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '16px', paddingRight: '16px', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Notifications</span>
                {notifications.length > 0 && (
                  <button onClick={() => { setNotifications([]); setPurchaseToast('Notifications cleared'); setTimeout(() => setPurchaseToast(null), 2000); }} style={{ background: 'none', border: 'none', fontSize: '12px', color: C.primary, cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
                )}
              </div>
              {!hasAnySkin ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
                  <div style={{ fontSize: '14px', marginBottom: '4px' }}>No notifications yet</div>
                  <div style={{ fontSize: '12px' }}>Select or purchase a ValueSkin to start receiving activity notifications.</div>
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
                    <div style={{ fontSize: '14px', marginBottom: '4px' }}>No notifications yet</div>
                    <div style={{ fontSize: '12px' }}>Activity from deals, communities, and skins will appear here</div>
                  </div>
                ) : (
                  <>
                    {/* New section */}
                    {notifications.filter(n => !n.read).length > 0 && (
                      <>
                        <div style={{ padding: '14px 16px 8px', fontSize: '15px', fontWeight: 700, color: C.text }}>New</div>
                        {notifications.filter(n => !n.read).map(n => {
                          const avatarColors: Record<string, string> = { deal: '#0095F6', community: '#7C3AED', skin: '#00D46A', system: '#666' };
                          const avatarColor = avatarColors[n.type] || '#666';
                          const brandInitial = n.text.match(/^(\w)/)?.[1] || 'N';
                          return (
                            <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{brandInitial}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', color: C.text, lineHeight: 1.4 }}>{n.text}</div>
                                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{n.time}</div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setNotifications(prev => prev.filter(x => x.id !== n.id)); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', padding: '4px' }}>x</button>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
                            </div>
                          );
                        })}
                      </>
                    )}
                    {/* Earlier section */}
                    {notifications.filter(n => n.read).length > 0 && (
                      <>
                        <div style={{ padding: '14px 16px 8px', fontSize: '15px', fontWeight: 700, color: C.text }}>Earlier</div>
                        {notifications.filter(n => n.read).map(n => {
                          const avatarColors: Record<string, string> = { deal: '#0095F6', community: '#7C3AED', skin: '#00D46A', system: '#666' };
                          const avatarColor = avatarColors[n.type] || '#666';
                          const brandInitial = n.text.match(/^(\w)/)?.[1] || 'N';
                          return (
                            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.7 }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{brandInitial}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.4 }}>{n.text}</div>
                                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{n.time}</div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
              )}
            </>
          )}

          {/* ── EXPLORE VIEW ──────────────────────────────────── */}
          {activeView === 'explore' && (
            <>
              <div style={{ height: '52px', display: 'flex', alignItems: 'center', paddingLeft: '16px', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Explore</span>
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                {(['trending', 'skins', 'creators'] as const).map(tab => (
                  <button key={tab} onClick={() => setExploreTab(tab)}
                    style={{ flex: 1, padding: '12px 0', fontSize: '13px', fontWeight: exploreTab === tab ? 700 : 500,
                      color: exploreTab === tab ? C.text : C.textMuted, background: 'none', border: 'none',
                      borderBottom: exploreTab === tab ? `2px solid ${C.primary}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                    {tab}
                  </button>
                ))}
              </div>
              <div style={{ padding: '16px' }}>
                {exploreTab === 'trending' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { title: 'AI-Powered Content Creation', desc: 'Creators using AI tools are seeing 3x engagement growth', tag: 'Technology', views: '24K' },
                      { title: 'Fitness Creators Dominating Reels', desc: 'Short-form workout content up 180% this quarter', tag: 'Sports', views: '18K' },
                      { title: 'Brand Deals Going Long-Term', desc: 'Ambassador programs replace one-off sponsorships', tag: 'Business', views: '12K' },
                      { title: 'Design Portfolios on Instagram', desc: 'UX designers showcase work through carousel posts', tag: 'Art & Design', views: '9K' },
                      { title: 'Finance Creators Hit Mainstream', desc: 'Budgeting and investing content reaches Gen Z', tag: 'Finance', views: '15K' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: C.card, borderRadius: '10px', padding: '14px', border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{item.title}</span>
                          <span style={{ fontSize: '10px', color: C.textMuted, flexShrink: 0 }}>{item.views} views</span>
                        </div>
                        <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.4, marginBottom: '8px' }}>{item.desc}</div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: C.primary, background: `${C.primary}10`, padding: '2px 8px', borderRadius: '4px' }}>{item.tag}</span>
                      </div>
                    ))}
                  </div>
                )}
                {exploreTab === 'skins' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Popular ValueSkins this week</div>
                    {Object.entries(PROFESSION_BADGES).slice(0, 12).map(([name, badge]) => (
                      <div key={name} onClick={() => setActiveView('store')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: C.card, borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = badge.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
                        {getStickerForProfession(name) ? (
                          <img src={getStickerForProfession(name)!} alt={name} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${badge.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: badge.color }}>{badge.abbreviation}</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{name}</div>
                          <div style={{ fontSize: '11px', color: C.textMuted }}>Level 1-5 available</div>
                        </div>
                        <div style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>View</div>
                      </div>
                    ))}
                  </div>
                )}
                {exploreTab === 'creators' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Top creators by engagement</div>
                    {backendCreators.map((c, i) => {
                      return (
                        <div key={i} onClick={() => setPreviewCreator(c)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name.replace(/\s/g, '')}`} alt={c.name} style={{ width: '44px', height: '44px', borderRadius: '50%', background: C.surfaceAlt }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: C.textSecondary }}>{c.handle} · {c.valueSkin}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{c.followers}</div>
                            <div style={{ fontSize: '10px', color: C.success }}>{c.engagement} eng</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CREATOR PREVIEW MODAL ──────────────────────────── */}
          {previewCreator && (
            <Modal onClose={() => setPreviewCreator(null)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${previewCreator.name.replace(/\s/g, '')}`} alt={previewCreator.name}
                    style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.surfaceAlt }} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{previewCreator.name}</div>
                    <div style={{ fontSize: '13px', color: C.textSecondary }}>{previewCreator.handle}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      {(() => {
                        const badge = PROFESSION_BADGES[previewCreator.valueSkin];
                        const sticker = getStickerForProfession(previewCreator.valueSkin);
                        return sticker ? (
                          <img src={sticker} alt={previewCreator.valueSkin} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: (badge?.color ?? C.primary), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#fff' }}>{badge?.abbreviation ?? '?'}</div>
                        );
                      })()}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.primary }}>{previewCreator.valueSkin}</span>
                    </div>
                  </div>
                </div>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Followers', value: previewCreator.followers },
                    { label: 'Engagement', value: previewCreator.engagement },
                    { label: 'Match', value: previewCreator.matchScore },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px', background: C.surfaceAlt, borderRadius: '8px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                    <div style={{ color: C.textMuted }}>Rate</div><div style={{ color: C.text, fontWeight: 600 }}>{previewCreator.rate}</div>
                    <div style={{ color: C.textMuted }}>Timezone</div><div style={{ color: C.text }}>{previewCreator.timezone}</div>
                    <div style={{ color: C.textMuted }}>Response</div><div style={{ color: C.text }}>Within {previewCreator.responseTimeHrs}h</div>
                    <div style={{ color: C.textMuted }}>Min Deal</div><div style={{ color: C.text }}>${previewCreator.minDealUsd.toLocaleString()}</div>
                    <div style={{ color: C.textMuted }}>Audience</div><div style={{ color: C.text }}>{previewCreator.audienceAgeRange}, {previewCreator.audienceLocation}</div>
                    <div style={{ color: C.textMuted }}>Language</div><div style={{ color: C.text }}>{previewCreator.audienceLang}</div>
                    <div style={{ color: C.textMuted }}>Available</div><div style={{ color: previewCreator.availableFrom === 'Now' ? C.success : C.text, fontWeight: 600 }}>{previewCreator.availableFrom}</div>
                    <div style={{ color: C.textMuted }}>Completion</div><div style={{ color: C.text }}>{previewCreator.dealCompletionRate}%</div>
                  </div>
                </div>
                {/* Deal types */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Accepts</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {previewCreator.dealTypes.map(dt => (
                      <span key={dt} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: C.surfaceAlt, color: C.textSecondary, border: `1px solid ${C.border}` }}>{dt}</span>
                    ))}
                    {previewCreator.ndaOk && <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>NDA</span>}
                    {previewCreator.usageRightsOk && <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>Usage Rights ({previewCreator.usageRightsDays}d)</span>}
                  </div>
                </div>
                {/* Rate card */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Rate Card</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {Object.entries(previewCreator.rateCard).map(([fmt, price]) => (
                      <div key={fmt} style={{ flex: 1, textAlign: 'center', padding: '8px', background: C.surfaceAlt, borderRadius: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{price}</div>
                        <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'capitalize' }}>{fmt}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Portfolio */}
                {previewCreator.portfolio.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Portfolio</div>
                    {previewCreator.portfolio.map((p, i) => (
                      <div key={i} style={{ fontSize: '12px', color: C.textSecondary, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>{p}</div>
                    ))}
                  </div>
                )}
                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={`https://portfolio.valueskins.com/${previewCreator.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.primary, fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>Visit Instagram</a>
                  <button onClick={() => { setPreviewCreator(null); setActiveView('mim'); }}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Back to Marketplace
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* ── SETTINGS VIEW ────────────────────────────────── */}
          {activeView === 'settings' && (
            <>
              <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '20px', paddingRight: '20px', fontWeight: 'bold', fontSize: '16px', background: C.surface }}>
                <div>
                  Settings
                  <span style={{ fontSize: '11px', fontWeight: 600, color: C.textSecondary, marginLeft: '10px' }}>ValueSkins preferences</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: C.success }}>Auto-saved</span>
              </div>
              <div style={{ padding: '20px' }}>

                {/* Brand Settings — only shown when logged in as brand */}
                {marketplaceRole === 'brand' && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>Brand Settings</div>
                    <div style={{ background: C.card, border: `1px solid rgba(230,81,0,0.25)`, borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '2px' }}>Brand Identity</div>
                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '12px' }}>Your ValueSkin determines which creators you can contact. Only creators with the same profession will see your proposals.</div>
                      {brandValueSkins.length > 0 ? (
                        <div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {brandValueSkins.map(skin => (
                              <div key={skin} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(230,81,0,0.06)', borderRadius: '8px', padding: '6px 10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{skin}</span>
                                <button onClick={() => { setBrandValueSkins(prev => prev.filter(s => s !== skin)); if (activeBrandSkin === skin) setActiveBrandSkin(brandValueSkins.find(s => s !== skin) ?? null); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}>x</button>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: '11px', color: C.textSecondary }}>{brandValueSkins.length}/3 slots used</div>
                        </div>
                      ) : (
                        <button onClick={() => setActiveView('store')} style={{ width: '100%', background: C.warning, border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                          Get Brand ValueSkin
                        </button>
                      )}
                    </div>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Campaign Budget</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: C.textMuted }}>Default budget ($)</span>
                        <input
                          type="text"
                          value={brandBudget}
                          onChange={e => setBrandBudget(e.target.value.replace(/[^0-9]/g, ''))}
                          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '6px 10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand Profile — category selection, only for brands */}
                {marketplaceRole === 'brand' && (
                  <div style={{ marginBottom: '24px' }}>
                    {(() => {
                      const open = creatorSettingsOpen === ('brandProfile' as any);
                      return (
                        <>
                          <button onClick={() => setCreatorSettingsOpen(open ? null : 'brandProfile' as any)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Brand Profile</span>
                            <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '\u25B2' : '\u25BC'}</span>
                          </button>
                          {open && (
                            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                              <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '12px', lineHeight: 1.5 }}>
                                Define your brand profile so creators understand who you are. Select one option from each category.
                              </div>
                              {Object.values(BRAND_CATEGORIES).map((cat) => {
                                const currentSelection = brandProfileSelections[cat.name];
                                return (
                                  <div key={cat.name} style={{ marginBottom: '14px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px' }}>{cat.name}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {cat.subCategories.map((sub) => {
                                        const selected = currentSelection === sub;
                                        return (
                                          <button
                                            key={sub}
                                            onClick={() => {
                                              setBrandProfileSelections(prev => ({ ...prev, [cat.name]: selected ? '' : sub }));
                                              if (!selected) { setPurchaseToast(`${cat.name}: ${sub}`); setTimeout(() => setPurchaseToast(null), 2000); }
                                            }}
                                            style={{
                                              padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: selected ? 600 : 400,
                                              background: selected ? `${C.primary}15` : C.bg,
                                              border: `1px solid ${selected ? C.primary : C.border}`,
                                              color: selected ? C.primary : C.textSecondary,
                                              cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                          >
                                            {sub}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Barter / Exposure Toggle — server-side setting */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Collaboration Preferences
                  </div>
                  <div style={{
                    borderRadius: '12px',
                    border: `1px solid ${willingToBarter ? C.textSecondary : C.borderLight}`,
                    padding: '14px 16px',
                    backgroundColor: willingToBarter ? 'rgba(16,185,129,0.06)' : C.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>
                        Open to Free / Exposure / Barter
                      </div>
                      <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.4 }}>
                        Signal that you are willing to collaborate without monetary compensation. Visible on your profile and in marketplace search.
                      </div>
                    </div>
                    <button
                      onClick={() => setWillingToBarter(!willingToBarter)}
                      style={{
                        width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                        backgroundColor: willingToBarter ? C.textSecondary : 'rgba(255,255,255,0.15)',
                        cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s',
                      }}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
                        position: 'absolute', top: '2px', left: willingToBarter ? '22px' : '2px',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* ── CREATOR-ONLY SETTINGS ────────────────────── */}
                {marketplaceRole !== 'brand' && (<>

                {/* Availability */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Availability
                  </div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '12px', lineHeight: 1.4 }}>
                    You are assumed available for deals at all times. Set dates below only if you are taking a break.
                  </div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>Not available from</div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>From</div>
                        <input type="date" value={notAvailableFrom} onChange={e => setNotAvailableFrom(e.target.value)}
                          style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>To</div>
                        <input type="date" value={notAvailableTo} onChange={e => setNotAvailableTo(e.target.value)}
                          style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                    </div>
                    {(notAvailableFrom || notAvailableTo) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#f59e0b' }}>
                          You will appear as unavailable during this period.
                        </div>
                        <button onClick={() => { setNotAvailableFrom(''); setNotAvailableTo(''); }}
                          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '10px', color: C.textSecondary, cursor: 'pointer' }}>
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>


                {/* Location & Availability */}
                {(() => {
                  const [locOpen, setLocOpen] = [creatorSettingsOpen === 'location', () => setCreatorSettingsOpen(creatorSettingsOpen === 'location' ? null : 'location')];
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={setLocOpen} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Location & Availability</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{locOpen ? '▲' : '▼'}</span>
                      </button>
                      {locOpen && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>City</div><input placeholder="e.g. New York" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Country</div>
                              <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
                                style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }}>
                                {['Select...','United States','United Kingdom','Canada','Australia','India','Germany','France','Brazil','Japan','South Korea','Mexico','Spain','Italy','Netherlands','Sweden','Norway','Denmark','Finland','Switzerland','Austria','Belgium','Portugal','Ireland','New Zealand','Singapore','Philippines','Indonesia','Thailand','Vietnam','Malaysia','South Africa','Nigeria','Kenya','Egypt','UAE','Saudi Arabia','Turkey','Poland','Czech Republic','Romania','Ukraine','Russia','China','Taiwan','Argentina','Colombia','Chile','Peru','Israel','Pakistan','Bangladesh'].map(c => <option key={c} value={c === 'Select...' ? '' : c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Availability Hours</div><input placeholder="e.g. 9am–6pm EST" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                          {[['Willing to relocate', 'relocate'], ['Willing to travel', 'travel'], ['Available for live events', 'events']].map(([lbl]) => (
                            <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                              <span style={{ fontSize: '12px', color: C.text }}>{lbl}</span>
                              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: C.border, position: 'relative', cursor: 'pointer' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: '2px' }} /></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Identity & Content */}
                {(() => {
                  const open = creatorSettingsOpen === 'identity';
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'identity')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Identity & Content</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Age</div><input type="number" placeholder="25" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Gender</div>
                              <select style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }}>
                                {['Select...', 'Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => <option key={g}>{g}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Content Niche</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {['Fashion','Beauty','Tech','Finance','Fitness','Food','Travel','Gaming','Education','Lifestyle','Business','Health','Sports','Music','Art'].map(n => (
                                <span key={n} style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', background: C.bg, border: `1px solid ${C.border}`, color: C.textSecondary, cursor: 'pointer' }}>{n}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Content Format</div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {['Video','Photo','Text','Podcast','Live'].map(f => (
                                <span key={f} style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', background: C.bg, border: `1px solid ${C.border}`, color: C.textSecondary, cursor: 'pointer' }}>{f}</span>
                              ))}
                            </div>
                          </div>
                          <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Posting Frequency</div><input placeholder="e.g. 3x/week" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Audience */}
                {(() => {
                  const open = creatorSettingsOpen === 'audience';
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'audience')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Your Audience</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Age Range</div>
                              <select style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }}>
                                {['Select...','13-17','18-24','25-34','35-44','45-54','55+'].map(a => <option key={a}>{a}</option>)}
                              </select>
                            </div>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Country</div>
                              <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
                                style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }}>
                                {['Select...','United States','United Kingdom','Canada','Australia','India','Germany','France','Brazil','Japan','South Korea','Mexico','Spain','Italy','Netherlands','Sweden','Norway','Denmark','Finland','Switzerland','Austria','Belgium','Portugal','Ireland','New Zealand','Singapore','Philippines','Indonesia','Thailand','Vietnam','Malaysia','South Africa','Nigeria','Kenya','Egypt','UAE','Saudi Arabia','Turkey','Poland','Czech Republic','Romania','Ukraine','Russia','China','Taiwan','Argentina','Colombia','Chile','Peru','Israel','Pakistan','Bangladesh'].map(c => <option key={c} value={c === 'Select...' ? '' : c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginTop: '4px' }}><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Audience Languages (select all that apply)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {['English','Spanish','French','Hindi','Portuguese','Arabic','Mandarin','German','Japanese','Korean','Russian','Italian','Dutch','Swedish','Norwegian','Danish','Finnish','Polish','Turkish','Thai','Vietnamese','Indonesian','Malay','Filipino','Bengali','Tamil','Telugu','Urdu','Persian','Hebrew','Swahili','Greek','Czech','Romanian','Hungarian'].map(l => {
                                const active = selectedLanguages.includes(l);
                                return (
                                  <span key={l} onClick={() => setSelectedLanguages(prev => active ? prev.filter(x => x !== l) : [...prev, l])}
                                    style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
                                      background: active ? `${C.primary}20` : C.bg,
                                      border: `1px solid ${active ? C.primary : C.border}`,
                                      color: active ? C.primary : C.textSecondary,
                                      cursor: 'pointer', fontWeight: active ? 600 : 400,
                                      transition: 'all 0.15s' }}>{l}</span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Deal Preferences */}
                {(() => {
                  const open = creatorSettingsOpen === 'deals';
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'deals')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Deal Preferences</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Deal Type (select all that apply)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {['Paid','Gifted Product','Equity','Barter','Revenue Share','Ambassador','Licensing'].map(d => {
                                const active = profileDealTypes.includes(d);
                                return (
                                  <span key={d} onClick={() => setProfileDealTypes(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                                    style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px',
                                      background: active ? `${C.primary}20` : C.bg,
                                      border: `1px solid ${active ? C.primary : C.border}`,
                                      color: active ? C.primary : C.textSecondary,
                                      cursor: 'pointer', fontWeight: active ? 600 : 400,
                                      transition: 'all 0.15s',
                                    }}>{d}</span>
                                );
                              })}
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Min Deal (USD)</div><input type="number" placeholder="500" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                            <div><div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Response Time (hrs)</div><input type="number" placeholder="24" style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} /></div>
                          </div>
                          {([['Open to exclusivity', profileExclusivity, (v: boolean) => setProfileExclusivity(v)] as const,
                            ['Willing to sign NDA', profileNda, (v: boolean) => setProfileNda(v)] as const,
                            ['Grant usage rights', profileUsageRights, (v: boolean) => setProfileUsageRights(v)] as const,
                            ['On-camera willing', profileOnCamera, (v: boolean) => setProfileOnCamera(v)] as const,
                          ]).map(([lbl, val, setter]) => (
                            <div key={lbl} onClick={() => setter(!val)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
                              <span style={{ fontSize: '12px', color: C.text }}>{lbl}</span>
                              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: val ? C.primary : C.border, position: 'relative', transition: 'background 0.2s' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: val ? '18px' : '2px', transition: 'left 0.2s' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── SKIN SHOWCASE ─────────────────────────── */}
                {(() => {
                  const open = creatorSettingsOpen === ('showcase' as any);
                  const ownedSkinsList = Object.entries(valueSkins).filter(([, v]) => v?.profession).map(([, v]) => v!.profession);
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'showcase' as any)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Skin Showcase</span>
                          {creatorSkinMode === 'showcase' && <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', background: C.primary, padding: '1px 6px', borderRadius: '8px' }}>LIVE</span>}
                        </div>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                            When showcase mode is on, brands see your video pitch and bio when they click your ValueSkin on your profile.
                          </div>

                          {/* Mode toggle */}
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                            <button onClick={() => setCreatorSkinMode('static')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: creatorSkinMode === 'static' ? C.primary : C.bg, color: creatorSkinMode === 'static' ? '#fff' : C.textSecondary, border: `1px solid ${creatorSkinMode === 'static' ? C.primary : C.border}` }}>Static</button>
                            <button onClick={() => setCreatorSkinMode('showcase')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: creatorSkinMode === 'showcase' ? C.primary : C.bg, color: creatorSkinMode === 'showcase' ? '#fff' : C.textSecondary, border: `1px solid ${creatorSkinMode === 'showcase' ? C.primary : C.border}` }}>Showcase</button>
                          </div>

                          {creatorSkinMode === 'showcase' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {ownedSkinsList.length === 0 ? (
                                <div style={{ fontSize: '12px', color: C.textMuted, textAlign: 'center', padding: '16px' }}>Get a ValueSkin to add your pitch</div>
                              ) : ownedSkinsList.map(skinName => {
                                const hasPitch = skinPitchTexts[skinName] || skinPitchVideos[skinName]?.url;
                                const badge = PROFESSION_BADGES[skinName];
                                return (
                                  <div key={skinName} onClick={() => setShowSkinShowcaseModal(skinName)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}>
                                    {getStickerForProfession(skinName) ? (
                                      <img src={getStickerForProfession(skinName)!} alt={skinName} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                    ) : (
                                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: `${badge?.color ?? C.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: badge?.color ?? C.primary }}>{badge?.abbreviation ?? '?'}</div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{skinName}</div>
                                      <div style={{ fontSize: '10px', color: hasPitch ? C.success : C.textMuted }}>{hasPitch ? 'Pitch added' : 'No pitch yet'}</div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>{hasPitch ? 'Edit' : 'Add'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── INBOX & SAFETY ─────────────────────────── */}
                <div style={{ marginBottom: '16px' }}>
                  <button onClick={() => setCreatorShowSafetySettings(p => !p)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: creatorShowSafetySettings ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Inbox & Safety</span>
                    </div>
                    <span style={{ fontSize: '14px', color: C.textMuted }}>{creatorShowSafetySettings ? '▲' : '▼'}</span>
                  </button>
                  {creatorShowSafetySettings && (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>

                      {/* Filter by brand niche */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Only accept proposals from these brand niches</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {['Tech', 'Fashion', 'Finance', 'Health', 'Food', 'Gaming', 'Travel', 'Beauty', 'Fitness', 'Education'].map(n => {
                            const active = creatorAllowedNiches.includes(n);
                            return (
                              <button key={n} onClick={() => setCreatorAllowedNiches(prev => active ? prev.filter(x => x !== n) : [...prev, n])}
                                style={{ padding: '3px 9px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                                  background: active ? `${C.primary}20` : C.bg,
                                  color: active ? C.primary : C.textSecondary,
                                  border: `1px solid ${active ? C.primary : C.border}`,
                                }}>{n}</button>
                            );
                          })}
                        </div>
                        {creatorAllowedNiches.length === 0 && (
                          <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '4px' }}>None selected = all niches allowed</div>
                        )}
                      </div>

                      {/* Blocked brands */}
                      <div style={{ marginBottom: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Blocked Brands</div>
                        {creatorBlockedBrands.length === 0 ? (
                          <div style={{ fontSize: '11px', color: C.textMuted, padding: '8px', background: C.bg, borderRadius: '7px', textAlign: 'center' }}>No brands blocked</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {creatorBlockedBrands.map(b => (
                              <span key={b} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: C.textMuted, border: '1px solid rgba(239,68,68,0.2)' }}>
                                {b}
                                <button onClick={() => setCreatorBlockedBrands(prev => prev.filter(x => x !== b))} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <button onClick={() => { const name = prompt('Block brand name:'); if (name?.trim()) setCreatorBlockedBrands(prev => [...prev, name.trim()]); }}
                          style={{ marginTop: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'transparent', border: `1px solid ${C.border}`, color: C.textSecondary, cursor: 'pointer' }}>
                          + Block a brand
                        </button>
                      </div>

                      {/* Info bar */}
                      <div style={{ marginTop: '12px', padding: '9px 11px', background: 'rgba(0,102,204,0.05)', borderRadius: '7px', fontSize: '10px', color: C.textSecondary, lineHeight: 1.6 }}>
                        Platform-level limits set by Meta also apply and cannot be turned off by you. These are your <em>personal</em> controls on top.
                      </div>
                    </div>
                  )}
                </div>

                {/* ── RATE CARD ──────────────────────────────────── */}
                {adminShowRateCard && (() => {
                  const open = creatorSettingsOpen === ('ratecard' as any);
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'ratecard' as any)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Rate Card</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ fontSize: '10px', color: C.textSecondary, marginBottom: '10px' }}>Set your price per content format. These are shown to brands before they send a proposal.</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            {(Object.keys(rateCard) as Array<keyof typeof rateCard>).map(fmt => (
                              <div key={fmt}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'capitalize' }}>{fmt}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ color: C.textSecondary, fontSize: '12px' }}>$</span>
                                  <input type="number" value={rateCard[fmt]} onChange={e => setRateCard(prev => ({ ...prev, [fmt]: e.target.value }))}
                                    style={{ width: '100%', padding: '6px 7px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Contract Mode</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {(['one-off', 'long-term', 'both'] as const).map(m => (
                                  <button key={m} onClick={() => setContractMode(m)} style={{ flex: 1, padding: '5px 3px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                                    background: contractMode === m ? `${C.primary}20` : C.bg, color: contractMode === m ? C.primary : C.textSecondary, border: `1px solid ${contractMode === m ? C.primary : C.border}` }}>{m}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Max Active Deals</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button onClick={() => setCreatorMaxActiveDeals(Math.max(1, creatorMaxActiveDeals - 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontWeight: 700 }}>−</button>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: C.primary, minWidth: '20px', textAlign: 'center' }}>{creatorMaxActiveDeals}</span>
                                <button onClick={() => setCreatorMaxActiveDeals(Math.min(20, creatorMaxActiveDeals + 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontWeight: 700 }}>+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── AVAILABILITY CALENDAR ──────────────────────── */}
                {adminShowAvailabilityCalendar && (() => {
                  const open = creatorSettingsOpen === ('availability' as any);
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'availability' as any)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Availability Calendar</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Available for new deals from</div>
                            <input type="date" value={creatorAvailableFrom} onChange={e => setCreatorAvailableFrom(e.target.value)}
                              style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>Open to first-deal (discounted collab)</div>
                              <div style={{ fontSize: '10px', color: C.textSecondary }}>Badge shown to brands — signals you'll do a discounted first collab to build your record</div>
                            </div>
                            <button onClick={() => setIsFirstDealOpen(p => !p)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: isFirstDealOpen ? C.primary : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '2px', left: isFirstDealOpen ? '20px' : '2px', transition: 'left 0.2s' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── DEAL STRUCTURE DEFAULTS ────────────────────── */}
                {(() => {
                  const open = creatorSettingsOpen === ('dealstructure' as any);
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <button onClick={() => setCreatorSettingsOpen(open ? null : 'dealstructure' as any)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Deal Structure Defaults</span>
                        <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Revision Limit</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button onClick={() => setRevisionLimit(Math.max(0, revisionLimit - 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontWeight: 700 }}>−</button>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: C.primary, minWidth: '20px', textAlign: 'center' }}>{revisionLimit}</span>
                                <button onClick={() => setRevisionLimit(Math.min(10, revisionLimit + 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontWeight: 700 }}>+</button>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Usage Rights (days)</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {[30, 60, 90, 180].map(d => (
                                  <button key={d} onClick={() => setUsageRightsDays(d)} style={{ flex: 1, padding: '5px 2px', borderRadius: '5px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                                    background: usageRightsDays === d ? `${C.primary}20` : C.bg, color: usageRightsDays === d ? C.primary : C.textMuted, border: `1px solid ${usageRightsDays === d ? C.primary : C.border}` }}>{d}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Exclusivity locked until</div>
                            <input type="date" value={exclusivityUntil} onChange={e => setExclusivityUntil(e.target.value)} placeholder="Leave blank if not exclusive"
                              style={{ width: '100%', padding: '7px 9px', background: C.bg, border: `1px solid ${exclusivityUntil ? C.textMuted : C.border}`, borderRadius: '7px', color: C.text, fontSize: '12px', boxSizing: 'border-box' as const }} />
                            {exclusivityUntil && <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '3px' }}>Brands will see &quot;Exclusivity taken until {exclusivityUntil}&quot;</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ padding: '14px', background: 'rgba(0,102,204,0.06)', borderRadius: '10px', textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                    Settings are synced to your profile and marketplace presence. Changes take effect immediately.
                  </div>
                </div>

                {/* Profile Completeness */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Profile Completeness
                  </div>
                  {(() => {
                    const hasAvatar = true;
                    const hasBio = true;
                    const hasValueSkin = Object.values(valueSkins).some(Boolean);
                    const hasDealPrefs = profileDealTypes.length > 0;
                    const hasCredential = false;
                    const hasTestimonial = false;
                    const hasBarterPref = true;
                    const hasEnergy = Boolean(creatorEnergy);
                    const score =
                      (hasAvatar ? 15 : 0) + (hasBio ? 15 : 0) + (hasValueSkin ? 20 : 0) +
                      (hasDealPrefs ? 10 : 0) + (hasCredential ? 15 : 0) + (hasTestimonial ? 15 : 0) +
                      (hasBarterPref ? 5 : 0) + (hasEnergy ? 5 : 0);
                    const tier = score >= 90 ? 'Elite' : score >= 70 ? 'Established' : score >= 40 ? 'Developing' : 'Incomplete';
                    const tierColor = score >= 90 ? '#f59e0b' : score >= 70 ? '#22c55e' : score >= 40 ? C.primary : C.textMuted;
                    const items = [
                      { label: 'Avatar', done: hasAvatar, pts: 15 },
                      { label: 'Bio', done: hasBio, pts: 15 },
                      { label: 'ValueSkin', done: hasValueSkin, pts: 20 },
                      { label: 'Deal Preferences', done: hasDealPrefs, pts: 10 },
                      { label: 'Credential', done: hasCredential, pts: 15 },
                      { label: 'Testimonial', done: hasTestimonial, pts: 15 },
                      { label: 'Barter Pref', done: hasBarterPref, pts: 5 },
                      { label: 'Availability', done: hasEnergy, pts: 5 },
                    ];
                    return (
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: tierColor }}>{score}<span style={{ fontSize: '13px', fontWeight: 600, color: C.textSecondary }}>/100</span></div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: tierColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tier}</div>
                          </div>
                          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `conic-gradient(${tierColor} ${score * 3.6}deg, ${C.border} 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: tierColor }}>{score}</div>
                          </div>
                        </div>
                        <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' }}>
                          <div style={{ height: '100%', width: `${score}%`, background: tierColor, borderRadius: '2px', transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                          {items.map(({ label, done, pts }) => (
                            <div key={label} style={{ padding: '6px 4px', background: done ? 'rgba(34,197,94,0.08)' : C.surfaceAlt, borderRadius: '6px', textAlign: 'center', border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : C.border}` }}>
                              <div style={{ fontSize: '14px', marginBottom: '2px' }}>{done ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5.5,10.5 12,3.5"/></svg> : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={C.textMuted} strokeWidth="1.5"><circle cx="7" cy="7" r="5.5"/></svg>}</div>
                              <div style={{ fontSize: '9px', fontWeight: 600, color: done ? '#22c55e' : C.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                              <div style={{ fontSize: '9px', color: C.textMuted }}>+{pts}pt</div>
                            </div>
                          ))}
                        </div>
                        {!hasCredential && (
                          <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '11px', color: '#f59e0b' }}>
                            Next: Link a credential (LinkedIn/Twitter) to earn +15 pts
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ── PORTFOLIO IMAGE ────────────────────────────── */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Why Brands Should Hire You
                  </div>
                  {portfolioImage ? (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '200px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={portfolioImage} alt="Portfolio" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt: any) => setPortfolioImage(evt.target.result);
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        >
                          Change Photo
                        </button>
                        <button
                          onClick={() => setPortfolioImage(null)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: `${C.danger}15`, border: `1px solid ${C.danger}40`, color: C.danger }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '12px' }}>
                        Upload a photo showing why brands should hire you. This appears on your creator profile.
                      </div>
                      <button
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt: any) => setPortfolioImage(evt.target.result);
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: C.primary, border: 'none', color: '#fff' }}
                      >
                        Upload Photo
                      </button>
                    </div>
                  )}
                </div>

                </>)}
                {/* ── END CREATOR-ONLY SETTINGS ──────────────────── */}

                {/* GDPR Data Controls */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Privacy & Data Controls
                  </div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                    {[
                      { label: 'Download My Data', sub: 'Export all your data in JSON format', action: () => alert('Data export initiated — you will receive an email with download link within 24 hours'), color: C.primary, icon: 'DL' },
                      { label: 'Request Data Deletion', sub: 'Permanently erase your account (GDPR Art. 17) — 30 day process', action: () => alert('Data deletion request submitted.\n\nYour account will be anonymized within 30 days as required by GDPR.\nYou can cancel this request within 24 hours.'), color: C.textMuted, icon: 'DEL' },
                    ].map(({ label, sub, action, color, icon }, i) => (
                      <div
                        key={label}
                        onClick={action}
                        style={{
                          padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                          borderBottom: i === 0 ? `1px solid ${C.border}` : 'none',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '16px' }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color }}>{label}</div>
                          <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '1px' }}>{sub}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────── */}

      {showLevelModal && (
        <Modal onClose={() => setShowLevelModal(false)}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: C.text }}>How Skin Levels Work</h2>
          <p style={{ color: C.textSecondary, marginBottom: '12px', fontSize: '14px', lineHeight: 1.5 }}>
            Each ValueSkin levels up independently based on your activity within that skin. Followers do not determine skill.
          </p>
          {ownedSkins.length === 1 && (
            <div style={{ background: 'rgba(0,102,204,0.06)', border: `1px solid rgba(0,102,204,0.2)`, borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>
              Since you have a single ValueSkin, your follower count contributes bonus XP — your audience is clearly about this one skin.
            </div>
          )}
          {ownedSkins.length > 1 && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>
              With multiple ValueSkins, followers are not factored — they cannot be attributed to a specific skin.
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>XP Sources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {[
              { action: 'Deal completed', xp: '100+ XP', desc: 'Scales with deal value' },
              { action: 'Community joined', xp: '25 XP', desc: 'Skin-gated communities' },
              { action: 'Community message', xp: '5 XP', desc: 'Active participation' },
              { action: 'DM sent', xp: '2 XP', desc: 'Networking engagement' },
              ...(ownedSkins.length === 1 ? [{ action: 'Follower bonus', xp: 'Variable', desc: 'Only with 1 skin equipped' }] : []),
            ].map(s => (
              <div key={s.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.surfaceAlt, borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{s.action}</div>
                  <div style={{ fontSize: '10px', color: C.textMuted }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.primary }}>{s.xp}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Level Thresholds</div>
          {[
            { level: 1, name: 'Newcomer', xp: '0 XP' },
            { level: 2, name: 'Active', xp: '50 XP' },
            { level: 3, name: 'Established', xp: '200 XP' },
            { level: 4, name: 'Expert', xp: '500 XP' },
            { level: 5, name: 'Authority', xp: '1,000 XP' },
          ].map(t => (
            <div key={t.level} style={{ background: C.surfaceAlt, padding: '12px 14px', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderLeft: ownedSkins.some(s => getSkinLevel(s.profession, metrics.followers, ownedSkins.length) === t.level) ? `4px solid ${C.primary}` : '4px solid transparent' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: C.text }}>Level {t.level}: {t.name}</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted }}>{t.xp}</span>
            </div>
          ))}
          {/* Per-skin status */}
          {ownedSkins.length > 0 && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '8px' }}>Your Skins</div>
              {ownedSkins.map(({ profession }) => {
                const level = getSkinLevel(profession, metrics.followers, ownedSkins.length);
                const progress = getSkinXPProgress(profession, metrics.followers, ownedSkins.length);
                const badge = PROFESSION_BADGES[profession];
                const color = badge?.color ?? C.primary;
                return (
                  <div key={profession} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: C.card, borderRadius: '12px', marginBottom: '6px', border: `1px solid ${C.border}` }}>
                    {getStickerForProfession(profession) ? (
                      <img src={getStickerForProfession(profession)!} alt={profession} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color }}>{badge?.abbreviation ?? '?'}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{profession}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color }}>Lv.{level}</span>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: C.border, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: color, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '9px', color: C.textMuted }}>{progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Modal>
      )}

      {showMetricsModal && (
        <Modal onClose={() => setShowMetricsModal(false)}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: C.text }}>Edit Your Metrics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MetricInput label="Followers" value={metrics.followers} onChange={(v) => updateMetric('followers', v)} />
            <MetricInput label="Engagement Rate (%)" value={metrics.engagement} onChange={(v) => updateMetric('engagement', v)} />
            <MetricInput label="Deals Completed" value={metrics.dealsCompleted} onChange={(v) => updateMetric('dealsCompleted', v)} />
            <MetricInput label="Average Deal Value ($)" value={metrics.avgDealValue} onChange={(v) => updateMetric('avgDealValue', v)} />
            <MetricInput label="On-Time Rate (%)" value={metrics.onTimeRate} onChange={(v) => updateMetric('onTimeRate', v)} />
            <MetricInput label="Brand Rating" value={metrics.brandRating} onChange={(v) => updateMetric('brandRating', v)} />
          </div>
          <div style={{ background: C.primary, borderRadius: '12px', padding: '16px', marginTop: '20px', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Highest Skin Level</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>LEVEL {currentLevel}</div>
            {ownedSkins.length === 1 && <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>Followers contribute to XP with 1 skin</div>}
            {ownedSkins.length > 1 && <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>Followers excluded — multiple skins equipped</div>}
          </div>
        </Modal>
      )}

      {showReputationModal && (() => {
        const totalMax = factors.reduce((sum, f) => sum + f.maxPoints, 0);
        const score = 847;
        const pct = Math.round((score / totalMax) * 100);
        // Simulated per-factor scores
        const factorScores: Record<string, number> = {
          'Content Consistency': 82,
          'Audience Engagement': 91,
          'Brand Partnerships': 78,
          'On-time Delivery': 99,
          'Community Trust': 85,
          'Profile Completeness': 95,
        };
        return (
          <Modal onClose={() => setShowReputationModal(false)}>
            {/* Score header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Reputation Score</div>
              <div style={{ fontSize: '42px', fontWeight: 800, color: C.primary, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '4px' }}>out of {totalMax} possible points</div>
              <div style={{ height: '6px', background: C.border, borderRadius: '3px', overflow: 'hidden', margin: '14px 0 0' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: C.primary, borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.textMuted, marginTop: '4px', fontWeight: 600 }}>
                <span>0</span>
                <span style={{ color: pct >= 80 ? C.success : C.textSecondary }}>Top {100 - pct + 3}% of creators</span>
                <span>{totalMax}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: 'Level', value: `${currentLevel}`, sub: 'of 5' },
                { label: 'Deals', value: `${metrics.dealsCompleted}`, sub: 'completed' },
                { label: 'Avg Deal', value: `$${Math.round(metrics.avgDealValue / 1000)}k`, sub: 'per deal' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: C.surfaceAlt, borderRadius: '10px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '4px' }}>{s.sub}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Factor breakdown */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Score Breakdown</div>
            {factors.map((factor) => {
              const earned = factorScores[factor.name] ?? Math.round(factor.maxPoints * 0.8);
              const fillPct = Math.round((earned / factor.maxPoints) * 100);
              return (
                <div key={factor.name} style={{ background: C.surfaceAlt, padding: '14px', borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{factor.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning }}>{earned}</span>
                      <span style={{ fontSize: '11px', color: C.textMuted }}>/{factor.maxPoints}</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning, borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,102,204,0.06)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.textSecondary, lineHeight: 1.5 }}>
                Scores are computed from verified engagement data, transaction history, and peer attestations. Updated every 24 hours.
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Store Modal — shows only the selected category's professions */}
      {showStoreModal && (assigningSlot || marketplaceRole === 'brand') && storeCategory && (PROFESSIONS as Record<string, typeof PROFESSIONS[keyof typeof PROFESSIONS]>)[storeCategory] && (
        <Modal onClose={() => { setShowStoreModal(false); setStoreCategory(null); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: C.text, margin: 0 }}>{storeCategory}</h2>
            {assigningSlot && marketplaceRole !== 'brand' && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: SLOT_COLORS[assigningSlot], background: `${SLOT_COLORS[assigningSlot]}20`, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                {SLOT_LABELS[assigningSlot]}
              </span>
            )}
            {marketplaceRole === 'brand' && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: C.textSecondary, background: C.surfaceAlt, padding: '3px 8px', borderRadius: '6px' }}>
                {brandValueSkins.length}/3 slots
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px' }}>
            {marketplaceRole === 'brand'
              ? 'Tap any profession to add it to your brand ValueSkins ($10).'
              : `Tap any badge to purchase ($10) and instantly apply it to your ${assigningSlot ? SLOT_LABELS[assigningSlot].toLowerCase() : ''} slot.`}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {(PROFESSIONS as Record<string, typeof PROFESSIONS[keyof typeof PROFESSIONS]>)[storeCategory].subProfessions.map((sub) => {
              const defined = PROFESSION_BADGES[sub];
              const isBrand = marketplaceRole === 'brand';
              const abbr = defined?.abbreviation ?? sub.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
              const badgeColor = defined?.color ?? (assigningSlot ? SLOT_COLORS[assigningSlot] : C.primary);
              const stickerSrc = defined?.stickerImage || STICKER_MANIFEST[sub];
              const isOwned = isBrand && brandValueSkins.includes(sub);
              const isActiveHere = !isBrand && assigningSlot && valueSkins[assigningSlot]?.profession === sub;
              const isUsedElsewhere = !isBrand && !isActiveHere && assignedProfessions.has(sub);
              const isFull = isBrand && brandValueSkins.length >= 3 && !isOwned;
              const disabled = isUsedElsewhere || isFull;
              return (
                <button
                  key={sub}
                  onClick={() => !disabled && purchaseProfession(sub)}
                  disabled={!!disabled}
                  style={{
                    background: (isActiveHere || isOwned) ? 'rgba(0,102,204,0.08)' : C.card,
                    border: `1px solid ${(isActiveHere || isOwned) ? C.primary : C.border}`,
                    borderRadius: '12px', color: disabled ? C.textMuted : C.text,
                    padding: '12px', fontSize: '13px',
                    cursor: disabled ? 'default' : 'pointer',
                    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    opacity: disabled ? 0.45 : 1, position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (!disabled && !isActiveHere && !isOwned) { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.surfaceAlt; } }}
                  onMouseLeave={(e) => { if (!isActiveHere && !isOwned) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; } }}
                >
                  {/* Skin sticker from auto-generated manifest, abbreviation fallback */}
                  {stickerSrc ? (
                    <img src={stickerSrc} alt={sub} style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '8px' }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: `${badgeColor}20`, border: `1px solid ${badgeColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: badgeColor, fontSize: '16px', fontWeight: 800 }}>
                      {abbr}
                    </div>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{sub}</span>
                  {(isActiveHere || isOwned) && (
                    <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={C.primary} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="16 9 10.5 15 8 12.5" />
                      </svg>
                    </div>
                  )}
                  {isUsedElsewhere && (
                    <span style={{ fontSize: '10px', color: C.textMuted, position: 'absolute', top: '6px', right: '6px' }}>used</span>
                  )}
                  {isFull && (
                    <span style={{ fontSize: '10px', color: C.textMuted, position: 'absolute', top: '6px', right: '6px' }}>full</span>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Brand Store Modal */}
      {/* Brand Store Modal — this is now unused since brands buy skins from the main store like creators */}

      {/* ValueSkin Management Modal */}
      {showSkinManageModal && (
        <SkinManagementModal
          slot={showSkinManageModal}
          onClose={() => setShowSkinManageModal(null)}
          valueSkins={valueSkins}
          hiddenSkins={hiddenSkins}
          onHide={(slot) => {
            setHiddenSkins(prev => new Set([...prev, slot]));
            setPurchaseToast(`${SLOT_LABELS[slot]} ValueSkin hidden from marketplace`);
            setTimeout(() => setPurchaseToast(null), 3000);
          }}
          onUnhide={(slot) => {
            setHiddenSkins(prev => {
              const next = new Set(prev);
              next.delete(slot);
              return next;
            });
            setPurchaseToast(`${SLOT_LABELS[slot]} ValueSkin restored to marketplace`);
            setTimeout(() => setPurchaseToast(null), 3000);
          }}
          onDelete={(slot) => {
            setValueSkins(prev => {
              const next = { ...prev };
              delete next[slot];
              return next;
            });
            setHiddenSkins(prev => {
              const next = new Set(prev);
              next.delete(slot);
              return next;
            });
            setPurchaseToast(`${SLOT_LABELS[slot]} ValueSkin permanently deleted`);
            setTimeout(() => setPurchaseToast(null), 3000);
          }}
        />
      )}

      {/* ── EVENTS VIEW ──────────────────────────── */}
      {activeView === 'events' && (
        <EventManagementPage />
      )}

      {/* Bottom Tab Bar */}
      {activeView !== 'events' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: C.surface, borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'stretch',
        }}>
          {([
            { label: 'Profile', view: 'profile' as const },
            { label: 'Market', view: 'mim' as const },
            { label: 'Store', view: 'store' as const },
            { label: 'Messages', view: 'messages' as const },
            { label: 'Settings', view: 'settings' as const },
          ]).map(({ label, view }) => (
            <button
              key={view}
              onClick={() => {
                if (view === 'mim') { setMarketplaceRole('none'); }
                if (view === 'messages') { setActiveCommunity(null); setActiveDmId(null); }
                setActiveView(view);
              }}
              style={{
                flex: 1, minHeight: '44px', background: 'none', border: 'none',
                color: activeView === view ? C.primary : C.textMuted,
                fontSize: '10px', fontWeight: activeView === view ? 700 : 500,
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '2px',
                padding: '6px 2px',
              }}
            >
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: activeView === view ? C.primary : 'transparent' }} />
              {label}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function NavItem({ label, active, onClick, badgeCount }: { label: string; active: boolean; onClick: () => void; badgeCount?: number }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'transparent', border: 'none', borderRadius: '10px', padding: '12px 14px', color: active ? C.text : C.textSecondary, fontWeight: active ? 700 : 400, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s', width: '100%', justifyContent: 'flex-start', position: 'relative' }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = C.text; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = C.textSecondary; } }}
    >
      <span>{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span style={{ minWidth: '18px', height: '18px', borderRadius: '9px', background: C.danger, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{badgeCount}</span>
      )}
    </button>
  );
}

function SkinManagementModal({ slot, onClose, valueSkins, hiddenSkins, onHide, onUnhide, onDelete }: { slot: ValueSkinSlot; onClose: () => void; valueSkins: ValueSkinMap; hiddenSkins: Set<ValueSkinSlot>; onHide: (slot: ValueSkinSlot) => void; onUnhide: (slot: ValueSkinSlot) => void; onDelete: (slot: ValueSkinSlot) => void }) {
  const skin = valueSkins[slot];
  if (!skin) return null;

  const isHidden = hiddenSkins.has(slot);
  const SLOT_LABELS: Record<ValueSkinSlot, string> = { profession: 'Professional', passion: 'Passion', hobby: 'Hobby' };
  const SLOT_COLORS: Record<ValueSkinSlot, string> = { profession: '#0095F6', passion: '#880E4F', hobby: '#37474F' };

  return (
    <Modal onClose={onClose}>
      <div style={{ paddingBottom: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: C.text }}>
          Manage {SLOT_LABELS[slot]} ValueSkin
        </div>

        {/* Current skin info */}
        <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '14px', marginBottom: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: SLOT_COLORS[slot], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
              {SLOT_LABELS[slot].substring(0, 3).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{skin.profession}</div>
              <div style={{ fontSize: '11px', color: C.textMuted }}>{isHidden ? 'Hidden' : 'Visible'}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Hide/Unhide button */}
          <button
            onClick={() => { isHidden ? onUnhide(slot) : onHide(slot); onClose(); }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.text,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isHidden ? 'Restore visibility' : 'Hide temporarily'}
            <span style={{ fontSize: '12px', color: C.textMuted }}>
              {isHidden ? '(Appears in profile)' : '(Hidden from discovery)'}
            </span>
          </button>

          {/* Delete button */}
          <button
            onClick={() => {
              if (window.confirm('Permanently delete this ValueSkin? This cannot be undone and no refund will be issued.')) {
                onDelete(slot);
                onClose();
              }
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #D32F2F',
              background: 'rgba(211, 47, 47, 0.08)',
              color: '#D32F2F',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            Delete permanently
            <span style={{ fontSize: '12px', color: 'rgba(211, 47, 47, 0.7)' }}>(No refund)</span>
          </button>

          {/* Info */}
          <div style={{ fontSize: '11px', color: C.textMuted, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', lineHeight: 1.5 }}>
            <strong>Hide:</strong> Temporarily remove from marketplace/communities (reversible)<br />
            <strong>Delete:</strong> Permanently remove (irreversible, no refund)
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px', padding: '24px', maxWidth: '500px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: C.textMuted, fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        {children}
      </div>
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>{label}</label>
      <input
        type="text" value={value.toLocaleString()}
        onChange={(e) => onChange(e.target.value.replace(/,/g, ''))}
        style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = C.primary; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
      />
    </div>
  );
}

// Legacy calculateLevel — engagement and deal value only, views/followers excluded
function calculateLevel(metrics: any, levels: any): number {
  for (let level = 5; level >= 1; level--) {
    const t = levels[level];
    if (metrics.engagement >= t.engagement && metrics.avgDealValue >= t.dealValue) return level;
  }
  return 1;
}
