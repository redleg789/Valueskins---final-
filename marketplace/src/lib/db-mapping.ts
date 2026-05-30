// @ts-nocheck

import type { CreateEventFormState, TicketTier, ScheduleItem, FAQEntry, TableSection } from '@/features/events/data/types';

const DEV_USER_INSTAGRAM = 'dev-user';
const DEV_USER_DISPLAY = 'Dev User';
const DEV_USER_EMAIL = 'dev@valueskins.io';

export function getDevUserId(): number {
  return 1;
}

export function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${timeStr}:00.000Z`;
}

export function extractDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  try {
    return isoStr.split('T')[0] || isoStr.substring(0, 10);
  } catch { return ''; }
}

export function extractTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  try {
    const match = isoStr.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
  } catch { return ''; }
}

export interface DbEventRow {
  id: number;
  host_user_id: number;
  created_at: string;
  title: string;
  description: string | null;
  category: string;
  event_type_detail: string;
  cover_image_url: string | null;
  gallery_images: any;
  one_line_summary: string | null;
  full_description: string | null;
  tags: any;
  event_visibility: string;
  start_time: string | null;
  end_time: string | null;
  doors_open_time: string | null;
  last_entry_time: string | null;
  timezone: string;
  venue_name: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  indoor_outdoor: string;
  parking_available: boolean;
  parking_car_capacity: number;
  parking_bike_capacity: number;
  parking_capacity: number;
  parking_at_owners_risk: boolean;
  parking_details: string | null;
  valet_available: boolean;
  valet_capacity: number;
  valet_details: string | null;
  public_transport_nearby: boolean;
  transport_details: string | null;
  address_reveal: string;
  max_attendees: number;
  unlimited_tickets: boolean;
  waitlist_enabled: boolean;
  invite_limit: number;
  attendee_count: number;
  ticketing_model: string;
  currency: string;
  refund_allowed: boolean;
  refund_policy: string | null;
  cancellation_policy: string | null;
  ticket_sales_end_date: string | null;
  intended_audience: string | null;
  age_restriction: number;
  gender_preferences: string;
  communities_targeted: any;
  interests_targeted: any;
  experience_level: string;
  dress_code: string | null;
  event_vibe: string | null;
  music_genre: string | null;
  networking_level: string;
  energy_level: string;
  id_required: boolean;
  reentry_allowed: boolean;
  alcohol_rules: string | null;
  guest_rules: string | null;
  photography_rules: string | null;
  prohibited_items: any;
  security_rules: string | null;
  host_contact: string | null;
  support_contact: string | null;
  emergency_contact: string | null;
  event_chat_enabled: boolean;
  attendee_visibility_enabled: boolean;
  photo_sharing_enabled: boolean;
  networking_enabled: boolean;
  follow_ups_enabled: boolean;
  what_to_bring: any;
  food_and_drink: string | null;
  accessibility_info: string | null;
  weather_contingency: string | null;
  social_links: any;
  event_website: string | null;
  event_language: string;
  visibility_status: string;
  gender_rule: string | null;
  gender_ratio: any;
  custom_entry_restrictions: string | null;
  entry_approval_required: boolean | null;
  bag_policy: string | null;
  locker_available: boolean | null;
  locker_cost_cents: number | null;
  locker_info: string | null;
  storage_info: string | null;
  upgraded_prohibited_items: any;
  location: string | null;
  business_profile_id: string | null;
  host_username?: string;
}

export function formToDbColumns(form: CreateEventFormState, userId: number): Record<string, any> {
  return {
    host_user_id: userId,
    title: form.eventName,
    description: form.oneLineSummary || form.fullDescription?.substring(0, 200) || null,
    category: form.eventCategory || 'other',
    event_type_detail: form.eventType || 'in-person',
    cover_image_url: form.coverImage || null,
    gallery_images: JSON.stringify(form.galleryImages || []),
    one_line_summary: form.oneLineSummary || null,
    full_description: form.fullDescription || null,
    tags: JSON.stringify(form.tags || []),
    event_visibility: form.eventVisibility || 'public',
    start_time: combineDateAndTime(form.eventDate, form.startTime) || new Date().toISOString(),
    end_time: combineDateAndTime(form.eventDate, form.endTime) || null,
    doors_open_time: combineDateAndTime(form.eventDate, form.doorsOpenTime) || null,
    last_entry_time: combineDateAndTime(form.eventDate, form.lastEntryTime) || null,
    timezone: form.timezone || 'UTC',
    venue_name: form.venueName || null,
    full_address: form.fullAddress || null,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    landmark: form.landmark || null,
    indoor_outdoor: form.indoorOutdoor || 'indoor',
    parking_available: form.parkingAvailable ?? false,
    parking_car_capacity: form.parkingCarCapacity || 0,
    parking_bike_capacity: form.parkingBikeCapacity || 0,
    parking_capacity: form.parkingCarCapacity + form.parkingBikeCapacity,
    parking_at_owners_risk: form.parkingAtOwnersRisk ?? false,
    parking_details: form.parkingDetails || null,
    valet_available: form.valetAvailable ?? false,
    valet_capacity: form.valetCapacity || 0,
    valet_details: form.valetDetails || null,
    public_transport_nearby: form.publicTransportNearby ?? false,
    transport_details: form.transportDetails || null,
    address_reveal: form.addressReveal || 'after-rsvp',
    max_attendees: form.maxAttendees || 100,
    unlimited_tickets: form.unlimitedTickets ?? false,
    waitlist_enabled: form.waitlistEnabled ?? false,
    invite_limit: form.inviteLimit || 0,
    ticketing_model: form.ticketingModel || 'free',
    currency: form.currency || 'USD',
    refund_allowed: form.refundAllowed ?? true,
    refund_policy: form.refundPolicy || null,
    cancellation_policy: form.cancellationPolicy || null,
    ticket_sales_end_date: form.ticketSalesEndDate ? `${form.ticketSalesEndDate}T23:59:59.000Z` : null,
    intended_audience: form.intendedAudience || null,
    age_restriction: form.ageRestriction ?? 0,
    gender_preferences: form.genderPreferences || 'any',
    communities_targeted: JSON.stringify(form.communitiesTargeted || []),
    interests_targeted: JSON.stringify(form.interestsTargeted || []),
    experience_level: form.experienceLevel || 'all-levels',
    dress_code: form.dressCode || null,
    event_vibe: form.eventVibe || null,
    music_genre: form.musicGenre || null,
    networking_level: form.networkingLevel || 'medium',
    energy_level: form.energyLevel || 'medium',
    id_required: form.idRequired ?? false,
    reentry_allowed: form.reentryAllowed ?? true,
    alcohol_rules: form.alcoholRules || null,
    guest_rules: form.guestRules || null,
    photography_rules: form.photographyRules || null,
    prohibited_items: JSON.stringify(form.prohibitedItems || []),
    security_rules: form.securityRules || null,
    host_contact: form.hostContact || null,
    support_contact: form.supportContact || null,
    emergency_contact: form.emergencyContact || null,
    event_chat_enabled: form.eventChatEnabled ?? true,
    attendee_visibility_enabled: form.attendeeVisibilityEnabled ?? true,
    photo_sharing_enabled: form.photoSharingEnabled ?? true,
    networking_enabled: form.networkingEnabled ?? true,
    follow_ups_enabled: form.followUpsEnabled ?? true,
    what_to_bring: JSON.stringify(form.whatToBring || []),
    food_and_drink: form.foodAndDrink || null,
    accessibility_info: form.accessibility || null,
    weather_contingency: form.weatherContingency || null,
    social_links: JSON.stringify(form.socialLinks || []),
    event_website: form.eventWebsite || null,
    event_language: form.language || '',
    visibility_status: 'active',
    gender_rule: form.genderRule || null,
    gender_ratio: JSON.stringify(form.genderRatio || {}),
    custom_entry_restrictions: form.customEntryRestrictions || null,
    entry_approval_required: form.entryApprovalRequired ?? false,
    bag_policy: form.bagPolicy || null,
    locker_available: form.lockerAvailable ?? false,
    locker_cost_cents: form.lockerCostCents ?? 0,
    locker_info: form.lockerInfo || null,
    storage_info: form.storageInfo || null,
    upgraded_prohibited_items: form.upgradedProhibitedItems || [],
    location: form.fullAddress || null,
    ticket_price_cents: form.ticketTiers?.[0]?.priceCents || 0,
    attendee_count: 0,
    event_type: (() => {
      const valid = ['house_party','networking','college_fest','startup_meetup','music','private_gathering','workshop','general'];
      const cat = form.eventCategory?.replace(/-/g, '_');
      return valid.includes(cat) ? cat : 'general';
    })(),
    storage_tier: 'hot',
    is_publicly_listed: true,
    search_visible: true,
    discovery_visible: true,
    recommendation_visible: true,
    profile_visible: true,
    feed_visible: true,
    attendee_list_public: false,
    search_index_status: 'indexed',
    analytics_retained: true,
    metadata: '{}',
    public_expires_at: (() => {
      const start = combineDateAndTime(form.eventDate, form.startTime);
      if (start) {
        const d = new Date(start);
        d.setDate(d.getDate() + 7);
        return d.toISOString();
      }
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    })(),
  };
}

export function dbRowToForm(row: DbEventRow): CreateEventFormState {
  return {
    eventName: row.title || '',
    eventCategory: (row.category || 'other') as any,
    eventType: (row.event_type_detail || 'in-person') as any,
    coverImage: row.cover_image_url || null,
    galleryImages: parseJsonArray(row.gallery_images),
    oneLineSummary: row.one_line_summary || '',
    fullDescription: row.full_description || '',
    tags: parseJsonArray(row.tags),
    eventVisibility: (row.event_visibility || 'public') as any,
    eventDate: extractDate(row.start_time),
    startTime: extractTime(row.start_time),
    endTime: extractTime(row.end_time) || extractTime(row.start_time),
    doorsOpenTime: extractTime(row.doors_open_time),
    lastEntryTime: extractTime(row.last_entry_time),
    timezone: row.timezone || 'UTC',
    venueName: row.venue_name || '',
    fullAddress: row.full_address || '',
    latitude: row.latitude,
    longitude: row.longitude,
    landmark: row.landmark || '',
    indoorOutdoor: (row.indoor_outdoor || 'indoor') as any,
    parkingAvailable: !!row.parking_available,
    parkingCarCapacity: row.parking_car_capacity || 0,
    parkingBikeCapacity: row.parking_bike_capacity || 0,
    parkingCapacity: row.parking_capacity || 0,
    parkingAtOwnersRisk: row.parking_at_owners_risk ?? false,
    parkingDetails: row.parking_details || '',
    valetAvailable: !!row.valet_available,
    valetCapacity: row.valet_capacity || 0,
    valetDetails: row.valet_details || '',
    publicTransportNearby: !!row.public_transport_nearby,
    transportDetails: row.transport_details || '',
    addressReveal: (row.address_reveal || 'after-rsvp') as any,
    maxAttendees: row.max_attendees || 100,
    unlimitedTickets: row.unlimited_tickets ?? false,
    waitlistEnabled: !!row.waitlist_enabled,
    inviteLimit: row.invite_limit || 0,
    ticketingModel: (row.ticketing_model || 'free') as any,
    currency: row.currency || 'USD',
    ticketTiers: [],
    refundAllowed: row.refund_allowed ?? true,
    refundPolicy: row.refund_policy || '',
    cancellationPolicy: row.cancellation_policy || '',
    ticketSalesEndDate: extractDate(row.ticket_sales_end_date),
    intendedAudience: row.intended_audience || '',
    ageRestriction: row.age_restriction || 0,
    genderPreferences: (row.gender_preferences || 'any') as any,
    communitiesTargeted: parseJsonArray(row.communities_targeted),
    interestsTargeted: parseJsonArray(row.interests_targeted),
    experienceLevel: (row.experience_level || 'all-levels') as any,
    featuredPeople: [],
    dressCode: row.dress_code || '',
    eventVibe: row.event_vibe || '',
    musicGenre: row.music_genre || '',
    networkingLevel: (row.networking_level || 'medium') as any,
    energyLevel: (row.energy_level || 'medium') as any,
    idRequired: !!row.id_required,
    reentryAllowed: row.reentry_allowed !== false,
    alcoholRules: row.alcohol_rules || '',
    guestRules: row.guest_rules || '',
    photographyRules: row.photography_rules || '',
    prohibitedItems: parseJsonArray(row.prohibited_items),
    securityRules: row.security_rules || '',
    genderRule: (row.gender_rule || 'any') as any,
    genderRatio: parseJsonObject(row.gender_ratio),
    customEntryRestrictions: row.custom_entry_restrictions || '',
    entryApprovalRequired: !!row.entry_approval_required,
    bagPolicy: (row.bag_policy || 'any') as any,
    lockerAvailable: !!row.locker_available,
    lockerCostCents: row.locker_cost_cents || 0,
    lockerInfo: row.locker_info || '',
    storageInfo: row.storage_info || '',
    upgradedProhibitedItems: parseJsonArray(row.upgraded_prohibited_items),
    tableSections: [],
    faqEntries: [],
    hostContact: row.host_contact || '',
    supportContact: row.support_contact || '',
    emergencyContact: row.emergency_contact || '',
    eventChatEnabled: row.event_chat_enabled !== false,
    attendeeVisibilityEnabled: row.attendee_visibility_enabled !== false,
    photoSharingEnabled: row.photo_sharing_enabled !== false,
    networkingEnabled: row.networking_enabled !== false,
    followUpsEnabled: row.follow_ups_enabled !== false,
    schedule: [],
    whatToBring: parseJsonArray(row.what_to_bring),
    foodAndDrink: row.food_and_drink || '',
    accessibility: row.accessibility_info || '',
    weatherContingency: row.weather_contingency || '',
    socialLinks: parseJsonArray(row.social_links),
    eventWebsite: row.event_website || '',
    language: row.event_language || (typeof navigator !== 'undefined' ? navigator.language : 'en'),
  };
}

export function dbRowToMockEvent(row: DbEventRow, form: CreateEventFormState) {
  return {
    id: String(row.id),
    hostUserId: String(row.host_user_id),
    hostName: row.host_username || 'Host',
    createdAt: row.created_at,
    form,
    attendees: [],
    thirdPartyTags: [],
    visibilityStatus: row.visibility_status || 'active' as const,
  };
}

export function parseJsonArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export function parseJsonObject(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return {};
}

export const EVENT_DB_COLUMNS = `
  id, host_user_id, created_at, visibility_status, attendee_count,
  title, description, category, event_type_detail,
  cover_image_url, gallery_images, one_line_summary, full_description,
  tags, event_visibility,
  start_time, end_time, doors_open_time, last_entry_time, timezone,
  venue_name, full_address, latitude, longitude, landmark,
  indoor_outdoor, parking_available, valet_available, public_transport_nearby, address_reveal,
  max_attendees, waitlist_enabled, invite_limit,
  ticketing_model, refund_policy, cancellation_policy, ticket_sales_end_date,
  intended_audience, age_restriction, gender_preferences,
  communities_targeted, interests_targeted, experience_level,
  dress_code, event_vibe, music_genre, networking_level, energy_level,
  id_required, reentry_allowed, alcohol_rules, guest_rules, photography_rules,
  prohibited_items, security_rules,
  host_contact, support_contact, emergency_contact,
  event_chat_enabled, attendee_visibility_enabled, photo_sharing_enabled,
  networking_enabled, follow_ups_enabled,
  what_to_bring, food_and_drink, accessibility_info, weather_contingency,
  social_links, event_website, event_language,
  gender_rule, gender_ratio, custom_entry_restrictions, entry_approval_required,
  bag_policy, locker_available, locker_cost_cents, locker_info, storage_info,
  upgraded_prohibited_items, location, business_profile_id
`;

export function buildInsertQuery(table: string, data: Record<string, any>): { text: string; values: any[] } {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const columns = keys.map(k => `"${k}"`);
  return {
    text: `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  };
}

export function buildUpdateQuery(table: string, id: number, data: Record<string, any>): { text: string; values: any[] } {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
  return {
    text: `UPDATE "${table}" SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    values: [...values, id],
  };
}
