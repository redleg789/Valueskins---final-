import type { EventRecord } from './types';

export const INITIAL_EVENTS: EventRecord[] = [
  {
    id: 'evt-warehouse-session',
    title: 'Warehouse Session 02',
    hostName: 'Maya',
    hostValueskinIgnoredInEvents: true,
    dateLabel: 'May 24',
    timeLabel: '8:30 PM',
    venue: 'Dock 17',
    city: 'Mumbai',
    description:
      'Late-night music set with open RSVP. Host and attendee ValueSkins are ignored here. Tagged collaborators still need them.',
    access: 'RSVP',
    attendees: [
      { id: 'att-1', name: 'Rohit', status: 'going', valueskinRequired: false, valueskinIgnoredInEvents: true },
      { id: 'att-2', name: 'Anika', status: 'interested', valueskinRequired: false, valueskinIgnoredInEvents: true },
      { id: 'att-3', name: 'Dev', status: 'going', valueskinRequired: false, valueskinIgnoredInEvents: true },
    ],
    thirdPartyTags: [
      { id: 'tag-1', personaId: 101, userId: 11, name: 'DJ Nyra', role: 'DJ', handle: '@djnyra', avatarUrl: null, verified: true, followersCount: 11200, descriptor: 'Electronic DJ | Pune', hasValueSkin: true, valueskins: ['DJ'], approvalState: 'approved', isPublic: true, autoApprove: true },
      { id: 'tag-2', personaId: 102, userId: 12, name: 'Arjun Mehta', role: 'Venue Owner', handle: '@dock17owner', avatarUrl: null, verified: true, followersCount: 8900, descriptor: 'Venue Host | Mumbai', hasValueSkin: true, valueskins: ['Restaurant Owner'], approvalState: 'pending', isPublic: false, autoApprove: false },
    ],
  },
  {
    id: 'evt-rooftop-screening',
    title: 'Rooftop Creator Screening',
    hostName: 'Kabir',
    hostValueskinIgnoredInEvents: true,
    dateLabel: 'May 29',
    timeLabel: '7:00 PM',
    venue: 'Skyline Terrace',
    city: 'Bengaluru',
    description:
      'Screening night for invited creators and guests. Even if hosts or attendees have ValueSkins, events ignore them. Third-party collaborators are verified separately.',
    access: 'Open Entry',
    attendees: [
      { id: 'att-4', name: 'Naina', status: 'going', valueskinRequired: false, valueskinIgnoredInEvents: true },
      { id: 'att-5', name: 'Yash', status: 'going', valueskinRequired: false, valueskinIgnoredInEvents: true },
    ],
    thirdPartyTags: [
      { id: 'tag-3', personaId: 103, userId: 13, name: 'Vee Lens', role: 'Photographer', handle: '@veelens', avatarUrl: null, verified: false, followersCount: 4200, descriptor: 'Photographer | Bangalore', hasValueSkin: true, valueskins: ['Photographer'], approvalState: 'approved', isPublic: true, autoApprove: true },
    ],
  },
];
