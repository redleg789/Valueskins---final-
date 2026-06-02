export type ThirdPartyRole =
  | 'DJ'
  | 'Influencer'
  | 'Venue Owner'
  | 'Performer'
  | 'Sponsor'
  | 'Photographer';

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
  valueskinRequired: false;
  valueskinIgnoredInEvents: true;
}

export interface EventRecord {
  id: string;
  title: string;
  hostName: string;
  hostValueskinIgnoredInEvents: true;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  city: string;
  description: string;
  access: 'Open Entry' | 'RSVP';
  attendees: EventAttendee[];
  thirdPartyTags: ThirdPartyTag[];
  publicStatusMessage?: string;
}

export interface CreateEventFormState {
  title: string;
  hostName: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  city: string;
  description: string;
  access: 'Open Entry' | 'RSVP';
}
