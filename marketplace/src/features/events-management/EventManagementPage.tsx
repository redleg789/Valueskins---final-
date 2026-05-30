'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { INITIAL_EVENTS } from './mock-data';
import { useThirdPartyValueskinCandidates } from './useThirdPartyValueskinCandidates';
import type {
  CreateEventFormState,
  EventAttendee,
  EventRecord,
  ThirdPartyRole,
  ThirdPartyTag,
} from './types';

const shell: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(180deg, #07111f 0%, #0f172a 40%, #111827 100%)',
  color: '#f8fafc',
};

const card: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.86)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.22)',
  background: 'rgba(15, 23, 42, 0.88)',
  color: '#f8fafc',
  padding: '14px 16px',
  fontSize: 14,
  outline: 'none',
};

const buttonBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
};

const initialForm: CreateEventFormState = {
  title: '',
  hostName: '',
  dateLabel: '',
  timeLabel: '',
  venue: '',
  city: '',
  description: '',
  access: 'RSVP',
};

const ROLE_OPTIONS: ThirdPartyRole[] = [
  'DJ',
  'Influencer',
  'Venue Owner',
  'Performer',
  'Sponsor',
  'Photographer',
];

const emptyTag = (): ThirdPartyTag => ({
  id: crypto.randomUUID(),
  personaId: 0,
  userId: 0,
  name: '',
  role: 'DJ',
  handle: '',
  avatarUrl: null,
  verified: false,
  followersCount: 0,
  descriptor: '',
  hasValueSkin: false,
  valueskins: [],
  approvalState: 'pending',
  isPublic: false,
  autoApprove: false,
});

function mapBackendTag(tag: {
  id: number;
  tagged_user_id: number;
  tagged_persona_id: number;
  name: string;
  handle: string;
  avatar_url: string | null;
  tag_type: string;
  badge_label: string;
  display_role: string;
  descriptor: string | null;
  approval_state: string;
  is_public: boolean;
  auto_approve: boolean;
  created_at: string;
}): ThirdPartyTag {
  return {
    id: String(tag.id),
    personaId: tag.tagged_persona_id,
    userId: tag.tagged_user_id,
    name: tag.name,
    role: tag.tag_type as ThirdPartyRole,
    handle: tag.handle,
    avatarUrl: tag.avatar_url,
    verified: tag.is_public || tag.auto_approve,
    followersCount: 0,
    descriptor: tag.descriptor || tag.display_role || tag.badge_label,
    hasValueSkin: true,
    valueskins: [tag.display_role || tag.badge_label || tag.tag_type].filter(Boolean),
    approvalState: tag.approval_state as ThirdPartyTag['approvalState'],
    isPublic: tag.is_public,
    autoApprove: tag.auto_approve,
  };
}

function mapEventResponse(event: {
  id: number;
  title: string;
  host_name: string;
  description: string | null;
  location: string;
  start_time: string;
  end_time: string | null;
  ticket_price_cents: number;
  attendee_count: number;
  lifecycle_state: string;
  public_status_message: string;
  attendee_list_public: boolean;
  is_publicly_listed: boolean;
  event_type: string;
  category: string;
  featured_people: Array<{
    id: number;
    tagged_user_id: number;
    tagged_persona_id: number;
    name: string;
    handle: string;
    avatar_url: string | null;
    tag_type: string;
    badge_label: string;
    display_role: string;
    descriptor: string | null;
    approval_state: string;
    is_public: boolean;
    auto_approve: boolean;
    created_at: string;
  }>;
}): EventRecord {
  return {
    id: String(event.id),
    title: event.title,
    hostName: event.host_name,
    hostValueskinIgnoredInEvents: true,
    dateLabel: new Date(event.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    timeLabel: new Date(event.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    venue: event.location,
    city: event.location,
    description: event.description || event.public_status_message,
    access: event.attendee_list_public ? 'RSVP' : 'Open Entry',
    attendees: [],
    thirdPartyTags: event.featured_people.map(mapBackendTag),
    publicStatusMessage: event.public_status_message,
  };
}

export default function EventManagementPage() {
  const router = useRouter();
  const { hasModule } = useAuth();
  const canHost = hasModule('host');
  const canExplore = hasModule('explorer');
  const [events, setEvents] = useState<EventRecord[]>(INITIAL_EVENTS);
  const [form, setForm] = useState<CreateEventFormState>(initialForm);
  const [draftTag, setDraftTag] = useState<ThirdPartyTag>(emptyTag());
  const [pendingTags, setPendingTags] = useState<ThirdPartyTag[]>([]);
  const [participantName, setParticipantName] = useState('');
  const [activeEventId, setActiveEventId] = useState<string>(INITIAL_EVENTS[0]?.id ?? '');
  const [tagError, setTagError] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const { candidates, isLoading: candidatesLoading, error: candidatesError } =
    useThirdPartyValueskinCandidates(tagSearch);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      const result = await api.events.getExplorerHome();
      if (cancelled || !result.data) return;
      const sourceEvents = [...result.data.upcoming_events, ...result.data.recommended_events, ...result.data.calendar];
      const nextEvents = sourceEvents.map(mapEventResponse);
      if (nextEvents.length > 0) {
        setEvents(nextEvents);
        setActiveEventId(String(nextEvents[0].id));
      }
    }
    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeEvent = useMemo(
    () => events.find((event) => event.id === activeEventId) ?? events[0] ?? null,
    [activeEventId, events]
  );

  const totalAttendees = useMemo(
    () => events.reduce((sum, event) => sum + event.attendees.length, 0),
    [events]
  );

  const totalTaggedCollaborators = useMemo(
    () => events.reduce((sum, event) => sum + event.thirdPartyTags.length, 0),
    [events]
  );

  const blockedTagNames = useMemo(() => {
    const hostNames = events.map((event) => event.hostName.trim().toLowerCase()).filter(Boolean);
    const attendeeNames = events.flatMap((event) => event.attendees.map((attendee) => attendee.name.trim().toLowerCase()));
    return new Set([...hostNames, ...attendeeNames]);
  }, [events]);

  function selectCandidate(candidate: { personaId: number; userId: number; name: string; handle: string; avatarUrl: string | null; verified: boolean; followersCount: number; descriptor: string; valueskins: string[]; primaryProfession: string | null; cursor: string }) {
    if (blockedTagNames.has(candidate.name.trim().toLowerCase())) {
      setTagError('This person is already the host or an attendee. Third-person tagging is only for a separate person who wants to be tagged.');
      return;
    }

    setDraftTag((current) => ({
      ...current,
      personaId: candidate.personaId,
      userId: candidate.userId,
      name: candidate.name,
      handle: candidate.handle,
      avatarUrl: candidate.avatarUrl,
      verified: candidate.verified,
      followersCount: candidate.followersCount,
      descriptor: candidate.descriptor,
      hasValueSkin: candidate.valueskins.length > 0,
      valueskins: candidate.valueskins,
      approvalState: 'pending',
      isPublic: false,
      autoApprove: false,
    }));
    setTagError('');
  }

  function pushPendingTag() {
    if (!draftTag.personaId || !draftTag.name.trim() || !draftTag.handle.trim()) {
      setTagError('Select the separate person who wants to be tagged from ValueSkin search results.');
      return;
    }
    if (!draftTag.hasValueSkin) {
      setTagError('Tagged third parties must have a ValueSkin before they can be attached.');
      return;
    }
    if (blockedTagNames.has(draftTag.name.trim().toLowerCase())) {
      setTagError('The tagged person cannot be the host or an attendee.');
      return;
    }

    setPendingTags((current) => [...current, { ...draftTag, name: draftTag.name.trim(), handle: draftTag.handle.trim() }]);
    setDraftTag(emptyTag());
    setTagSearch('');
    setTagError('');
  }

  async function createEvent() {
    if (
      !form.title.trim() ||
      !form.hostName.trim() ||
      !form.dateLabel.trim() ||
      !form.timeLabel.trim() ||
      !form.venue.trim() ||
      !form.city.trim()
    ) {
      return;
    }

    const start = new Date(`${form.dateLabel} ${form.timeLabel}`);
    const createResult = await api.events.createEvent({
      title: form.title.trim(),
      description: form.description.trim() || 'Event created in the new event management section.',
      location: `${form.venue.trim()}, ${form.city.trim()}`,
      start_time: start.toISOString(),
      end_time: null,
      ticket_price_cents: 0,
      community_id: null,
      latitude: null,
      longitude: null,
    });

    if (!createResult.data) {
      setTagError(createResult.error || 'Failed to create event.');
      return;
    }

    const createdTags: ThirdPartyTag[] = [];
    for (const tag of pendingTags) {
      const tagResult = await api.events.addTag(createResult.data.event_id, {
        tagged_persona_id: tag.personaId,
        tag_type: tag.role,
        badge_label: tag.role,
        display_role: tag.role,
        descriptor: tag.descriptor,
        auto_approve: tag.autoApprove,
        sort_order: 0,
      });

      if (tagResult.data) {
        createdTags.push({
          ...tag,
          id: String(tagResult.data.id),
          approvalState: tagResult.data.approval_state as ThirdPartyTag['approvalState'],
          isPublic: tagResult.data.is_public,
          autoApprove: tagResult.data.auto_approve,
        });
      } else {
        createdTags.push(tag);
      }
    }

    const nextEvent: EventRecord = {
      id: String(createResult.data.event_id),
      title: form.title.trim(),
      hostName: form.hostName.trim(),
      hostValueskinIgnoredInEvents: true,
      dateLabel: form.dateLabel.trim(),
      timeLabel: form.timeLabel.trim(),
      venue: form.venue.trim(),
      city: form.city.trim(),
      description: form.description.trim() || 'Event created in the new event management section.',
      access: form.access,
      attendees: [],
      thirdPartyTags: createdTags,
    };

    setEvents((current) => [nextEvent, ...current]);
    setActiveEventId(nextEvent.id);
    setForm(initialForm);
    setPendingTags([]);
    setTagSearch('');
    setTagError('');
  }

  function addParticipant(eventId: string) {
    if (!participantName.trim()) {
      return;
    }

    const newParticipant: EventAttendee = {
      id: crypto.randomUUID(),
      name: participantName.trim(),
      status: 'going',
      valueskinRequired: false,
      valueskinIgnoredInEvents: true,
    };

    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? { ...event, attendees: [...event.attendees, newParticipant] }
          : event
      )
    );
    setParticipantName('');
  }

   return (
       <MarketplaceLayout>
         <div style={shell}>
           <div style={{ padding: '28px 28px 40px', display: 'grid', gap: 20 }}>
          <section style={{ ...card, padding: 20, overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: -80,
                right: -40,
                width: 180,
                height: 180,
                background: 'radial-gradient(circle, rgba(34, 211, 238, 0.36), transparent 68%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', display: 'grid', gap: 12 }}>
              <span
                style={{
                  width: 'fit-content',
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'rgba(34, 211, 238, 0.14)',
                  color: '#67e8f9',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Event Management
              </span>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05 }}>
                Hosts and participants enter freely. Their ValueSkins do not matter here.
              </h1>
              <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.55 }}>
                New section built first with local workflow. Events can be created now, attendees can be added without any
                ValueSkin gate, host and attendee ValueSkins are ignored inside events, and DJs, influencers, venue owners,
                or sponsors are only accepted when marked as separate ValueSkin holders.
              </p>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <MetricCard label="Events live" value={String(events.length).padStart(2, '0')} accent="#38bdf8" />
            <MetricCard label="Open attendees" value={String(totalAttendees).padStart(2, '0')} accent="#f59e0b" />
            <MetricCard label="Tagged pros" value={String(totalTaggedCollaborators).padStart(2, '0')} accent="#34d399" />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 480px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 64 }}>
              {canHost && <section style={{ ...card, padding: 22, display: 'grid', gap: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Create Event</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                    Separate event section with built-in rules: host and attendee ValueSkins are ignored, third-person tags are not.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Event title">
                    <input
                      value={form.title}
                      onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                      placeholder="Sunset Launch Party"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Host name">
                    <input
                      value={form.hostName}
                      onChange={(e) => setForm((current) => ({ ...current, hostName: e.target.value }))}
                      placeholder="Who is hosting?"
                      style={inputStyle}
                    />
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Date">
                      <input
                        value={form.dateLabel}
                        onChange={(e) => setForm((current) => ({ ...current, dateLabel: e.target.value }))}
                        placeholder="June 02"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Time">
                      <input
                        value={form.timeLabel}
                        onChange={(e) => setForm((current) => ({ ...current, timeLabel: e.target.value }))}
                        placeholder="9:00 PM"
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <Field label="Venue">
                      <input
                        value={form.venue}
                        onChange={(e) => setForm((current) => ({ ...current, venue: e.target.value }))}
                        placeholder="Moonlit Courtyard"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="City">
                      <input
                        value={form.city}
                        onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))}
                        placeholder="Goa"
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <Field label="Entry type">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['RSVP', 'Open Entry'] as const).map((option) => {
                        const selected = form.access === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, access: option }))}
                            style={{
                              ...buttonBase,
                              flex: 1,
                              padding: '12px 14px',
                              background: selected ? '#22d3ee' : 'rgba(15, 23, 42, 0.82)',
                              color: selected ? '#082f49' : '#cbd5e1',
                              border: selected ? 'none' : '1px solid rgba(148, 163, 184, 0.22)',
                            }}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Description">
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                      placeholder="What is this event about?"
                      style={{ ...inputStyle, minHeight: 104, resize: 'vertical' }}
                    />
                  </Field>
                </div>

                <div style={{ ...card, padding: 16, borderRadius: 18, background: 'rgba(8, 47, 73, 0.72)' }}>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Third Person Feature</h3>
                    <p style={{ margin: 0, color: '#bae6fd', fontSize: 13, lineHeight: 1.45 }}>
                      This is only for a separate person who wants to be tagged: DJ, influencer, venue owner, performer,
                      photographer, or sponsor. It is not for the host and not for attendees, even if those people have ValueSkins.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                    <Field label="Find the separate person who wants to be tagged">
                      <input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search ValueSkin holder by name or handle"
                        style={inputStyle}
                      />
                    </Field>

                    {tagSearch.trim().length >= 2 ? (
                      <div
                        style={{
                          display: 'grid',
                          gap: 8,
                          padding: 12,
                          borderRadius: 16,
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                          background: 'rgba(15, 23, 42, 0.72)',
                          maxHeight: 240,
                          overflowY: 'auto',
                        }}
                      >
                        {candidatesLoading ? <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>Searching ValueSkin holders...</p> : null}
                        {!candidatesLoading && candidatesError ? (
                          <p style={{ margin: 0, color: '#fca5a5', fontSize: 12 }}>{candidatesError}</p>
                        ) : null}
                        {!candidatesLoading && !candidatesError && candidates.length === 0 ? (
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>
                            No separate ValueSkin holder found for this search.
                          </p>
                        ) : null}
                        {candidates.map((candidate) => (
                          <button
                            key={candidate.personaId}
                            type="button"
                            onClick={() => selectCandidate(candidate)}
                            style={{
                              ...buttonBase,
                              padding: '12px 14px',
                              borderRadius: 16,
                              textAlign: 'left',
                              background:
                                draftTag.personaId === candidate.personaId ? 'rgba(34, 211, 238, 0.18)' : 'rgba(8, 47, 73, 0.8)',
                              color: '#f8fafc',
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{candidate.name}</div>
                            <div style={{ color: '#bae6fd', fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{candidate.handle}</span>
                                {candidate.verified ? <span style={{ color: '#86efac' }}>Verified</span> : null}
                              </div>
                              <div>{candidate.descriptor} • {candidate.valueskins.join(', ')}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Role">
                        <select
                          value={draftTag.role}
                          onChange={(e) =>
                            setDraftTag((current) => ({ ...current, role: e.target.value as ThirdPartyRole }))
                          }
                          style={inputStyle}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Handle">
                        <input
                          value={draftTag.handle}
                          readOnly
                          placeholder="@selected-person"
                          style={inputStyle}
                        />
                      </Field>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 16,
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        background: 'rgba(15, 23, 42, 0.8)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>Selected person has a ValueSkin</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>This check comes from the selected separate profile.</div>
                      </div>
                      <div
                        style={{
                          ...buttonBase,
                          width: 74,
                          padding: 6,
                          textAlign: 'center',
                          background: draftTag.hasValueSkin ? '#10b981' : '#ef4444',
                          color: '#f8fafc',
                        }}
                      >
                        {draftTag.hasValueSkin ? 'Yes' : 'No'}
                      </div>
                    </div>

                    {tagError ? <p style={{ margin: 0, color: '#fca5a5', fontSize: 12 }}>{tagError}</p> : null}

                    <button
                      type="button"
                      onClick={pushPendingTag}
                      style={{
                        ...buttonBase,
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, #0ea5e9, #22d3ee)',
                        color: '#082f49',
                      }}
                    >
                      Add tagged collaborator
                    </button>
                  </div>

                  {pendingTags.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                      {pendingTags.map((tag) => (
                        <div
                          key={tag.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '12px 14px',
                            borderRadius: 16,
                            background: 'rgba(12, 74, 110, 0.72)',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{tag.name}</div>
                            <div style={{ color: '#bae6fd', fontSize: 12 }}>
                              {tag.role} • {tag.handle} • {tag.descriptor} • {tag.valueskins.join(', ')}
                            </div>
                          </div>
                          <span style={{ color: '#86efac', fontSize: 12, fontWeight: 700 }}>
                            {tag.approvalState === 'approved' ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={createEvent}
                  style={{
                    ...buttonBase,
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, #f97316, #fb7185)',
                    color: '#fff7ed',
                    fontSize: 15,
                  }}
                >
                  Create event
                </button>
              </section>}
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {events.map((event) => {
                  const isActive = activeEvent?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setActiveEventId(event.id)}
                      style={{
                        ...card,
                        padding: 18,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: isActive ? '1px solid rgba(34, 211, 238, 0.65)' : card.border,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <span style={{ color: '#67e8f9', fontSize: 12, fontWeight: 700 }}>{event.access}</span>
                          <h3 style={{ margin: 0, fontSize: 20 }}>{event.title}</h3>
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
                            Hosted by {event.hostName} • {event.venue}, {event.city}
                          </p>
                        </div>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 18,
                            background: 'rgba(56, 189, 248, 0.14)',
                            color: '#bae6fd',
                            minWidth: 72,
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{event.dateLabel}</div>
                          <div style={{ fontSize: 12 }}>{event.timeLabel}</div>
                        </div>
                      </div>

                      <p style={{ margin: '12px 0 0', color: '#cbd5e1', lineHeight: 1.5 }}>{event.description}</p>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                        <Pill tone="warm">{event.attendees.length} open attendees</Pill>
                        <Pill tone="cool">{event.thirdPartyTags.length} tagged collaborators</Pill>
                        <Pill tone="success">Host and attendee ValueSkins are ignored</Pill>
                      </div>
                    </button>
                  );
                })}
              </section>

              {activeEvent ? (
                <section style={{ ...card, padding: 22, display: 'grid', gap: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Live Event Control</h2>
                <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }}>
                  Manage attendance and tagged third parties for {activeEvent.title}.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 18,
                  background: 'rgba(20, 83, 45, 0.55)',
                  border: '1px solid rgba(134, 239, 172, 0.24)',
                }}
              >
                <strong style={{ fontSize: 14 }}>Attendance rule</strong>
                <span style={{ color: '#dcfce7', fontSize: 13, lineHeight: 1.5 }}>
                  Anyone can host or attend. If a host or attendee has a ValueSkin elsewhere on ValueSkins, it carries no
                  value inside this events section.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <input
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Add participant name"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => addParticipant(activeEvent.id)}
                  style={{
                    ...buttonBase,
                    padding: '0 18px',
                    background: '#e2e8f0',
                    color: '#0f172a',
                  }}
                >
                  Add attendee
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Participants</h3>
                {activeEvent.attendees.length > 0 ? (
                  activeEvent.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: 'rgba(15, 23, 42, 0.72)',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{attendee.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{attendee.status}</div>
                      </div>
                      <span style={{ color: '#fdba74', fontSize: 12, fontWeight: 700 }}>No ValueSkin required</span>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>No participants added yet.</p>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Tagged Third Parties</h3>
                {activeEvent.thirdPartyTags.length > 0 ? (
                  activeEvent.thirdPartyTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => router.push(`/profile/${tag.personaId}`)}
                      style={{
                        ...buttonBase,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: 'rgba(8, 47, 73, 0.7)',
                        color: '#f8fafc',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{tag.name}</div>
                        <div style={{ color: '#bae6fd', fontSize: 12 }}>
                          {tag.role} • {tag.handle} • {tag.descriptor} • {tag.valueskins.join(', ')}
                        </div>
                      </div>
                      <span style={{ color: '#86efac', fontSize: 12, fontWeight: 700 }}>
                        {tag.approvalState === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </button>
                  ))
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>No collaborators tagged yet.</p>
                )}
              </div>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </MarketplaceLayout>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        ...card,
        padding: '16px 12px',
        borderRadius: 20,
        background: 'rgba(15, 23, 42, 0.84)',
      }}
    >
      <div style={{ color: accent, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: 'warm' | 'cool' | 'success' }) {
  const palette = {
    warm: { background: 'rgba(249, 115, 22, 0.15)', color: '#fdba74' },
    cool: { background: 'rgba(14, 165, 233, 0.15)', color: '#7dd3fc' },
    success: { background: 'rgba(16, 185, 129, 0.16)', color: '#86efac' },
  }[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: 999,
        background: palette.background,
        color: palette.color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
