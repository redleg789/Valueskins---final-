import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const C = {
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
};

interface ApplicationInfo {
  id: string;
  eventId: string;
  status: string;
  createdAt: string;
}

export default function UpcomingEventsPage() {
  const { account, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!account) {
      router.replace('/auth/login?redirect=/upcoming-events');
      return;
    }

    async function fetchUpcoming() {
      try {
        // Use the dedicated /api/events/applied endpoint that queries
        // the event_applications table for the currently logged-in user.
        const res = await fetch('/api/events/applied', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load applied events');
        const data = await res.json();

        const myEvents = data.events || [];
        const myApps: ApplicationInfo[] = data.applications || [];

        // Sort by event date ascending (soonest first)
        myEvents.sort((a: any, b: any) => {
          const dateA = a.form?.eventDate || '';
          const dateB = b.form?.eventDate || '';
          return dateA.localeCompare(dateB);
        });

        setEvents(myEvents);
        setApplications(myApps);
      } catch (err) {
        console.error('Failed to fetch upcoming events:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUpcoming();
  }, [account, authLoading, router]);

  function getAppStatus(eventId: string): string {
    const app = applications.find(a => a.eventId === eventId);
    if (!app) return 'registered';
    return app.status;
  }

  function statusLabel(status: string, requiresApproval: boolean): { text: string; bg: string; color: string } {
    switch (status) {
      case 'approved':
        return {
          text: requiresApproval ? 'Approved · Attending' : 'Registered',
          bg: 'rgba(134,239,172,0.15)',
          color: '#86efac'
        };
      case 'pending':
        return {
          text: requiresApproval ? 'Pending Review' : 'Registered',
          bg: requiresApproval ? 'rgba(250,204,21,0.15)' : 'rgba(134,239,172,0.15)',
          color: requiresApproval ? '#fde047' : '#86efac'
        };
      case 'rejected':
        return { text: 'Not Approved', bg: 'rgba(252,165,165,0.15)', color: '#fca5a5' };
      default:
        return { text: 'Registered', bg: 'rgba(134,239,172,0.15)', color: '#86efac' };
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(180deg, #07111f 0%, #0f172a 40%, #111827 100%)',
      }}>
        Loading upcoming events...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #07111f 0%, #0f172a 40%, #111827 100%)',
      color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>My Upcoming Events</h1>
          <Link href="/events" style={{ color: C.accent, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            Browse more events
          </Link>
        </div>

        {events.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
            padding: 40, textAlign: 'center'
          }}>
            <p style={{ color: C.textMuted, fontSize: 15, margin: '0 0 20px' }}>
              You haven't registered for any upcoming events yet.
            </p>
            <Link href="/events" style={{
              display: 'inline-block', background: C.accent, color: '#082f49',
              padding: '12px 24px', borderRadius: 999, textDecoration: 'none', fontWeight: 700
            }}>
              Find an event
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {events.map(event => {
              const status = getAppStatus(event.id);
              const badge = statusLabel(status, !!event.form?.entryApprovalRequired);
              return (
                <div key={event.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: 20
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{event.form.eventName}</h2>
                      <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 12px' }}>
                        {event.form.venueName || event.form.fullAddress || 'Location TBD'}
                      </p>
                      <div style={{
                        display: 'inline-block', padding: '4px 12px',
                        background: badge.bg, color: badge.color,
                        borderRadius: 999, fontSize: 12, fontWeight: 600
                      }}>
                        {badge.text}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px 16px', borderRadius: 16, background: C.accentBg, color: '#bae6fd', minWidth: 70, flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>
                        {new Date(event.form.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{event.form.startTime || ''}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
