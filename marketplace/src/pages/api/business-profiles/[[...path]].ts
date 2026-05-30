import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUserId } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const backendAvailable = false;

// ── In-memory stores ──

interface MockProfile {
  id: string;
  accountId: string;
  businessName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  googleMapsUrl: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  socialLinks: { platform: string; url: string }[];
  venuePhotos: string[];
  capacity: number;
  parkingInfo: string;
  amenities: string[];
  dressCodeDefault: string;
  ageRestrictionDefault: number;
  venuePolicies: string;
  musicPreferences: string[];
  defaultTags: string[];
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MockTemplate {
  id: string;
  businessProfileId: string;
  name: string;
  description: string;
  category: string;
  isRecurring: boolean;
  recurrenceType: string;
  recurrenceConfig: any;
  templateData: any;
  sortOrder: number;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockPromoter {
  id: string;
  businessProfileId: string;
  accountId: string | null;
  name: string;
  email: string;
  phone: string;
  promoterType: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface MockCommission {
  id: string;
  promoterId: string;
  eventId: string | null;
  commissionType: string;
  fixedAmountCents: number;
  percentageRate: number;
  tierConfig: any[];
  maxPayoutCents: number;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MockReferralLink {
  id: string;
  promoterId: string;
  eventId: string;
  referralCode: string;
  referralUrl: string;
  promoCode: string;
  qrCodeUrl: string;
  uniqueClicks: number;
  ticketSales: number;
  revenueCents: number;
  conversions: number;
  refunds: number;
  createdAt: string;
  updatedAt: string;
}

interface MockPayout {
  id: string;
  businessProfileId: string;
  eventId: string | null;
  amountCents: number;
  feeCents: number;
  promoterCommissionCents: number;
  netAmountCents: number;
  status: string;
  paymentMethod: string;
  paymentRef: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const profiles: MockProfile[] = [];
const templates: MockTemplate[] = [];
const promoters: MockPromoter[] = [];
const commissions: MockCommission[] = [];
const referralLinks: MockReferralLink[] = [];
const payouts: MockPayout[] = [];

const DEV_ACCOUNT_ID = 'dev-user';
const DEV_PROFILE_ID = 'prof-dev-venue-1';

// Bootstrap a dev profile
if (profiles.length === 0) {
  profiles.push({
    id: DEV_PROFILE_ID,
    accountId: DEV_ACCOUNT_ID,
    businessName: 'Club XYZ',
    logoUrl: null,
    coverImageUrl: null,
    description: 'Premium nightlife destination in the heart of the city. Known for curated music experiences and unforgettable nights.',
    address: '42 Sunset Boulevard',
    city: 'Los Angeles',
    state: 'CA',
    country: 'US',
    googleMapsUrl: 'https://maps.google.com/?q=42+Sunset+Boulevard+LA',
    contactPhone: '+1 (310) 555-0142',
    contactEmail: 'bookings@clubxyz.com',
    website: 'https://clubxyz.com',
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com/clubxyz' },
      { platform: 'twitter', url: 'https://twitter.com/clubxyz' },
    ],
    venuePhotos: [],
    capacity: 500,
    parkingInfo: 'Valet parking available. Self-park at lot across the street.',
    amenities: ['VIP Section', 'Full Bar', 'Smoke Room', 'Dance Floor', 'Outdoor Terrace'],
    dressCodeDefault: 'Upscale casual. No sportswear or flip-flops.',
    ageRestrictionDefault: 21,
    venuePolicies: 'Management reserves the right to refuse entry. No refunds for ejected guests.',
    musicPreferences: ['House', 'Techno', 'Bollywood', 'Hip-Hop'],
    defaultTags: ['nightclub', 'dance', 'premium', 'cocktails', 'live-dj'],
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  promoters.push({
    id: 'promo-dev-1',
    businessProfileId: DEV_PROFILE_ID,
    accountId: null,
    name: 'DJ Rahul',
    email: 'rahul@example.com',
    phone: '+1 (310) 555-1001',
    promoterType: 'influencer',
    status: 'active',
    notes: 'Top performer. Brings 50+ per event.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, {
    id: 'promo-dev-2',
    businessProfileId: DEV_PROFILE_ID,
    accountId: null,
    name: 'Maya Singh',
    email: 'maya@example.com',
    phone: '+1 (310) 555-1002',
    promoterType: 'student_ambassador',
    status: 'active',
    notes: 'College outreach.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  templates.push({
    id: 'tmpl-dev-1',
    businessProfileId: DEV_PROFILE_ID,
    name: 'Friday Techno Night',
    description: 'Weekly techno party with featured DJs.',
    category: 'party',
    isRecurring: true,
    recurrenceType: 'weekly',
    recurrenceConfig: { dayOfWeek: 5 },
    templateData: {
      eventName: 'Friday Techno Night',
      eventCategory: 'party',
      eventType: 'in-person',
      oneLineSummary: 'The ultimate weekly techno experience',
      dressCode: 'Upscale casual',
      musicGenre: 'Techno',
      energyLevel: 'high',
      ageRestriction: 21,
    },
    sortOrder: 0,
    useCount: 12,
    lastUsedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function ok(res: NextApiResponse, data: any) { return res.status(200).json(data); }
function created(res: NextApiResponse, data: any) { return res.status(201).json(data); }
function noContent(res: NextApiResponse) { return res.status(204).end(); }
function bad(res: NextApiResponse, msg: string) { return res.status(400).json({ error: msg }); }
function notFound(res: NextApiResponse) { return res.status(404).json({ error: 'Not found' }); }
function unauthorized(res: NextApiResponse) { return res.status(401).json({ error: 'Unauthorized' }); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, ...queryParams } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : (path ?? '');
  const cookie = req.headers.cookie || '';
  const sessionUser = await getSessionUserId(cookie);

  if (!sessionUser) return unauthorized(res);

  if (backendAvailable) {
    try {
      const url = new URL(`${BACKEND_URL}/api/v1/business-profiles/${pathStr}`);
      Object.entries(queryParams).forEach(([k, v]) => { if (typeof v === 'string') url.searchParams.set(k, v); });
      const body = req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined;
      const backendRes = await fetch(url.toString(), {
        method: req.method,
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body,
      });
      const data = backendRes.headers.get('content-type')?.includes('application/json')
        ? await backendRes.json() : await backendRes.text();
      const setCookie = backendRes.headers.get('set-cookie');
      if (setCookie) res.setHeader('Set-Cookie', setCookie);
      return res.status(backendRes.status).json(data);
    } catch { /* fall through */ }
  }

  const parts = pathStr.split('/');
  const resourceId = parts[0];
  const subResource = parts[1];
  const subId = parts[2];
  const action = parts[3];

  // ── Profiles ──

  // GET /business-profiles — list all
  if (req.method === 'GET' && !pathStr) {
    return ok(res, { profiles });
  }

  // GET /business-profiles/mine
  if (req.method === 'GET' && pathStr === 'mine') {
    const profile = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    return profile ? ok(res, profile) : notFound(res);
  }

  // POST /business-profiles
  if (req.method === 'POST' && !pathStr) {
    const body = req.body;
    if (!body || !body.businessName) return bad(res, 'businessName is required');
    const existing = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    if (existing) return bad(res, 'Profile already exists');
    const profile: MockProfile = {
      id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accountId: DEV_ACCOUNT_ID,
      businessName: body.businessName,
      logoUrl: body.logoUrl || null,
      coverImageUrl: body.coverImageUrl || null,
      description: body.description || '',
      address: body.address || '',
      city: body.city || '',
      state: body.state || '',
      country: body.country || '',
      googleMapsUrl: body.googleMapsUrl || '',
      contactPhone: body.contactPhone || '',
      contactEmail: body.contactEmail || '',
      website: body.website || '',
      socialLinks: body.socialLinks || [],
      venuePhotos: body.venuePhotos || [],
      capacity: body.capacity || 0,
      parkingInfo: body.parkingInfo || '',
      amenities: body.amenities || [],
      dressCodeDefault: body.dressCodeDefault || '',
      ageRestrictionDefault: body.ageRestrictionDefault || 0,
      venuePolicies: body.venuePolicies || '',
      musicPreferences: body.musicPreferences || [],
      defaultTags: body.defaultTags || [],
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    profiles.push(profile);
    return created(res, profile);
  }

  // GET /business-profiles/:id
  if (req.method === 'GET' && resourceId && !subResource) {
    const profile = profiles.find(p => p.id === resourceId);
    return profile ? ok(res, profile) : notFound(res);
  }

  // PUT /business-profiles/:id
  if (req.method === 'PUT' && resourceId && !subResource) {
    const idx = profiles.findIndex(p => p.id === resourceId);
    if (idx === -1) return notFound(res);
    const body = req.body;
    profiles[idx] = { ...profiles[idx], ...body, updatedAt: new Date().toISOString() };
    return ok(res, profiles[idx]);
  }

  // ── Templates ──

  // GET /business-profiles/:id/templates — list templates for a profile
  if (req.method === 'GET' && resourceId && subResource === 'templates' && !subId) {
    return ok(res, { templates: templates.filter(t => t.businessProfileId === resourceId) });
  }

  // POST /business-profiles/:id/templates
  if (req.method === 'POST' && resourceId && subResource === 'templates' && !subId) {
    const body = req.body;
    if (!body || !body.name) return bad(res, 'name is required');
    const tmpl: MockTemplate = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      businessProfileId: resourceId,
      name: body.name,
      description: body.description || '',
      category: body.category || '',
      isRecurring: body.isRecurring || false,
      recurrenceType: body.recurrenceType || '',
      recurrenceConfig: body.recurrenceConfig || {},
      templateData: body.templateData || {},
      sortOrder: body.sortOrder || 0,
      useCount: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    templates.push(tmpl);
    return created(res, tmpl);
  }

  // GET /templates/:id
  if (req.method === 'GET' && pathStr.startsWith('templates/') && !subResource) {
    const tmpl = templates.find(t => t.id === pathStr.replace('templates/', ''));
    return tmpl ? ok(res, tmpl) : notFound(res);
  }

  if (pathStr.startsWith('templates/')) {
    const tmplId = pathStr.replace('templates/', '');
    const idx = templates.findIndex(t => t.id === tmplId);
    if (idx === -1) return notFound(res);

    // PUT /templates/:id
    if (req.method === 'PUT' && !parts[2]) {
      templates[idx] = { ...templates[idx], ...req.body, updatedAt: new Date().toISOString() };
      return ok(res, templates[idx]);
    }

    // DELETE /templates/:id
    if (req.method === 'DELETE' && !parts[2]) {
      templates.splice(idx, 1);
      return noContent(res);
    }

    // POST /templates/:id/use — increment use count
    if (req.method === 'POST' && parts[2] === 'use') {
      templates[idx].useCount++;
      templates[idx].lastUsedAt = new Date().toISOString();
      return ok(res, { template: templates[idx] });
    }
  }

  // ── Promoters ──

  // GET /promoters — list all for my profile
  if (req.method === 'GET' && pathStr === 'promoters') {
    const profile = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    if (!profile) return bad(res, 'No business profile');
    return ok(res, { promoters: promoters.filter(p => p.businessProfileId === profile.id) });
  }

  // POST /promoters
  if (req.method === 'POST' && pathStr === 'promoters') {
    const body = req.body;
    if (!body || !body.name) return bad(res, 'name is required');
    const profile = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    if (!profile) return bad(res, 'No business profile');
    const promoter: MockPromoter = {
      id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      businessProfileId: profile.id,
      accountId: body.accountId || null,
      name: body.name,
      email: body.email || '',
      phone: body.phone || '',
      promoterType: body.promoterType || 'individual',
      status: 'active',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    promoters.push(promoter);
    return created(res, promoter);
  }

  // POST /promoters/search — search users to invite
  if (req.method === 'POST' && pathStr === 'promoters/search') {
    const { query } = req.body || {};
    const results = [
      { id: 'user-1', name: 'Rahul Sharma', handle: '@rahul', type: 'influencer', followers: 15000 },
      { id: 'user-2', name: 'Maya Singh', handle: '@maya', type: 'creator', followers: 8000 },
      { id: 'user-3', name: 'Arjun Patel', handle: '@arjun', type: 'individual', followers: 1200 },
      { id: 'user-4', name: 'Priya Kapoor', handle: '@priya', type: 'student_ambassador', followers: 3000 },
      { id: 'user-5', name: 'Vikram Raj', handle: '@vikram', type: 'club_promoter', followers: 25000 },
    ];
    if (query) {
      const q = query.toLowerCase();
      return ok(res, { results: results.filter(r => r.name.toLowerCase().includes(q) || r.handle.toLowerCase().includes(q)) });
    }
    return ok(res, { results });
  }

  // Promoter by ID
  if (pathStr.startsWith('promoters/')) {
    const promoterId = pathStr.replace('promoters/', '');
    const pi = promoters.findIndex(p => p.id === promoterId);
    if (pi === -1) return notFound(res);

    // GET /promoters/:id
    if (req.method === 'GET' && !parts[2]) {
      return ok(res, promoters[pi]);
    }

    // PUT /promoters/:id
    if (req.method === 'PUT' && !parts[2]) {
      promoters[pi] = { ...promoters[pi], ...req.body, updatedAt: new Date().toISOString() };
      return ok(res, promoters[pi]);
    }

    // DELETE /promoters/:id
    if (req.method === 'DELETE' && !parts[2]) {
      promoters[pi].status = 'deleted';
      return ok(res, { message: 'Promoter removed' });
    }

    const actionOp = parts[2];
    // POST /promoters/:id/suspend
    if (actionOp === 'suspend') { promoters[pi].status = 'suspended'; return ok(res, promoters[pi]); }
    // POST /promoters/:id/approve
    if (actionOp === 'approve') { promoters[pi].status = 'active'; return ok(res, promoters[pi]); }
    // POST /promoters/:id/commission — set commission
    if (actionOp === 'commission') {
      const body = req.body;
      const existingIdx = commissions.findIndex(c => c.promoterId === promoterId && !c.eventId);
      const comm: MockCommission = {
        id: existingIdx >= 0 ? commissions[existingIdx].id : `comm-${Date.now()}`,
        promoterId,
        eventId: null,
        commissionType: body.commissionType || 'percentage',
        fixedAmountCents: body.fixedAmountCents || 0,
        percentageRate: body.percentageRate || 0,
        tierConfig: body.tierConfig || [],
        maxPayoutCents: body.maxPayoutCents || 0,
        requiresApproval: body.requiresApproval || false,
        createdAt: existingIdx >= 0 ? commissions[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) commissions[existingIdx] = comm;
      else commissions.push(comm);
      return ok(res, comm);
    }
  }

  // ── Referral Links ──

  // POST /referral-links
  if (req.method === 'POST' && pathStr === 'referral-links') {
    const { promoterId, eventId } = req.body || {};
    if (!promoterId || !eventId) return bad(res, 'promoterId and eventId required');
    const code = `ref-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const link: MockReferralLink = {
      id: `rl-${Date.now()}`,
      promoterId,
      eventId,
      referralCode: code,
      referralUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/r/${code}`,
      promoCode: '',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${code}`,
      uniqueClicks: 0,
      ticketSales: 0,
      revenueCents: 0,
      conversions: 0,
      refunds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    referralLinks.push(link);
    return created(res, link);
  }

  // GET /referral-links/promoter/:id
  if (pathStr.startsWith('referral-links/promoter/')) {
    const pid = pathStr.replace('referral-links/promoter/', '');
    return ok(res, { links: referralLinks.filter(l => l.promoterId === pid) });
  }

  // GET /referral-links/:code — resolve
  if (pathStr.startsWith('referral-links/')) {
    const code = pathStr.replace('referral-links/', '');
    const link = referralLinks.find(l => l.referralCode === code);
    if (link) {
      link.uniqueClicks++;
      return ok(res, link);
    }
    // Track click even for new links (generate on the fly)
    return notFound(res);
  }

  // ── Commissions ──

  // GET /commissions/promoter/:id
  if (pathStr.startsWith('commissions/promoter/')) {
    const pid = pathStr.replace('commissions/promoter/', '');
    const comms = commissions.filter(c => c.promoterId === pid);
    return ok(res, { commissions: comms });
  }

  // PUT /commissions/:id
  if (pathStr.startsWith('commissions/')) {
    const cid = pathStr.replace('commissions/', '');
    const ci = commissions.findIndex(c => c.id === cid);
    if (ci === -1) return notFound(res);
    if (req.method === 'PUT') {
      commissions[ci] = { ...commissions[ci], ...req.body, updatedAt: new Date().toISOString() };
      return ok(res, commissions[ci]);
    }
  }

  // POST /commissions/calculate — preview
  if (req.method === 'POST' && pathStr === 'commissions/calculate') {
    const { priceCents, commissionType, percentageRate, fixedAmountCents, tierConfig, ticketNumber } = req.body || {};
    let commissionCents = 0;
    if (commissionType === 'percentage') {
      commissionCents = Math.round((priceCents * (percentageRate || 0)) / 100);
    } else if (commissionType === 'fixed') {
      commissionCents = fixedAmountCents || 0;
    } else if (commissionType === 'tiered' && tierConfig) {
      const sorted = [...tierConfig].sort((a: any, b: any) => b.minTickets - a.minTickets);
      const tier = sorted.find((t: any) => (ticketNumber || 0) >= t.minTickets);
      commissionCents = tier ? Math.round((priceCents * tier.rate) / 100) : 0;
    }
    return ok(res, { commissionCents, venueReceivesCents: priceCents - commissionCents });
  }

  // ── Payouts ──

  // GET /payouts
  if (req.method === 'GET' && pathStr === 'payouts') {
    const profile = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    if (!profile) return ok(res, { payouts: [] });
    return ok(res, { payouts: payouts.filter(p => p.businessProfileId === profile.id) });
  }

  // POST /payouts/:id/request
  if (pathStr.startsWith('payouts/') && parts[2] === 'request') {
    const pi2 = payouts.findIndex(p => p.id === parts[1]);
    if (pi2 === -1) return notFound(res);
    payouts[pi2].status = 'processing';
    return ok(res, payouts[pi2]);
  }

  // ── Dashboards ──

  // GET /host-dashboard
  if (req.method === 'GET' && pathStr === 'host-dashboard') {
    const profile = profiles.find(p => p.accountId === DEV_ACCOUNT_ID);
    if (!profile) return bad(res, 'No business profile');
    const activePromoters = promoters.filter(p => p.businessProfileId === profile.id && p.status === 'active');
    const topPromoters = activePromoters.map(p => {
      const pi = referralLinks.filter(r => r.promoterId === p.id);
      const totalSales = pi.reduce((s, r) => s + r.ticketSales, 0);
      const totalRevenue = pi.reduce((s, r) => s + r.revenueCents, 0);
      const totalClicks = pi.reduce((s, r) => s + r.uniqueClicks, 0);
      return {
        promoterId: p.id, name: p.name, promoterType: p.promoterType,
        ticketSales: totalSales, revenueCents: totalRevenue,
        clicks: totalClicks,
        conversionRate: totalClicks > 0 ? Math.round((totalSales / totalClicks) * 100) : 0,
        commissionEarnedCents: Math.round(totalRevenue * 0.1),
      };
    }).sort((a, b) => b.ticketSales - a.ticketSales);

    return ok(res, {
      totalTicketSales: topPromoters.reduce((s, p) => s + p.ticketSales, 0),
      totalRevenueCents: topPromoters.reduce((s, p) => s + p.revenueCents, 0),
      totalFees: 0,
      totalCommissions: topPromoters.reduce((s, p) => s + p.commissionEarnedCents, 0),
      netRevenueCents: topPromoters.reduce((s, p) => s + p.revenueCents, 0),
      uniqueAttendees: 0,
      repeatAttendees: 0,
      activePromoters: activePromoters.length,
      upcomingEvents: 0,
      topPromoters,
      recentPayouts: payouts.filter(p => p.businessProfileId === profile.id).slice(0, 10),
    });
  }

  // GET /promoter-dashboard
  if (req.method === 'GET' && pathStr === 'promoter-dashboard') {
    const myPromoters = promoters.filter(p => p.status === 'active');
    if (myPromoters.length === 0) {
      return ok(res, {
        totalTicketsSold: 0, totalEarningsCents: 0, pendingEarningsCents: 0,
        paidOutCents: 0, totalClicks: 0, conversionRate: 0,
        activeReferralLinks: [], upcomingEvents: [],
        leaderboardRank: 1, leaderboardTotal: 1,
      });
    }
    const p = myPromoters[0];
    const links = referralLinks.filter(l => l.promoterId === p.id);
    const totalTickets = links.reduce((s, l) => s + l.ticketSales, 0);
    const totalClicks = links.reduce((s, l) => s + l.uniqueClicks, 0);
    const totalRevenue = links.reduce((s, l) => s + l.revenueCents, 0);
    return ok(res, {
      totalTicketsSold: totalTickets,
      totalEarningsCents: Math.round(totalRevenue * 0.1),
      pendingEarningsCents: Math.round(totalRevenue * 0.05),
      paidOutCents: Math.round(totalRevenue * 0.05),
      totalClicks,
      conversionRate: totalClicks > 0 ? Math.round((totalTickets / totalClicks) * 100) : 0,
      activeReferralLinks: links,
      upcomingEvents: [],
      leaderboardRank: 1,
      leaderboardTotal: 3,
    });
  }

  return notFound(res);
}
