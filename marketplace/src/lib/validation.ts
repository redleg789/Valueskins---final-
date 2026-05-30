import { z } from 'zod';

// ── Event Category ────────────────────────────────────────

export const eventCategorySchema = z.enum([
  'concert', 'workshop', 'networking', 'party', 'conference',
  'exhibition', 'performance', 'screening', 'festival', 'pop-up', 'other',
]);

// ── Ticket Tier ───────────────────────────────────────────

export const ticketTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Tier name is required'),
  type: z.enum(['general', 'early-bird', 'vip', 'group', 'couple']),
  priceCents: z.number().int().min(0),
  quantity: z.number().int().min(0),
  remaining: z.number().int().min(0),
  description: z.string().max(500).default(''),
  benefits: z.array(z.string()).default([]),
});

// ── FAQ Entry ─────────────────────────────────────────────

export const faqEntrySchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1, 'Question is required').max(300),
  answer: z.string().min(1, 'Answer is required').max(2000),
});

// ── Schedule Item ─────────────────────────────────────────

export const scheduleItemSchema = z.object({
  id: z.string().min(1),
  time: z.string().min(1, 'Time is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(500).default(''),
});

// ── Third Party Tag ───────────────────────────────────────

const thirdPartyRoleSchema = z.enum([
  'DJ', 'Influencer', 'Venue Owner', 'Performer', 'Sponsor', 'Photographer',
  'Speaker', 'Guest', 'Partner', 'Featured Attendee', 'Organizer', 'Collaborator',
]);

const thirdPartyTagSchema = z.object({
  id: z.string(),
  personaId: z.number().int(),
  userId: z.number().int(),
  name: z.string(),
  role: thirdPartyRoleSchema,
  handle: z.string(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  followersCount: z.number().int(),
  descriptor: z.string(),
  hasValueSkin: z.boolean(),
  valueskins: z.array(z.string()),
  approvalState: z.enum(['pending', 'approved', 'rejected', 'hidden', 'removed']),
  isPublic: z.boolean(),
  autoApprove: z.boolean(),
});

// ── Featured Person ───────────────────────────────────────

const featuredPersonSchema = z.object({
  id: z.string().min(1),
  tag: thirdPartyTagSchema,
  featuredRole: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

// ── Full Event Creation Schema ────────────────────────────

export const createEventFormSchema = z.object({
  // Basic
  eventName: z.string().min(1, 'Event name is required').max(200),
  eventCategory: eventCategorySchema,
  eventType: z.enum(['in-person', 'virtual', 'hybrid']),
  coverImage: z.string().url('Invalid cover image URL').nullable().or(z.literal('')),
  galleryImages: z.array(z.string()).default([]),
  oneLineSummary: z.string().min(1, 'Summary is required').max(300),
  fullDescription: z.string().max(10000).default(''),
  tags: z.array(z.string().max(50)).max(30).default([]),
  eventVisibility: z.enum(['public', 'private', 'invite-only']),

  // Date & Time
  eventDate: z.string().min(1, 'Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  doorsOpenTime: z.string().default(''),
  lastEntryTime: z.string().default(''),
  timezone: z.string().min(1),

  // Location
  venueName: z.string().min(1, 'Venue name is required').max(200),
  fullAddress: z.string().min(1, 'Address is required').max(500),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  landmark: z.string().max(200).default(''),
  indoorOutdoor: z.enum(['indoor', 'outdoor', 'both']),
  parkingAvailable: z.boolean(),
  valetAvailable: z.boolean(),
  publicTransportNearby: z.boolean(),
  addressReveal: z.enum(['immediately', 'after-rsvp', 'day-before']),

  // Capacity
  maxAttendees: z.number().int().min(1, 'Must allow at least 1 attendee'),
  waitlistEnabled: z.boolean(),
  inviteLimit: z.number().int().min(0),

  // Ticketing
  ticketingModel: z.enum(['free', 'paid']),
  ticketTiers: z.array(ticketTierSchema).default([]),
  refundPolicy: z.string().max(2000).default(''),
  cancellationPolicy: z.string().max(2000).default(''),
  ticketSalesEndDate: z.string().default(''),

  // Audience
  intendedAudience: z.string().max(500).default(''),
  ageRestriction: z.number().int().min(0).max(100),
  genderPreferences: z.enum(['any', 'male', 'female', 'non-binary']),
  communitiesTargeted: z.array(z.string()).default([]),
  interestsTargeted: z.array(z.string()).default([]),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'all-levels']),

  // Featured People
  featuredPeople: z.array(featuredPersonSchema).default([]),

  // Vibe
  dressCode: z.string().max(200).default(''),
  eventVibe: z.string().max(200).default(''),
  musicGenre: z.string().max(200).default(''),
  networkingLevel: z.enum(['low', 'medium', 'high']),
  energyLevel: z.enum(['low', 'medium', 'high']),

  // Rules
  idRequired: z.boolean(),
  reentryAllowed: z.boolean(),
  alcoholRules: z.string().max(1000).default(''),
  guestRules: z.string().max(1000).default(''),
  photographyRules: z.string().max(1000).default(''),
  prohibitedItems: z.array(z.string()).default([]),
  securityRules: z.string().max(2000).default(''),

  // FAQ
  faqEntries: z.array(faqEntrySchema).default([]),

  // Contact
  hostContact: z.string().min(1, 'Host contact is required').max(200),
  supportContact: z.string().max(200).default(''),
  emergencyContact: z.string().max(200).default(''),

  // Post-Event
  eventChatEnabled: z.boolean(),
  attendeeVisibilityEnabled: z.boolean(),
  photoSharingEnabled: z.boolean(),
  networkingEnabled: z.boolean(),
  followUpsEnabled: z.boolean(),

  // Schedule
  schedule: z.array(scheduleItemSchema).default([]),

  // Logistics
  whatToBring: z.array(z.string()).default([]),
  foodAndDrink: z.string().max(1000).default(''),
  accessibility: z.string().max(1000).default(''),
  weatherContingency: z.string().max(1000).default(''),
  socialLinks: z.array(z.string()).default([]),
  eventWebsite: z.string().max(500).default(''),
  language: z.string().max(100).default(''),
});

export type ValidatedForm = z.infer<typeof createEventFormSchema>;

export function validateEventForm(data: unknown) {
  return createEventFormSchema.safeParse(data);
}

// ── Attendance application schema ─────────────────────────

export const applicationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(300),
  reason: z.string().max(2000).default(''),
});

export type ValidatedApplication = z.infer<typeof applicationSchema>;
