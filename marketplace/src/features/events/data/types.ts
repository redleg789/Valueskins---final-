'use client';

export type ThirdPartyRole =
  | 'DJ' | 'Influencer' | 'Venue Owner' | 'Performer' | 'Sponsor' | 'Photographer'
  | 'Speaker' | 'Guest' | 'Partner' | 'Featured Attendee' | 'Organizer' | 'Collaborator';

export type EventCategory =
  | 'concert' | 'workshop' | 'networking' | 'party' | 'conference'
  | 'exhibition' | 'performance' | 'screening' | 'festival' | 'pop-up' | 'other';

export type EventType = 'in-person' | 'virtual' | 'hybrid';

export type EventVisibility = 'public' | 'private' | 'invite-only';

export type IndoorOutdoor = 'indoor' | 'outdoor' | 'both';

export type AddressRevealTiming = 'immediately' | 'after-rsvp' | 'day-before';

export type TicketingModel = 'free' | 'paid';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'all-levels';

export type Level = 'low' | 'medium' | 'high';

export interface ThirdPartyTag {
  id: string;
  personaId: number;
  userId: number;
  name: string;
  role: ThirdPartyRole;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  followersCount: number;
  descriptor: string;
  hasValueSkin: boolean;
  valueskins: string[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';
  isPublic: boolean;
  autoApprove: boolean;
}

export interface EventAttendee {
  id: string;
  name: string;
  status: 'going' | 'interested';
}

export interface TicketTier {
  id: string;
  name: string;
  type: 'general' | 'early-bird' | 'vip' | 'group' | 'couple';
  priceCents: number;
  quantity: number;
  remaining: number;
  description: string;
  benefits: string[];
  saleStartDate: string;
  saleEndDate: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
}

export interface FeaturedPerson {
  id: string;
  tag: ThirdPartyTag;
  featuredRole: string;
  sortOrder: number;
}

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  description: string;
}

export interface CreateEventFormState {
  // Basic Information
  eventName: string;
  eventSlug: string;
  eventCategory: EventCategory;
  eventType: EventType;
  coverImage: string | null;
  galleryImages: string[];
  oneLineSummary: string;
  fullDescription: string;
  tags: string[];
  eventVisibility: EventVisibility;

  // Date & Time
  eventDate: string;
  startTime: string;
  endTime: string;
  doorsOpenTime: string;
  lastEntryTime: string;
  timezone: string;

  // Location
  venueName: string;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  landmark: string;
  indoorOutdoor: IndoorOutdoor;
  parkingAvailable: boolean;
  parkingCarCapacity: number;
  parkingBikeCapacity: number;
  parkingCapacity: number;
  parkingAtOwnersRisk: boolean;
  parkingDetails: string;
  valetAvailable: boolean;
  valetCapacity: number;
  valetDetails: string;
  publicTransportNearby: boolean;
  transportDetails: string;
  addressReveal: AddressRevealTiming;

  // Capacity
  maxAttendees: number;
  unlimitedTickets: boolean;
  waitlistEnabled: boolean;
  inviteLimit: number;

  // Ticketing
  ticketingModel: TicketingModel;
  currency: string;
  ticketTiers: TicketTier[];
  refundAllowed: boolean;
  refundPolicy: string;
  cancellationPolicy: string;
  ticketSalesEndDate: string;

  // Audience
  intendedAudience: string;
  ageRestriction: number;
  genderPreferences: 'any' | 'male' | 'female' | 'non-binary';
  communitiesTargeted: string[];
  interestsTargeted: string[];
  experienceLevel: ExperienceLevel;

  // Featured People
  featuredPeople: FeaturedPerson[];

  // Vibe / Experience
  dressCode: string;
  eventVibe: string;
  musicGenre: string;
  networkingLevel: Level;
  energyLevel: Level;

  // Rules
  idRequired: boolean;
  reentryAllowed: boolean;
  alcoholRules: string;
  guestRules: string;
  photographyRules: string;
  prohibitedItems: string[];
  securityRules: string;

  // Gender + Entry Rules
  genderRule: GenderRule;
  genderRatio: GenderRatio;
  customEntryRestrictions: string;
  entryApprovalRequired: boolean;

  // Bag + Security Rules
  bagPolicy: BagPolicy;
  lockerAvailable: boolean;
  lockerCostCents: number;
  lockerInfo: string;
  storageInfo: string;
  upgradedProhibitedItems: string[];

  // Table + Seating
  tableSections: TableSection[];

  // FAQ
  faqEntries: FAQEntry[];

  // Contact
  hostContact: string;
  supportContact: string;
  emergencyContact: string;
  checkInManagers: string[];
  calendarAdminCount: number;
  apiAccessEnabled: boolean;
  webhooksEnabled: boolean;
  collectGuestNamesSeparately: boolean;

  // Post-Event
  eventChatEnabled: boolean;
  attendeeVisibilityEnabled: boolean;
  photoSharingEnabled: boolean;
  networkingEnabled: boolean;
  followUpsEnabled: boolean;

  // Schedule
  schedule: ScheduleItem[];

  // Logistics
  whatToBring: string[];
  foodAndDrink: string;
  accessibility: string;
  weatherContingency: string;
  socialLinks: string[];
  eventWebsite: string;
  language: string;
}

export function emptyFormState(): CreateEventFormState {
  return {
    eventName: '',
    eventSlug: '',
    eventCategory: 'other',
    eventType: 'in-person',
    coverImage: null,
    galleryImages: [],
    oneLineSummary: '',
    fullDescription: '',
    tags: [],
    eventVisibility: 'public',

    eventDate: '',
    startTime: '',
    endTime: '',
    doorsOpenTime: '',
    lastEntryTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    venueName: '',
    fullAddress: '',
    latitude: null,
    longitude: null,
    landmark: '',
    indoorOutdoor: 'indoor',
    parkingAvailable: false,
    parkingCarCapacity: 0,
    parkingBikeCapacity: 0,
    parkingCapacity: 0,
    parkingAtOwnersRisk: false,
    parkingDetails: '',
    valetAvailable: false,
    valetCapacity: 0,
    valetDetails: '',
    publicTransportNearby: false,
    transportDetails: '',
    addressReveal: 'after-rsvp',

    maxAttendees: 100,
    unlimitedTickets: false,
    waitlistEnabled: false,
    inviteLimit: 0,

    ticketingModel: 'free',
    currency: 'USD',
    ticketTiers: [],
    refundAllowed: true,
    refundPolicy: 'full-24h',
    cancellationPolicy: 'host-cancel',
    ticketSalesEndDate: '',

    intendedAudience: '',
    ageRestriction: 0,
    genderPreferences: 'any',
    communitiesTargeted: [],
    interestsTargeted: [],
    experienceLevel: 'all-levels',

    featuredPeople: [],

    dressCode: '',
    eventVibe: '',
    musicGenre: '',
    networkingLevel: 'medium',
    energyLevel: 'medium',

    idRequired: false,
    reentryAllowed: true,
    alcoholRules: '',
    guestRules: '',
    photographyRules: '',
    prohibitedItems: [],
    securityRules: '',

    genderRule: 'any',
    genderRatio: {},
    customEntryRestrictions: '',
    entryApprovalRequired: false,

    bagPolicy: 'any',
    lockerAvailable: false,
    lockerCostCents: 0,
    lockerInfo: '',
    storageInfo: '',
    upgradedProhibitedItems: [],

    tableSections: [],

    faqEntries: [],

    hostContact: '',
    supportContact: '',
    emergencyContact: '',
    checkInManagers: [],
    calendarAdminCount: 5,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    collectGuestNamesSeparately: true,

    eventChatEnabled: true,
    attendeeVisibilityEnabled: true,
    photoSharingEnabled: true,
    networkingEnabled: true,
    followUpsEnabled: true,

    schedule: [],

    whatToBring: [],
    foodAndDrink: '',
    accessibility: '',
    weatherContingency: '',
    socialLinks: [],
    eventWebsite: '',
    language: '',
  };
}

export interface EventRecord {
  id: string;
  hostUserId: string;
  hostName: string;
  createdAt: string;
  form: CreateEventFormState;
  attendees: EventAttendee[];
  thirdPartyTags: ThirdPartyTag[];
  publicStatusMessage?: string;
  publicExpiresAt?: string;
  visibilityStatus?: 'active' | 'ended_visible' | 'archived';
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'concert', label: 'Concert' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking' },
  { value: 'party', label: 'Party' },
  { value: 'conference', label: 'Conference' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'performance', label: 'Performance' },
  { value: 'screening', label: 'Screening' },
  { value: 'festival', label: 'Festival' },
  { value: 'pop-up', label: 'Pop-up' },
  { value: 'other', label: 'Other' },
];

export const INDOOR_OPTIONS: { value: IndoorOutdoor; label: string }[] = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];

export const ADDRESS_REVEAL_OPTIONS: { value: AddressRevealTiming; label: string }[] = [
  { value: 'immediately', label: 'Show immediately' },
  { value: 'after-rsvp', label: 'Show after RSVP' },
  { value: 'day-before', label: 'Show day before' },
];

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner-friendly' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all-levels', label: 'All levels' },
];

export const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const GENDER_RULE_OPTIONS: { value: GenderRule; label: string }[] = [
  { value: 'any', label: 'Any gender' },
  { value: 'couples_only', label: 'Couples only' },
  { value: 'women_only', label: 'Women only' },
  { value: 'men_only', label: 'Men only' },
  { value: 'invite_only', label: 'Invite only' },
  { value: 'ratio_controlled', label: 'Gender ratio controlled' },
  { value: 'custom', label: 'Custom restrictions' },
];

export const BAG_POLICY_OPTIONS: { value: BagPolicy; label: string }[] = [
  { value: 'any', label: 'No restriction' },
  { value: 'no_bags', label: 'No bags allowed' },
  { value: 'small_bags_only', label: 'Small bags only' },
  { value: 'clear_bags_only', label: 'Clear bags only' },
  { value: 'no_restrictions', label: 'No restrictions' },
];

export const SECTION_TYPE_OPTIONS: { value: SectionType; label: string }[] = [
  { value: 'general', label: 'General admission' },
  { value: 'vip', label: 'VIP' },
  { value: 'standing', label: 'Standing' },
  { value: 'table', label: 'Table seating' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'booth', label: 'Booth' },
  { value: 'outdoor', label: 'Outdoor' },
];

export const VERIFICATION_STATUS_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revoked', label: 'Revoked' },
];

export const TICKET_CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'ticketing', label: 'Ticketing' },
  { value: 'refund', label: 'Refund' },
  { value: 'safety', label: 'Safety' },
  { value: 'technical', label: 'Technical' },
  { value: 'host_support', label: 'Host support' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
];

export const FRAUD_TYPE_LABELS: Record<FraudType, string> = {
  scalping: 'Ticket scalping',
  duplicate_account: 'Duplicate account',
  chargeback_abuse: 'Chargeback abuse',
  no_show_pattern: 'Repeat no-show',
  bulk_cancellation: 'Bulk cancellation',
  suspicious_purchase: 'Suspicious purchase',
  promoter_abuse: 'Promoter abuse',
  velocity_anomaly: 'Velocity anomaly',
  payment_fraud: 'Payment fraud',
};

export const FEATURED_ROLE_OPTIONS: string[] = [
  'DJ', 'Speaker', 'Influencer', 'Performer', 'Guest',
  'Venue Host', 'Sponsor', 'Partner',
];

// ── Business / Venue Profile ──────────────────────────────

export interface SocialLink {
  platform: string;
  url: string;
}

export interface BusinessProfile {
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
  socialLinks: SocialLink[];
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

export function emptyBusinessProfile(): BusinessProfile {
  return {
    id: '',
    accountId: 'dev-user',
    businessName: '',
    logoUrl: null,
    coverImageUrl: null,
    description: '',
    address: '',
    city: '',
    state: '',
    country: '',
    googleMapsUrl: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    socialLinks: [],
    venuePhotos: [],
    capacity: 0,
    parkingInfo: '',
    amenities: [],
    dressCodeDefault: '',
    ageRestrictionDefault: 0,
    venuePolicies: '',
    musicPreferences: [],
    defaultTags: [],
    verified: false,
    createdAt: '',
    updatedAt: '',
  };
}

// ── Event Template ────────────────────────────────────────

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RecurrenceConfig {
  dayOfWeek?: number;
  weekOfMonth?: number;
  intervalDays?: number;
}

export interface EventTemplate {
  id: string;
  businessProfileId: string;
  name: string;
  description: string;
  category: string;
  isRecurring: boolean;
  recurrenceType: RecurrenceType | '';
  recurrenceConfig: RecurrenceConfig;
  templateData: CreateEventFormState;
  sortOrder: number;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Promoter ──────────────────────────────────────────────

export type PromoterType = 'individual' | 'creator' | 'influencer' | 'student_ambassador' | 'club_promoter';
export type PromoterStatus = 'active' | 'suspended' | 'banned' | 'deleted';

export interface Promoter {
  id: string;
  businessProfileId: string;
  accountId: string | null;
  name: string;
  email: string;
  phone: string;
  promoterType: PromoterType;
  status: PromoterStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Commission ────────────────────────────────────────────

export type CommissionType = 'fixed' | 'percentage' | 'tiered';

export interface TierConfig {
  minTickets: number;
  rate: number;
}

export interface PromoterCommission {
  id: string;
  promoterId: string;
  eventId: string | null;
  commissionType: CommissionType;
  fixedAmountCents: number;
  percentageRate: number;
  tierConfig: TierConfig[];
  maxPayoutCents: number;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Referral Link ─────────────────────────────────────────

export interface ReferralLink {
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

// ── Payout ────────────────────────────────────────────────

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

export interface Payout {
  id: string;
  businessProfileId: string;
  eventId: string | null;
  amountCents: number;
  feeCents: number;
  promoterCommissionCents: number;
  netAmountCents: number;
  status: PayoutStatus;
  paymentMethod: string;
  paymentRef: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Dashboard Data ────────────────────────────────────────

export interface HostDashboardData {
  totalTicketSales: number;
  totalRevenueCents: number;
  totalFees: number;
  totalCommissions: number;
  netRevenueCents: number;
  uniqueAttendees: number;
  repeatAttendees: number;
  activePromoters: number;
  upcomingEvents: number;
  topPromoters: PromoterPerformance[];
  recentPayouts: Payout[];
}

export interface PromoterPerformance {
  promoterId: string;
  name: string;
  promoterType: PromoterType;
  ticketSales: number;
  revenueCents: number;
  clicks: number;
  conversionRate: number;
  commissionEarnedCents: number;
}

export interface PromoterDashboardData {
  totalTicketsSold: number;
  totalEarningsCents: number;
  pendingEarningsCents: number;
  paidOutCents: number;
  totalClicks: number;
  conversionRate: number;
  activeReferralLinks: ReferralLink[];
  upcomingEvents: { eventId: string; eventName: string; eventDate: string; venueName: string }[];
  leaderboardRank: number;
  leaderboardTotal: number;
}

// ── QR Ticket ─────────────────────────────────────────────

export type TicketStatus = 'active' | 'used' | 'cancelled' | 'transferred' | 'refunded';
export type ScanMethod = 'qr' | 'manual' | 'lookup';

export interface Ticket {
  id: string;
  eventId: string;
  userId: string | null;
  attendeeId: string;
  ticketType: string;
  ticketCode: string;
  encryptedPayload: string;
  antiForgeryToken: string;
  priceCents: number;
  status: TicketStatus;
  scanCount: number;
  lastScannedAt: string | null;
  walletUrl: string;
  transferCount: number;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  paymentProvider?: string | null;
  paymentRef?: string | null;
  paymentOrderRef?: string | null;
  currency?: string;
  platformFeeCents?: number;
  netAmountCents?: number;
  feeStatus?: string | null;
}

export interface CheckIn {
  id: string;
  ticketId: string;
  eventId: string;
  scannedBy: string | null;
  scanMethod: ScanMethod;
  entryTime: string;
  reEntry: boolean;
  notes: string;
}

export interface CheckInScanResult {
  valid: boolean;
  ticket: Ticket | null;
  attendee: any;
  rejectionReason: string;
  isDuplicate: boolean;
  isReEntry: boolean;
}

// ── Plus-One / Group ──────────────────────────────────────

export interface AttendeeGroup {
  id: string;
  eventId: string;
  ownerAttendeeId: string;
  groupName: string;
  maxSize: number;
  inviteCode: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  attendeeId: string;
  role: 'owner' | 'member';
  invitedBy: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'removed';
  joinedAt: string | null;
  createdAt: string;
}

// ── Arrival Info ──────────────────────────────────────────

export type LocationRevealPolicy = 'purchase' | 'approval' | 'time_threshold';

export interface ArrivalInfo {
  id: string;
  eventId: string;
  mapUrl: string;
  navigationDeeplink: string;
  parkingDetails: string;
  valetInfo: string;
  gateNumber: string;
  floorNumber: string;
  tableAssignment: string;
  entryRouteDescription: string;
  proximityRadiusMeters: number;
  locationRevealPolicy: LocationRevealPolicy;
  revealTime: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Announcement ──────────────────────────────────────────

export type AnnouncementType = 'info' | 'warning' | 'emergency' | 'schedule_change';
export type AnnouncementPriority = 'normal' | 'high' | 'urgent';

export interface EventAnnouncement {
  id: string;
  eventId: string;
  hostId: string;
  title: string;
  body: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  isPinned: boolean;
  pushSent: boolean;
  sentAt: string | null;
  createdAt: string;
}

// ── Event Chat ────────────────────────────────────────────

export type ChatMessageType = 'text' | 'image' | 'announcement' | 'pinned';

export interface ChatMessage {
  id: string;
  eventId: string;
  senderId: string;
  senderName: string;
  message: string;
  messageType: ChatMessageType;
  isPinned: boolean;
  isAnnouncement: boolean;
  isModerated: boolean;
  replyTo: string | null;
  createdAt: string;
}

// ── AI FAQ ────────────────────────────────────────────────

export interface EventFAQ {
  id: string;
  eventId: string;
  question: string;
  answer: string;
  isAutoGenerated: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoFAQInput {
  eventName: string;
  eventCategory: string;
  dressCode: string;
  ageRestriction: number;
  venueName: string;
  parkingInfo: string;
  ticketingModel: string;
  refundPolicy: string;
  maxAttendees: number;
  experienceLevel: string;
  whatToBring: string[];
  foodAndDrink: string;
}

// ── Trust & Safety ────────────────────────────────────────

export type ReportType = 'attendee' | 'host' | 'venue';
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export interface SafetyReport {
  id: string;
  eventId: string | null;
  reporterId: string;
  reportedId: string | null;
  reportType: ReportType;
  reason: string;
  severity: ReportSeverity;
  status: ReportStatus;
  resolution: string;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string;
  createdAt: string;
}

// ── Attendee Card ─────────────────────────────────────────

export type PrivacyLevel = 'public' | 'attendees_only' | 'private';

export interface AttendeeCard {
  id: string;
  userId: string;
  photoUrl: string;
  bio: string;
  interests: string[];
  communities: string[];
  badges: string[];
  showValueSkin: boolean;
  privacyLevel: PrivacyLevel;
  createdAt: string;
  updatedAt: string;
}

// ── Attendance Metrics ────────────────────────────────────

export interface AttendanceMetrics {
  id: string;
  eventId: string;
  totalCheckIns: number;
  noShowCount: number;
  repeatAttendees: number;
  uniqueAttendees: number;
  peakHour: string | null;
  averageDurationMinutes: number;
  vipCheckIns: number;
  groupCheckIns: number;
  createdAt: string;
  updatedAt: string;
}

// ── Post-Event ────────────────────────────────────────────

export interface EventRating {
  id: string;
  eventId: string;
  userId: string;
  rating: number;
  review: string;
  createdAt: string;
}

export interface EventConnection {
  id: string;
  eventId: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'declined';
  source: string;
  createdAt: string;
  updatedAt: string;
}

// ── Automation ────────────────────────────────────────────

export type AutomationJobType = 'reminder' | 'follow_up' | 'waitlist' | 'refund';
export type AutomationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AutomationJob {
  id: string;
  eventId: string | null;
  jobType: AutomationJobType;
  scheduledFor: string;
  executedAt: string | null;
  status: AutomationJobStatus;
  payload: any;
  error: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

// ── Command Center ────────────────────────────────────────

// ── Gender + Entry Rules ─────────────────────────────────

export type GenderRule = 'any' | 'couples_only' | 'women_only' | 'men_only' | 'invite_only' | 'ratio_controlled' | 'custom';

export interface GenderRatio {
  maleMaxPct?: number;
  femaleMinPct?: number;
  maxPerGender?: Record<string, number>;
}

export interface GenderEntryConfig {
  genderRule: GenderRule;
  genderRatio: GenderRatio;
  customEntryRestrictions: string;
  entryApprovalRequired: boolean;
}

// ── Table + Seating ──────────────────────────────────────

export type SectionType = 'vip' | 'general' | 'standing' | 'table' | 'balcony' | 'booth' | 'outdoor';

export interface TableSection {
  id: string;
  eventId: string;
  name: string;
  sectionType: SectionType;
  capacity: number;
  priceCents: number;
  description: string;
  sortOrder: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type TableReservationStatus = 'available' | 'reserved' | 'occupied' | 'maintenance';

export interface TableReservation {
  id: string;
  eventId: string;
  sectionId: string;
  tableLabel: string;
  seats: number;
  attendeeId: string | null;
  ticketId: string | null;
  status: TableReservationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Bag + Security Rules ─────────────────────────────────

export type BagPolicy = 'any' | 'no_bags' | 'small_bags_only' | 'clear_bags_only' | 'no_restrictions';

export interface BagSecurityConfig {
  bagPolicy: BagPolicy;
  lockerAvailable: boolean;
  lockerCostCents: number;
  lockerInfo: string;
  storageInfo: string;
  upgradedProhibitedItems: string[];
}

// ── Verified Host ────────────────────────────────────────

export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'revoked';
export type VerificationLevel = 'basic' | 'premium' | 'enterprise';

export interface VerificationRequest {
  id: string;
  businessProfileId: string;
  status: VerificationStatus;
  requesterId: string;
  documents: VerificationDocument[];
  notes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  verificationLevel: VerificationLevel;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationDocument {
  type: string;
  url: string;
  verified: boolean;
  notes: string;
}

// ── Waitlist Automation ──────────────────────────────────

export type WaitlistStatus = 'waiting' | 'invited' | 'expired' | 'converted' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  eventId: string;
  userId: string;
  userName?: string;
  position: number;
  status: WaitlistStatus;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  convertedAt: string | null;
  waitTimeSeconds: number;
  source: string;
  createdAt: string;
}

export interface WaitlistConfig {
  autoInviteEnabled: boolean;
  inviteExpiryHours: number;  // 2, 6, 12, 24
  maxWaitlistSize: number;
  notifyOnSlotAvailable: boolean;
}

// ── Fraud + Risk Engine ──────────────────────────────────

export type FraudType = 'scalping' | 'duplicate_account' | 'chargeback_abuse' | 'no_show_pattern' | 'bulk_cancellation' | 'suspicious_purchase' | 'promoter_abuse' | 'velocity_anomaly' | 'payment_fraud';
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskAction = 'none' | 'flag' | 'block' | 'warn';

export interface FraudRiskScore {
  id: string;
  eventId: string;
  userId: string;
  userName?: string;
  riskScore: number;
  riskFactors: RiskFactor[];
  actionTaken: RiskAction;
  reviewed: boolean;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  details: string;
}

export interface FraudEvent {
  id: string;
  eventId: string;
  userId: string;
  userName?: string;
  fraudType: FraudType;
  severity: FraudSeverity;
  details: any;
  flaggedAt: string;
  resolvedAt: string | null;
  resolution: string;
}

// ── Calendar Integration ─────────────────────────────────

export type CalendarPlatform = 'google' | 'apple' | 'outlook';
export type ReminderType = '1h_before' | '2h_before' | '6h_before' | '1d_before' | '1w_before' | 'custom';
export type ReminderChannel = 'in_app' | 'email' | 'push' | 'sms' | 'whatsapp';

export interface CalendarSync {
  id: string;
  accountId: string;
  platform: CalendarPlatform;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventReminder {
  id: string;
  eventId: string;
  userId: string;
  remindAt: string;
  reminderType: ReminderType;
  sent: boolean;
  sentAt: string | null;
  channel: ReminderChannel;
  recipient?: string;
  destination?: string;
  deliveryStatus?: 'scheduled' | 'queued' | 'sent' | 'failed';
  createdAt: string;
}

export interface CalendarLinks {
  google: string;
  apple: string;
  outlook: string;
  icsDownload: string;
}

// ── Support System ───────────────────────────────────────

export type TicketCategory = 'general' | 'ticketing' | 'refund' | 'safety' | 'technical' | 'host_support' | 'emergency' | 'payment' | 'account';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
export type SupportTicketStatus = 'open' | 'investigating' | 'waiting_on_user' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  eventId: string | null;
  requesterId: string;
  assignedTo: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  escalationLevel: number;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Efficiency Dashboard Data ────────────────────────────

export interface WaitlistAnalytics {
  totalWaiting: number;
  totalInvited: number;
  totalConverted: number;
  totalExpired: number;
  averageWaitTimeSeconds: number;
  conversionRate: number;
}

export interface FraudDashboardSummary {
  totalScores: number;
  highRiskCount: number;
  blockedCount: number;
  flaggedCount: number;
  recentFraudEvents: FraudEvent[];
  riskDistribution: { level: string; count: number }[];
}

export interface SupportDashboardData {
  openTickets: number;
  unassignedTickets: number;
  urgentTickets: number;
  averageResponseTimeHours: number;
  ticketTrend: { date: string; count: number }[];
}

// ── Updated CreateEventFormState with new fields ─────────

export interface EfficiencyFormExtensions {
  genderRule: GenderRule;
  genderRatio: GenderRatio;
  customEntryRestrictions: string;
  entryApprovalRequired: boolean;
  bagPolicy: BagPolicy;
  lockerAvailable: boolean;
  lockerCostCents: number;
  lockerInfo: string;
  storageInfo: string;
  upgradedProhibitedItems: string[];
  tableSections: TableSection[];
}

export function defaultEfficiencyExtensions(): EfficiencyFormExtensions {
  return {
    genderRule: 'any',
    genderRatio: {},
    customEntryRestrictions: '',
    entryApprovalRequired: false,
    bagPolicy: 'any',
    lockerAvailable: false,
    lockerCostCents: 0,
    lockerInfo: '',
    storageInfo: '',
    upgradedProhibitedItems: [],
    tableSections: [],
  };
}

export function emptyVerificationRequest(): VerificationRequest {
  return {
    id: '',
    businessProfileId: '',
    status: 'pending',
    requesterId: '',
    documents: [],
    notes: '',
    reviewedBy: null,
    reviewedAt: null,
    verificationLevel: 'basic',
    verifiedAt: null,
    expiresAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

export function emptySupportTicket(): SupportTicket {
  return {
    id: '',
    eventId: null,
    requesterId: '',
    assignedTo: null,
    category: 'general',
    priority: 'normal',
    subject: '',
    description: '',
    status: 'open',
    escalationLevel: 0,
    escalatedAt: null,
    resolvedAt: null,
    resolutionNotes: '',
    createdAt: '',
    updatedAt: '',
  };
}

export function defaultWaitlistConfig(): WaitlistConfig {
  return {
    autoInviteEnabled: true,
    inviteExpiryHours: 6,
    maxWaitlistSize: 200,
    notifyOnSlotAvailable: true,
  };
}

// ── Efficiency Register ──────────────────────────────────

export interface EfficiencyRegister {
  calendar: { enabled: boolean; reminders: number };
  verifiedHost: { status: VerificationStatus | 'none'; level: VerificationLevel | null };
  waitlist: { active: boolean; queueSize: number };
  fraud: { score: number; flags: number };
  support: { openTickets: number };
}

export interface CommandCenterData {
  liveAttendeeCount: number;
  totalTicketsSold: number;
  totalRevenueCents: number;
  scanRate: number;
  topPromoters: any[];
  recentCheckIns: CheckIn[];
  activeAnnouncements: EventAnnouncement[];
  demographics: { label: string; value: number }[];
  heatmap: { hour: number; count: number }[];
  conversionSources: { source: string; count: number }[];
  refundCount: number;
}

// ── Payment / Platform Fee Types ───────────────────────────

export type FeeType = 'flat' | 'percentage' | 'hybrid';
export type FeeStatus = 'pending' | 'collected' | 'refunded' | 'failed';
export type PaymentProvider = 'stripe' | 'razorpay' | 'meta_pay' | 'custom';

export interface PlatformFeeConfig {
  id: string;
  feeType: FeeType;
  flatFeeCents: number;
  percentageRate: number;
  minFeeCents: number | null;
  maxFeeCents: number | null;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderFeeOverride {
  id: string;
  provider: PaymentProvider;
  feeType: FeeType | null;
  flatFeeCents: number | null;
  percentageRate: number | null;
  isActive: boolean;
}

export interface PlatformFeeRecord {
  id: string;
  transactionId: string;
  provider: string;
  grossAmountCents: number;
  feeCents: number;
  netAmountCents: number;
  currency: string;
  status: FeeStatus;
  payerId: string | null;
  payeeId: string | null;
  eventId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  collectedAt: string | null;
}

export interface TransactionLedgerEntry {
  id: string;
  externalId: string | null;
  provider: string;
  type: 'payment' | 'payout' | 'refund' | 'fee';
  amountCents: number;
  currency: string;
  grossAmountCents: number | null;
  feeCents: number | null;
  netAmountCents: number | null;
  status: string;
  payerId: string | null;
  payeeId: string | null;
  eventId: string | null;
  idempotencyKey: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeeCalculationRequest {
  amountCents: number;
  provider: string;
}

export interface FeeCalculationResult {
  feeCents: number;
  netAmountCents: number;
  breakdown: {
    flatComponent: number;
    percentageComponent: number;
    totalFeeCents: number;
  };
  configUsed: PlatformFeeConfig | ProviderFeeOverride;
  provider: string;
}

export interface PaymentDashboardData {
  totalRevenueCents: number;
  totalFeesCents: number;
  totalTransactions: number;
  pendingFeesCents: number;
  collectedFeesCents: number;
  feeConfig: PlatformFeeConfig | null;
  recentTransactions: TransactionLedgerEntry[];
  recentFees: PlatformFeeRecord[];
  providerOverrides: ProviderFeeOverride[];
  virtualBank: {
    label: string;
    bankName: string;
    accountHolderName: string;
    accountNumberMasked: string;
    ifsc: string;
    currentBalanceCents: number;
    netTicketSalesCents: number;
    ticketsSoldCount: number;
    lastPaymentAt: string | null;
  } | null;
}

export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 2;
export const DEFAULT_PLATFORM_FEE_CENTS = 0;
export const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: 'flat', label: 'Flat fee per transaction' },
  { value: 'percentage', label: 'Percentage of transaction' },
  { value: 'hybrid', label: 'Flat + percentage' },
];
export const PAYMENT_PROVIDER_OPTIONS: { value: PaymentProvider; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'meta_pay', label: 'Meta Pay' },
  { value: 'custom', label: 'Custom' },
];
