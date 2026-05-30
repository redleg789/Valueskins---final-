'use client';

import { useState, useEffect } from 'react';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  primary: '#0066CC',
  success: '#22c55e',
  warning: '#f59e0b',
  accent: '#38bdf8',
};

interface EventTag {
  id: number;
  title: string;
  eventDate: string;
  status: string;
  role: string;
  hostName: string;
  location?: string;
  attendeeCount?: number;
}

interface Props {
  creatorId: number;
}

export default function CreatorEventHistory({ creatorId }: Props) {
  const [events, setEvents] = useState<EventTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventHistory();
  }, [creatorId]);

  const loadEventHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/creator-history?creatorId=${creatorId}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error loading event history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', color: C.textSecondary }}>
        Loading past events...
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '16px' }}>
        Past Events ({events.length})
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {events.map((event) => (
          <div
            key={event.id}
            style={{
              padding: '12px 16px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: '4px' }}>
                  {event.title}
                </div>
                <div style={{ color: C.textSecondary, fontSize: '11px' }}>
                  {event.hostName && <>Hosted by {event.hostName} • </>}
                  {new Date(event.eventDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  background: C.primary,
                  color: '#fff',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {event.role === 'host' ? 'Host' : event.role === 'dj' ? 'DJ' : 'Performer'}
              </div>
            </div>

            {event.location && (
              <div style={{ color: C.textSecondary, fontSize: '11px', marginBottom: '4px' }}>
                📍 {event.location}
              </div>
            )}

            {event.attendeeCount && (
              <div style={{ color: C.textSecondary, fontSize: '11px' }}>
                👥 {event.attendeeCount} attendees
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
