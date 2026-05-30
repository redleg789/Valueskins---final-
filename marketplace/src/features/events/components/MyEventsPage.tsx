'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { EventRecord } from '../data/types';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5',
  success: '#86efac',
  warning: '#fbbf24',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '10px 20px',
  fontSize: 13,
};

type Tab = 'hosted' | 'applied' | 'featured' | 'manage';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface Application {
  id: string;
  eventId: string;
  applicantName: string;
  applicantEmail: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}

function formatApplicationStatus(status: Application['status'], requiresApproval: boolean) {
  if (!requiresApproval) {
    if (status === 'approved') return 'registered';
    if (status === 'pending') return 'registered';
  }
  return status;
}

export default function MyEventsPage({ onBack, onEdit, onCreate }: {
  onBack: () => void;
  onEdit: (event: EventRecord) => void;
  onCreate: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('hosted');
  const [selectedManageEventId, setSelectedManageEventId] = useState<string | null>(null);
  const [hosted, setHosted] = useState<EventRecord[]>([]);
  const [applied, setApplied] = useState<EventRecord[]>([]);
  const [featured, setFeatured] = useState<EventRecord[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const [hostedRes, appliedRes, featuredRes] = await Promise.all([
        fetch('/api/events/hosted'),
        fetch('/api/events/applied'),
        fetch('/api/events/featured'),
      ]);
      if (!hostedRes.ok || !appliedRes.ok || !featuredRes.ok) throw new Error('Failed to fetch');
      const hostedData = await hostedRes.json();
      const appliedData = await appliedRes.json();
      const featuredData = await featuredRes.json();
      setHosted(hostedData.events || []);
      setApplied(appliedData.events || []);
      setFeatured(featuredData.events || []);
      setApplications(appliedData.applications || []);
      setStatus('success');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setStatus('error');
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function cancelEvent(eventId: string) {
    if (!confirm('Cancel this event? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel');
      await fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function getStatusBadge(event: EventRecord): { label: string; color: string } {
    switch (event.visibilityStatus) {
      case 'active': return { label: 'Live', color: C.success };
      case 'ended_visible': return { label: 'Ended', color: C.warning };
      case 'archived': return { label: 'Cancelled', color: C.error };
      default: return { label: 'Unknown', color: C.textMuted };
    }
  }

  if (status === 'loading') return <Skeleton />;
  if (status === 'error') return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      <div style={{ ...card, padding: 24 }}>
        <BackButton onClick={onBack} />
        <h2 style={{ margin: '12px 0 16px', fontSize: 24, fontWeight: 800 }}>My Events</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4 }}>
          {(['hosted', 'applied', 'featured', 'manage'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...btnBase, flex: 1, padding: '10px',
                background: tab === t ? C.accent : 'transparent',
                color: tab === t ? '#082f49' : C.textMuted,
                fontSize: 13,
              }}
            >
              {t === 'hosted' ? `Hosted (${hosted.length})` : t === 'applied' ? `Applied (${applied.length})` : t === 'featured' ? `Featured (${featured.length})` : 'Manage'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'hosted' && (
        <>
          {hosted.filter(e => e.visibilityStatus !== 'archived').length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 16px' }}>You haven't hosted any events yet.</p>
              <button onClick={onCreate} style={{ ...btnBase, background: C.accent, color: '#082f49', padding: '12px 28px', fontSize: 14 }}>Create an event</button>
            </div>
          ) : (
            <>
              {hosted.filter(e => e.visibilityStatus !== 'archived').map(event => {
                const badge = getStatusBadge(event);
                const f = event.form;
                return (
                  <div key={event.id} style={{ ...card, padding: 18, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: 'pointer' }} onClick={() => router.push(`/events/${event.id}`)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{f.eventName}</div>
                        <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
                          {f.eventDate} | {f.venueName}
                        </p>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: `${badge.color}22`, color: badge.color, fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          setSelectedManageEventId(event.id);
                          setTab('manage');
                        }}
                        style={{ ...btnBase, background: 'rgba(192,132,252,0.1)', color: '#c084fc', fontSize: 12 }}
                      >
                        Analytics & Signups
                      </button>
                      <button onClick={() => onEdit(event)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>Edit</button>
                      <button onClick={() => cancelEvent(event.id)} style={{ ...btnBase, background: 'rgba(252,165,165,0.12)', color: C.error, fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                );
              })}
              {hosted.filter(e => e.visibilityStatus === 'archived').length > 0 && (
                <div style={{ marginTop: 32, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text }}>Cancelled Events ({hosted.filter(e => e.visibilityStatus === 'archived').length})</h3>
                  {hosted.filter(e => e.visibilityStatus === 'archived').map(event => {
                    const f = event.form;
                    return (
                      <div key={event.id} style={{ ...card, padding: 14, display: 'grid', gap: 8, opacity: 0.7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{f.eventName}</div>
                            <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: 12 }}>
                              {f.eventDate} | {f.venueName}
                            </p>
                          </div>
                          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(252,165,165,0.12)', color: C.error, fontSize: 11, fontWeight: 700 }}>Cancelled</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'applied' && (
        <>
          {applied.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>You haven't applied to any events yet.</p>
            </div>
          ) : (
            applied.map(event => {
              const app = applications.find(a => a.eventId === event.id);
              const f = event.form;
              return (
                <div key={event.id} style={{ ...card, padding: 18, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{f.eventName}</div>
                  <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{f.eventDate} | {f.venueName}</p>
                  {app && (
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={app.status} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {tab === 'featured' && (
        <>
          {featured.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>You haven't been tagged in any events yet.</p>
            </div>
          ) : (
            featured.map(event => {
              const f = event.form;
              return (
                <div key={event.id} style={{ ...card, padding: 18, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: 'pointer' }} onClick={() => router.push(`/events/${event.id}`)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{f.eventName}</div>
                      <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
                        {f.eventDate} | {f.venueName}
                      </p>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: C.success, fontSize: 12, fontWeight: 700 }}>Featured</span>
                  </div>
                  <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{f.oneLineSummary}</p>
                </div>
              );
            })
          )}
        </>
      )}

      {tab === 'manage' && (
        <ManageApplicationsTab
          hosted={hosted}
          initialSelectedEventId={selectedManageEventId}
          onBack={() => setTab('hosted')}
        />
      )}
    </div>
  );
}

// ── Manage Applications ────────────────────────────────────

function ManageApplicationsTab({ hosted, initialSelectedEventId, onBack }: {
  hosted: EventRecord[];
  initialSelectedEventId: string | null;
  onBack: () => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialSelectedEventId);
  const [apps, setApps] = useState<Application[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    setSelectedEventId(initialSelectedEventId);
  }, [initialSelectedEventId]);

  useEffect(() => {
    if (initialSelectedEventId) {
      loadApps(initialSelectedEventId);
    }
  }, [initialSelectedEventId]);

  async function loadApps(eventId: string) {
    setSelectedEventId(eventId);
    setStatus('loading');
    try {
      const res = await fetch(`/api/events/${eventId}/applications`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setApps(data.applications || []);
      setStatus('success');
    } catch {
      setApps([]);
      setStatus('error');
    }
  }

  async function decide(appId: string, action: 'approve' | 'reject') {
    const eventId = selectedEventId;
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/applications/${appId}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: action === 'approve' ? 'approved' as const : 'rejected' as const } : a));
    } catch { /* ignore */ }
  }

  function exportApplicants() {
    if (!selectedEventId || apps.length === 0) return;
    const rows = [
      ['Applicant', 'Email', 'Status', 'Reason', 'Applied At'],
      ...apps.map((app) => [
        app.applicantName,
        app.applicantEmail,
        app.status,
        app.reason.replace(/\s+/g, ' ').trim(),
        app.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-applicants-${selectedEventId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const selectedEvent = hosted.find((event) => event.id === selectedEventId) || null;
  const requiresApproval = !!selectedEvent?.form.entryApprovalRequired;
  const approvedCount = apps.filter((app) => app.status === 'approved').length;
  const pendingCount = apps.filter((app) => app.status === 'pending').length;
  const rejectedCount = apps.filter((app) => app.status === 'rejected').length;
  const totalCount = apps.length;
  const conversionRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const capacity = selectedEvent?.form.maxAttendees || 0;
  const confirmedCount = requiresApproval ? approvedCount : totalCount;
  const occupancyRate = capacity > 0 ? Math.min(100, Math.round((confirmedCount / capacity) * 100)) : 0;
  const spotsLeft = capacity > 0 ? Math.max(capacity - confirmedCount, 0) : null;

  if (!selectedEventId) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ color: C.textMuted, fontSize: 14 }}>Select an event to view its registrations:</p>
        {hosted.filter(e => e.visibilityStatus === 'active').map(event => (
          <button
            key={event.id}
            onClick={() => loadApps(event.id)}
            style={{
              ...card, padding: 16, textAlign: 'left', cursor: 'pointer',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, color: C.text, width: '100%',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>{event.form.eventName}</div>
            <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>{event.form.eventDate}</div>
          </button>
        ))}
      </div>
    );
  }

  if (status === 'loading') return <p style={{ color: C.textMuted }}>Loading applications...</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, textAlign: 'left', padding: 0 }}>Back to events</button>
      <div style={{ ...card, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {requiresApproval ? 'Applications' : 'Registrations'} — {selectedEvent?.form.eventName}
            </h3>
            <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              {requiresApproval
                ? 'Review applicants, export leads, and track approval conversion.'
                : 'Track registrations, capacity, and attendee details.'}
            </div>
          </div>
          <button onClick={exportApplicants} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>
            Export CSV
          </button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              {capacity > 0
                ? `${confirmedCount} of ${capacity} spots filled`
                : `${confirmedCount} ${confirmedCount === 1 ? 'registration' : 'registrations'}`}
            </div>
            {spotsLeft !== null && (
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {spotsLeft} spots left
              </div>
            )}
          </div>
          <div style={{ height: 10, borderRadius: 999, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${capacity > 0 ? occupancyRate : 100}%`,
                height: '100%',
                borderRadius: 999,
                background: occupancyRate >= 100 ? '#f97316' : C.accent,
                transition: 'width 180ms ease',
              }}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <MetricCard label={requiresApproval ? 'Applicants' : 'Registrations'} value={totalCount} />
          <MetricCard label={requiresApproval ? 'Approved' : 'Confirmed'} value={confirmedCount} />
          <MetricCard label="Pending" value={requiresApproval ? pendingCount : 0} />
          <MetricCard label="Rejected" value={requiresApproval ? rejectedCount : 0} />
          <MetricCard label={capacity > 0 ? 'Capacity' : 'Conversion'} value={capacity > 0 ? `${occupancyRate}%` : `${conversionRate}%`} />
        </div>
      </div>
      {apps.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 14 }}>
          No {requiresApproval ? 'applications' : 'registrations'} yet.
        </p>
      ) : (
        apps.map(app => (
          <div key={app.id} style={{ padding: 16, borderRadius: 16, background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{app.applicantName}</div>
                <div style={{ color: C.textMuted, fontSize: 13 }}>{app.applicantEmail}</div>
              </div>
              <StatusBadge status={formatApplicationStatus(app.status, requiresApproval)} />
            </div>
            {app.reason && <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>{app.reason}</p>}
            {requiresApproval && app.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => decide(app.id, 'approve')} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>Approve</button>
                <button onClick={() => decide(app.id, 'reject')} style={{ ...btnBase, background: 'rgba(252,165,165,0.12)', color: C.error, fontSize: 12 }}>Reject</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: C.warning, bg: `${C.warning}22` },
    approved: { label: 'Approved', color: C.success, bg: `${C.success}22` },
    registered: { label: 'Registered', color: C.success, bg: `${C.success}22` },
    rejected: { label: 'Rejected', color: C.error, bg: `${C.error}22` },
    cancelled: { label: 'Cancelled', color: C.textMuted, bg: `${C.textMuted}22` },
  };
  const c = config[status] || config.pending;
  return <span style={{ padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 12, fontWeight: 700 }}>{c.label}</span>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left', width: 'fit-content' }}>Back</button>;
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 20 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ ...card, padding: 20, display: 'grid', gap: 8 }}>
          <div style={{ height: 20, width: '60%', borderRadius: 6, background: 'rgba(148,163,184,0.1)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 14, width: '40%', borderRadius: 6, background: 'rgba(148,163,184,0.08)', animation: 'pulse 1.5s infinite' }} />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, padding: 40, textAlign: 'center' }}>
      <p style={{ color: C.error, fontSize: 14, margin: '0 0 16px' }}>{message}</p>
      <button onClick={onRetry} style={{ ...btnBase, background: C.accent, color: '#082f49' }}>Retry</button>
    </div>
  );
}
