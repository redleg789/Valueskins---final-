// @ts-nocheck
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import type { EventRecord, BusinessProfile } from './data/types';
import { DEFAULT_FILTERS } from './components/BrowseFilters';
import type { FilterValues } from './components/BrowseFilters';
import { GenderEntryBadge, BagSecurityBadge, TableSeatingBadge } from './components/EfficiencyFormSections';

const CreateEventForm = dynamic(() => import('./components/CreateEventForm'));
const MyEventsPage = dynamic(() => import('./components/MyEventsPage'));
const BrowseFilters = dynamic(() => import('./components/BrowseFilters').then((m) => m.BrowseFilters));
const BusinessProfileForm = dynamic(() => import('./components/BusinessProfileForm'));
const HostDashboard = dynamic(() => import('./components/HostDashboard'));
const EventTicketPanel = dynamic(() => import('./components/EventTicketPanel'));
const CheckInPage = dynamic(() => import('./components/CheckInPage'));
const AnnouncementsBar = dynamic(() => import('./components/AnnouncementsBar'));
const EventChatView = dynamic(() => import('./components/EventChatView'));
const SafetyHub = dynamic(() => import('./components/SafetyHub'));
const GroupView = dynamic(() => import('./components/GroupView'));
const AIFAQSection = dynamic(() => import('./components/AIFAQSection'));
const ArrivalInfoView = dynamic(() => import('./components/ArrivalInfoView'));
const PostEventPanel = dynamic(() => import('./components/PostEventPanel'));
const CommandCenterView = dynamic(() => import('./components/CommandCenterView'));
const AutomationPanel = dynamic(() => import('./components/AutomationPanel'));
const CalendarIntegration = dynamic(() => import('./components/CalendarIntegration'));
const FraudRiskDashboard = dynamic(() => import('./components/FraudRiskDashboard'));
const WaitlistAutomationPanel = dynamic(() => import('./components/WaitlistAutomationPanel'));
const SupportCenter = dynamic(() => import('./components/SupportCenter'));
const VerifiedHostWorkflow = dynamic(() => import('./components/VerifiedHostWorkflow').then((m) => m.VerifiedHostWorkflow));
const PaymentSettingsPage = dynamic(() => import('./components/PaymentSettingsPage'));
const MatchingEngine = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.MatchingEngine));
const AudienceIntel = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.AudienceIntel));
const EventMemory = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.EventMemory));
const NetworkGraph = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.NetworkGraph));
const PostEventConnections = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.PostEventConnections));
const TribePanel = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.TribePanel));
const HostCRM = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.HostCRM));
const LoyaltyPanel = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.LoyaltyPanel));
const ReputationPanel = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.ReputationPanel));
const VenueIntel = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.VenueIntel));
const AdminIntelligence = dynamic(() => import('./components/IntelligenceSystems').then((m) => m.AdminIntelligence));

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
  gradient: 'linear-gradient(135deg, #f97316, #fb7185)',
};

const shell: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #07111f 0%, #0f172a 40%, #111827 100%)',
  color: C.text,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)',
  color: C.text,
  padding: '14px 16px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '14px 28px',
};

type Page = 'landing' | 'host-type' | 'host-settings' | 'host' | 'browse' | 'my-events' | 'edit' | 'venue' | 'venue-setup' | 'promoter-dashboard' | 'verified-host' | 'payments' | 'admin';

export default function EventManagementPage() {
  const router = useRouter();
  const { account, hasModule } = useAuth();
  const [page, setPage] = useState<Page>('landing');
  const [editTarget, setEditTarget] = useState<EventRecord | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showValueskinRequired, setShowValueskinRequired] = useState(false);

  useEffect(() => {
    if (router.query.view === 'my-events') {
      setPage('my-events');
    }
  }, [router.query.view]);

  useEffect(() => {
    if (page === 'my-events') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [page]);

  function handleEdit(event: EventRecord) {
    setEditTarget(event);
    setPage('edit');
  }

  function handleCreated() {
    setEditTarget(null);
    setPage('browse');
  }

  async function goToVenue() {
    setProfileLoading(true);
    setPage('venue');
    try {
      const res = await fetch('/api/business-profiles/mine');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setPage('venue-setup');
      }
    } catch {
      setPage('venue-setup');
    } finally {
      setProfileLoading(false);
    }
  }

  async function goToHost() {
    setProfileLoading(true);
    try {
      const res = await fetch('/api/business-profiles/mine');
      if (res.ok) setProfile(await res.json());
    } catch { /* ignore */ }
    setProfileLoading(false);
    setPage('host-type');
  }

  return (
    <div style={shell}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        {page === 'landing' && <Landing onSelect={p => setPage(p)} onVenue={goToVenue} />}
        {page === 'host-type' && <HostTypeStep onSelect={(t) => {
          if (t === 'recurring' && !hasModule('valueskin')) {
            setShowValueskinRequired(true);
            return;
          }
          setPage('host-settings');
        }} onBack={() => setPage('landing')} />}
        {page === 'host-settings' && <HostSettingsStep onBack={() => setPage('host-type')} onContinue={() => setPage('host')} />}
        {page === 'host' && <CreateEventForm onBack={() => setPage('landing')} onCreated={() => setPage('my-events')} />}
{page === 'edit' && editTarget && (
           <CreateEventForm
             key={editTarget.id}
             initialData={editTarget.form}
             eventId={editTarget.id}
             onBack={() => { setPage('browse'); setEditTarget(null); }}
             onCreated={() => { setPage('my-events'); setEditTarget(null); }}
           />
         )}
        {page === 'browse' && <BrowseFlow onBack={() => setPage('landing')} onMyEvents={() => setPage('my-events')} />}
        {page === 'my-events' && (
          <MyEventsPage
            onBack={() => setPage('landing')}
            onEdit={handleEdit}
            onCreate={() => setPage('host')}
          />
        )}
        {page === 'venue' && profile && (
          <HostDashboard
            profile={profile}
            onBack={() => setPage('landing')}
            onEditProfile={() => setPage('venue-setup')}
          />
        )}
        {page === 'venue-setup' && (
          <BusinessProfileForm
            initial={profile || undefined}
            onBack={() => { setProfile(null); setPage('landing'); }}
            onSaved={(p) => { setProfile(p); setPage('venue'); }}
          />
        )}
        {page === 'verified-host' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <BackButton onClick={() => setPage('landing')} />
            <VerifiedHostWorkflow onStatusChange={() => {}} />
          </div>
        )}
        {page === 'payments' && <PaymentSettingsPage />}
        {page === 'admin' && <AdminIntelligence />}
      </div>

      {/* ValueSkin Required Overlay */}
      {showValueskinRequired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(2,6,23,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: C.surface, borderRadius: 16, maxWidth: 440, width: '100%',
            padding: 40, textAlign: 'center', border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏅</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>ValueSkin Required</h3>
            <p style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              Recurring events are only available to verified ValueSkin holders.
              <br /><br />
              <a href="/auth/onboarding" style={{ color: C.accent }}>Get your ValueSkin</a> to unlock recurring event hosting.
            </p>
            <button onClick={() => setShowValueskinRequired(false)}
              style={{
                border: `1px solid ${C.border}`, borderRadius: 8,
                background: 'transparent', color: C.text, cursor: 'pointer',
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
              }}>
              Go back
            </button>
          </div>
        </div>
      )}

      {/* Global Support Center (Need Help) */}
      {showSupport && (
        <div style={{ position: 'fixed', bottom: 80, right: 20, width: 420, maxHeight: '70vh', overflow: 'auto', zIndex: 1000 }}>
          <div style={{ position: 'relative' }}>
            <SupportCenter />
            <button onClick={() => setShowSupport(false)}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 4 }}>X</button>
          </div>
        </div>
      )}
      <button onClick={() => setShowSupport(!showSupport)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
          padding: '14px 24px', fontSize: 14,
          background: C.accent, color: '#082f49',
        }}>
        Need Help?
      </button>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────

function Landing({ onSelect, onVenue }: { onSelect: (p: Page) => void; onVenue: () => void }) {
  const { account } = useAuth();
  return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>Events</h1>
      <p style={{ color: C.textMuted, fontSize: 15, margin: '0 0 48px' }}>
        Host something or find something to do.
      </p>
      <div style={{ display: 'grid', gap: 20, maxWidth: 400, margin: '0 auto' }}>
        <ChoiceCard
          title="Host an event"
          desc="Create, schedule, and manage your event"
          onClick={() => {
            if (!account) {
              window.location.href = '/auth/login?redirect=/events';
              return;
            }
            onSelect('host-type');
          }}
        />
        <ChoiceCard
          title="Browse events"
          desc="See what's happening and join in"
          onClick={() => onSelect('browse')}
        />
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={() => onSelect('my-events')}
          style={{ ...btnBase, background: 'rgba(148,163,184,0.1)', color: C.textMuted, fontSize: 13, padding: '10px 24px' }}
        >
          My Events
        </button>
        <button
          onClick={onVenue}
          style={{ ...btnBase, background: 'rgba(56,189,248,0.1)', color: C.accent, fontSize: 13, padding: '10px 24px' }}
        >
          My Venue
        </button>
        <button
          onClick={() => onSelect('payments')}
          style={{ ...btnBase, background: 'rgba(250,204,21,0.1)', color: '#fbbf24', fontSize: 13, padding: '10px 24px' }}
        >
          Payments
        </button>
        <button
          onClick={() => onSelect('admin')}
          style={{ ...btnBase, background: 'rgba(192,132,252,0.1)', color: '#c084fc', fontSize: 13, padding: '10px 24px' }}
        >
          Admin
        </button>
      </div>
    </div>
  );
}

// ── Host Type Step ────────────────────────────────────────

function HostTypeStep({ onSelect, onBack }: { onSelect: (t: 'one-time' | 'recurring') => void; onBack: () => void }) {
  return (
    <div style={{ paddingTop: '40px' }}>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 4px' }}>What kind of event?</h2>
      <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 32px' }}>
        Choose the hosting model that fits your needs.
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        <ChoiceCard
          title="One Time"
          desc="A single event: parties, concerts, workshops, networking"
          onClick={() => onSelect('one-time')}
        />
        <div
          style={{
            background: '#000',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '20px',
            padding: '28px 24px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '5px 10px',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: '999px',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '14px',
            }}
          >
            Recurring Events
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05, marginBottom: '10px' }}>
            Will be launched soon
          </div>
          <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 1.6 }}>
            Recurring event hosting is being prepared and will go live soon.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Host Settings Step ────────────────────────────────────

function HostSettingsStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [settings, setSettings] = useState({
    genderRules: true,
    bagPolicy: true,
    tableSeating: false,
    calendarSync: true,
    waitlistAutomation: true,
    fraudDetection: true,
    platformFee: '2%',
  });

  const items = [
    { key: 'genderRules', label: 'Gender Rules', desc: 'Set entry rules based on gender and ratio' },
    { key: 'bagPolicy', label: 'Bag Policy', desc: 'Configure bag restrictions and locker options' },
    { key: 'tableSeating', label: 'Table Seating', desc: 'Designate table sections with pricing' },
    { key: 'calendarSync', label: 'Calendar Sync', desc: 'Let attendees add to Google/Apple/Outlook' },
    { key: 'waitlistAutomation', label: 'Waitlist Automation', desc: 'Auto-invite when spots open up' },
    { key: 'fraudDetection', label: 'Fraud Detection', desc: 'Flag suspicious tickets and accounts' },
    { key: 'platformFee', label: `Platform Fee: ${settings.platformFee}`, desc: 'Per-transaction fee for every ticket sold', always: true },
  ] as const;

  return (
    <div style={{ paddingTop: '40px' }}>
      <BackButton onClick={onBack} />
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 4px' }}>Event Settings</h2>
      <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px' }}>
        Configure these features for your event. You can change them later.
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {items.map(item => {
          const val = settings[item.key as keyof typeof settings];
          const isOn = typeof val === 'boolean' ? val : true;
          return (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 16,
              background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{item.desc}</div>
              </div>
              {'always' in item ? (
                <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(56,189,248,0.1)', color: C.accent, fontSize: 12, fontWeight: 600 }}>
                  {settings.platformFee}
                </span>
              ) : (
                <button
                  onClick={() => setSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                  style={{
                    width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: isOn ? C.accent : 'rgba(148,163,184,0.2)',
                    position: 'relative', transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: isOn ? 24 : 3,
                    transition: 'left 0.15s',
                  }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={onContinue}
        style={{
          ...btnBase, width: '100%', padding: '16px',
          background: C.accent, color: '#082f49', fontSize: 15,
        }}
      >
        Continue to Event Details
      </button>
    </div>
  );
}

function ChoiceCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...card, ...btnBase,
        width: '100%', padding: '32px 24px',
        textAlign: 'center', background: C.surface,
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = '#38bdf8'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, marginTop: 4 }}>{title}</div>
      <div style={{ color: C.textMuted, fontSize: 14 }}>{desc}</div>
    </button>
  );
}

// ── Browse Flow ───────────────────────────────────────────

const REGISTRATION_PENDING_KEY = 'events_register_event_id';

function BrowseFlow({ onBack, onMyEvents }: { onBack: () => void; onMyEvents: () => void }) {
  const { account, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [upcoming, setUpcoming] = useState<EventRecord[]>([]);
  const [past, setPast] = useState<EventRecord[]>([]);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [applying, setApplying] = useState(false);
  const [appReason, setAppReason] = useState('');
  const [appSubmitted, setAppSubmitted] = useState(false);
  const [appNeedsReview, setAppNeedsReview] = useState(false);
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [appliedEventIds, setAppliedEventIds] = useState<Set<string>>(new Set());

  // Fetch the user's existing applications from the DB on mount
  useEffect(() => {
    if (authLoading || !account) return;
    (async () => {
      try {
        const res = await fetch('/api/events/applied', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>((data.applications || []).map((a: any) => a.eventId));
        setAppliedEventIds(ids);
      } catch {}
    })();
  }, [authLoading, account]);

  const loadEvents = useCallback(async () => {
    setStatus('loading');
    try {
      const qs = new URLSearchParams();
      if (filters.search) qs.set('search', filters.search);
      if (filters.category) qs.set('category', filters.category);
      if (filters.city) qs.set('city', filters.city);
      if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) qs.set('dateTo', filters.dateTo);
      if (filters.sort) qs.set('sort', filters.sort);
      const res = await fetch(`/api/events?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(data.events || []);
      setStatus('success');
    } catch {
      setEvents([]);
      setStatus('error');
    }
  }, [filters]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    let upcomingEvents: EventRecord[] = [];
    let pastEvents: EventRecord[] = [];
    const now = new Date();

    // Separate upcoming and past events
    events.forEach(e => {
      const dateStr = e.form.eventDate;
      if (!dateStr) {
        upcomingEvents.push(e);
        return;
      }
      const endStr = e.form.endTime || '23:59';
      const eventEnd = new Date(`${dateStr}T${endStr}`);
      if (isNaN(eventEnd.getTime())) {
        upcomingEvents.push(e);
        return;
      }

      if (eventEnd >= now || (account && e.hostUserId === account.id.toString())) {
        upcomingEvents.push(e);
      } else {
        pastEvents.push(e);
      }
    });

    // Apply filters to upcoming events
    let filteredUpcoming = [...upcomingEvents];
    const q = filters.search.toLowerCase();
    if (q) {
      filteredUpcoming = filteredUpcoming.filter(e =>
        e.form.eventName.toLowerCase().includes(q) ||
        e.form.oneLineSummary.toLowerCase().includes(q) ||
        e.form.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filters.category) {
      filteredUpcoming = filteredUpcoming.filter(e => e.form.eventCategory === filters.category);
    }
    if (filters.city) {
      filteredUpcoming = filteredUpcoming.filter(e =>
        e.form.fullAddress.toLowerCase().includes(filters.city.toLowerCase())
      );
    }
    if (filters.dateFrom) {
      filteredUpcoming = filteredUpcoming.filter(e => e.form.eventDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filteredUpcoming = filteredUpcoming.filter(e => e.form.eventDate <= filters.dateTo);
    }
    switch (filters.sort) {
      case 'date-desc': filteredUpcoming.sort((a, b) => b.form.eventDate.localeCompare(a.form.eventDate)); break;
      case 'name-asc': filteredUpcoming.sort((a, b) => a.form.eventName.localeCompare(b.form.eventName)); break;
      case 'name-desc': filteredUpcoming.sort((a, b) => b.form.eventName.localeCompare(a.form.eventName)); break;
      case 'capacity-asc': filteredUpcoming.sort((a, b) => a.form.maxAttendees - b.form.maxAttendees); break;
      case 'capacity-desc': filteredUpcoming.sort((a, b) => b.form.maxAttendees - a.form.maxAttendees); break;
      default: filteredUpcoming.sort((a, b) => a.form.eventDate.localeCompare(b.form.eventDate));
    }

    // Apply filters to past events
    let filteredPast = [...pastEvents];
    if (q) {
      filteredPast = filteredPast.filter(e =>
        e.form.eventName.toLowerCase().includes(q) ||
        e.form.oneLineSummary.toLowerCase().includes(q) ||
        e.form.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filters.category) {
      filteredPast = filteredPast.filter(e => e.form.eventCategory === filters.category);
    }
    if (filters.city) {
      filteredPast = filteredPast.filter(e =>
        e.form.fullAddress.toLowerCase().includes(filters.city.toLowerCase())
      );
    }
    filteredPast.sort((a, b) => b.form.eventDate.localeCompare(a.form.eventDate)); // Most recent first

    setUpcoming(filteredUpcoming);
    setPast(filteredPast);
  }, [events, filters, account]);

  const resetRegistrationState = useCallback(() => {
    setApplying(false);
    setAppSubmitted(false);
    setAppNeedsReview(false);
    setAppSubmitting(false);
    setAppError(null);
    setAppReason('');
    setSelected(null);
  }, []);

  const submitRegistration = useCallback(async (event: EventRecord, reason?: string) => {
    setAppSubmitting(true);
    setAppError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setAppNeedsReview(data.application?.status === 'pending');
      setAppSubmitted(true);
      setApplying(false);
      // Mark this event as applied so the UI updates immediately
      setAppliedEventIds(prev => new Set(prev).add(event.id));
    } catch (e: unknown) {
      setAppError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setAppSubmitting(false);
    }
  }, []);

  const beginRegister = useCallback((event: EventRecord) => {
    if (!account) {
      sessionStorage.setItem(REGISTRATION_PENDING_KEY, event.id);
      window.location.href = '/auth/login?redirect=/events';
      return;
    }
    setSelected(event);
    setAppError(null);
    if (event.form.entryApprovalRequired) {
      setApplying(true);
      setAppReason('');
      return;
    }
    void submitRegistration(event);
  }, [account, submitRegistration]);

  useEffect(() => {
    if (authLoading || !account || events.length === 0) return;
    const pendingId = sessionStorage.getItem(REGISTRATION_PENDING_KEY);
    if (!pendingId) return;
    sessionStorage.removeItem(REGISTRATION_PENDING_KEY);
    const event = events.find(e => e.id === pendingId);
    if (event) beginRegister(event);
  }, [authLoading, account, events, beginRegister]);

  if (appSubmitted) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center' }}>
        <BackButton onClick={resetRegistrationState} />
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>
          {appNeedsReview ? 'Application sent!' : 'Registered'}
        </h2>
        <p style={{ color: C.textMuted, fontSize: 14 }}>
          {appNeedsReview
            ? 'The host will review your request.'
            : "You're all set for this event."}
        </p>
      </div>
    );
  }

  if (applying && selected && account) {
    const f = selected.form;
    return (
      <div style={{ ...card, padding: 28, display: 'grid', gap: 16 }}>
        <BackButton onClick={() => { setApplying(false); setAppReason(''); setAppError(null); }} />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Apply to {f.eventName}</h2>

        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Registering as</div>
          <div style={{ fontWeight: 600 }}>{account.display_name}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{account.email || 'No email on file'}</div>
        </div>

        <Field label="Why do you want to attend? (optional)">
          <textarea value={appReason} onChange={e => setAppReason(e.target.value)} placeholder="Tell the host why you're interested..." style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} />
        </Field>

        {appError && <p style={{ color: C.error, fontSize: 13, margin: 0 }}>{appError}</p>}

        <button
          onClick={() => void submitRegistration(selected, appReason)}
          disabled={appSubmitting || !account.email}
          style={{
            ...btnBase, background: appSubmitting || !account.email ? C.border : C.accent,
            color: '#fff', fontSize: 15, padding: '16px',
            cursor: appSubmitting || !account.email ? 'not-allowed' : 'pointer',
          }}
        >
          {appSubmitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    );
  }

  if (selected) {
    return (
      <EventDetailTabs
        event={selected}
        onBack={() => setSelected(null)}
        onApply={() => beginRegister(selected)}
        registering={appSubmitting}
        appliedEventIds={appliedEventIds}
      />
    );
  }

  const displayedEvents = eventTab === 'upcoming' ? upcoming : past;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={onBack} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Browse events</h2>
        </div>
        <button onClick={onMyEvents} style={{ ...btnBase, background: 'rgba(148,163,184,0.1)', color: C.textMuted, fontSize: 12, padding: '8px 18px' }}>
          My Events
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
        <button
          onClick={() => setEventTab('upcoming')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
            fontSize: 14, fontWeight: 600, color: eventTab === 'upcoming' ? C.accent : C.textMuted,
            borderBottom: eventTab === 'upcoming' ? `2px solid ${C.accent}` : 'none',
            transition: 'all 0.2s',
          }}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setEventTab('past')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
            fontSize: 14, fontWeight: 600, color: eventTab === 'past' ? C.accent : C.textMuted,
            borderBottom: eventTab === 'past' ? `2px solid ${C.accent}` : 'none',
            transition: 'all 0.2s',
          }}
        >
          Past ({past.length})
        </button>
      </div>

      <BrowseFilters values={filters} onChange={setFilters} />

      {status === 'loading' && <LoadingSkeleton />}

      {status === 'success' && displayedEvents.length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
            {events.length === 0 ? 'No events yet. Host one!' : `No ${eventTab} events match your filters.`}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <p style={{ color: C.error, fontSize: 14, margin: '0 0 12px' }}>Could not load events.</p>
          <button onClick={loadEvents} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 13, padding: '10px 24px' }}>Retry</button>
        </div>
      )}

      {status === 'success' && displayedEvents.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {displayedEvents.map(event => <EventCard key={event.id} event={event} onClick={() => setSelected(event)} />)}
        </div>
      )}
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────

function EventCard({ event, onClick }: { event: EventRecord; onClick: () => void }) {
  const f = event.form;
  const priceLabel = f.ticketingModel === 'free'
    ? 'Free'
    : f.ticketTiers.length > 0
    ? `From $${(f.ticketTiers[0].priceCents / 100).toFixed(0)}`
    : 'Paid';

  return (
    <button
      onClick={onClick}
      style={{ ...card, padding: 18, textAlign: 'left', cursor: 'pointer', ...btnBase, borderRadius: 24, width: '100%' }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{f.eventName}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>By {event.hostName}</div>
        {f.oneLineSummary && (
          <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{f.oneLineSummary}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(56,189,248,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Date & Time</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#bae6fd' }}>
            {new Date(f.eventDate + 'T' + (f.startTime || '00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div style={{ fontSize: 11, color: '#7dd3fc', marginTop: 2 }}>{f.startTime}</div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(56,189,248,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Price</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#bae6fd' }}>
            {priceLabel}
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(56,189,248,0.1)', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Venue</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#bae6fd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.venueName}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag>{f.eventCategory}</Tag>
        <Tag>{f.eventType.replace('-', ' ')}</Tag>
        {f.eventVisibility !== 'public' && <Tag>{f.eventVisibility}</Tag>}
      </div>
    </button>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

// ── Shared Components ─────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left', width: 'fit-content' }}>
      Back
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

function MiniBadge({ children }: { children: ReactNode }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.1)', color: C.textMuted, fontSize: 12 }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{children}</div>;
}

function DetailRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted }}>
      <span style={{ fontWeight: 600, color: '#cbd5e1', minWidth: 80 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ ...card, padding: 20, display: 'grid', gap: 8 }}>
          <div style={{ height: 20, width: '60%', borderRadius: 6, background: 'rgba(148,163,184,0.1)' }} />
          <div style={{ height: 14, width: '40%', borderRadius: 6, background: 'rgba(148,163,184,0.08)' }} />
        </div>
      ))}
    </div>
  );
}

// ── Event Detail Tabs (Event OS) ──────────────────────────

function getReferralLink(event: EventRecord) {
  const slug = (event.form.eventSlug || event.form.eventName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://valueskins.app/e/${slug || event.id}?ref=host-${event.hostUserId}`;
}

type DetailTab = 'about' | 'ticket' | 'checkin' | 'announcements' | 'chat' | 'faq' | 'safety' | 'groups' | 'arrival' | 'postevent' | 'commandcenter' | 'automation' | 'calendar' | 'fraud' | 'waitlist' | 'support' | 'matching' | 'memory' | 'connections' | 'tribe' | 'loyalty' | 'reputation' | 'audience' | 'crm' | 'network' | 'venue-intel';

function EventDetailTabs({ event, onBack, onApply, registering, appliedEventIds }: { event: EventRecord; onBack: () => void; onApply: () => void; registering?: boolean; appliedEventIds?: Set<string> }) {
  const { account } = useAuth();
  const isHost = account && event.hostUserId === account.id.toString();
  const hasApplied = appliedEventIds ? appliedEventIds.has(event.id) : false;

  const [tab, setTab] = useState<DetailTab>('about');
  const isPaidEvent = event.form.ticketingModel === 'paid';

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'ticket', label: 'Ticket' },
    { key: 'checkin', label: 'Check-In' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'chat', label: 'Chat' },
    { key: 'faq', label: 'FAQ' },
    { key: 'safety', label: 'Safety' },
    { key: 'groups', label: 'Groups' },
    { key: 'arrival', label: 'Arrival' },
    { key: 'postevent', label: 'Post-Event' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'fraud', label: 'Fraud' },
    { key: 'waitlist', label: 'Waitlist' },
    { key: 'support', label: 'Support' },
    { key: 'commandcenter', label: 'Command Center' },
    { key: 'automation', label: 'Automation' },
    { key: 'matching', label: 'Matching' },
    { key: 'memory', label: 'Recap' },
    { key: 'connections', label: 'Connections' },
    { key: 'tribe', label: 'Tribe' },
    { key: 'loyalty', label: 'Loyalty' },
    { key: 'reputation', label: 'Reputation' },
    { key: 'audience', label: 'Audience' },
    { key: 'crm', label: 'CRM' },
    { key: 'network', label: 'Network' },
    { key: 'venue-intel', label: 'Venue Intel' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...card, padding: 28, display: 'grid', gap: 20 }}>
        <BackButton onClick={onBack} />

        <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4, overflow: 'auto' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
              padding: '8px 14px', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
              background: tab === t.key ? C.accent : 'transparent',
              color: tab === t.key ? '#082f49' : C.textMuted,
              transition: 'all 0.1s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'about' && (
        <EventDetailView
          event={event}
          onBack={() => {}}
          onApply={onApply}
          onGetTickets={isPaidEvent ? () => setTab('ticket') : undefined}
          registering={registering}
          isHost={!!isHost}
          hasApplied={!!hasApplied}
          compact
        />
      )}
      {tab === 'ticket' && <EventTicketPanel event={event} onRegister={onApply} />}
      {tab === 'checkin' && <CheckInPage eventId={event.id} />}
      {tab === 'announcements' && <AnnouncementsBar eventId={event.id} isHost />}
      {tab === 'chat' && <EventChatView eventId={event.id} isHost />}
      {tab === 'faq' && <AIFAQSection eventId={event.id} isHost />}
      {tab === 'safety' && <SafetyHub eventId={event.id} isHost />}
      {tab === 'groups' && <GroupView eventId={event.id} isHost />}
      {tab === 'arrival' && <ArrivalInfoView eventId={event.id} isHost />}
      {tab === 'postevent' && <PostEventPanel eventId={event.id} />}
      {tab === 'calendar' && <CalendarIntegration
        eventId={event.id} eventName={event.form.eventName}
        eventDate={event.form.eventDate} startTime={event.form.startTime}
        endTime={event.form.endTime} venueName={event.form.venueName}
        fullAddress={event.form.fullAddress} />}
      {tab === 'fraud' && <FraudRiskDashboard />}
      {tab === 'waitlist' && <WaitlistAutomationPanel eventId={event.id} />}
      {tab === 'support' && <SupportCenter eventId={event.id} />}
      {tab === 'commandcenter' && <CommandCenterView eventId={event.id} />}
      {tab === 'automation' && <AutomationPanel eventId={event.id} />}
      {tab === 'matching' && <MatchingEngine eventId={event.id} />}
      {tab === 'memory' && <EventMemory eventId={event.id} />}
      {tab === 'connections' && <PostEventConnections eventId={event.id} />}
      {tab === 'tribe' && <TribePanel eventId={event.id} isHost />}
      {tab === 'loyalty' && <LoyaltyPanel accountId={1} />}
      {tab === 'reputation' && <ReputationPanel accountId={1} />}
      {tab === 'audience' && <AudienceIntel eventId={event.id} />}
      {tab === 'crm' && <HostCRM hostId={1} />}
      {tab === 'network' && <NetworkGraph accountId={1} />}
      {tab === 'venue-intel' && <VenueIntel venueId={event.form.venueName || 'demo'} />}

      {tab !== 'ticket' && tab !== 'about' && (
        <button
          onClick={isPaidEvent ? () => setTab('ticket') : onApply}
          disabled={registering || isHost || hasApplied}
          style={{
            ...btnBase, background: (registering || isHost || hasApplied) ? 'rgba(148,163,184,0.2)' : C.accent, color: (registering || isHost || hasApplied) ? C.textMuted : '#082f49',
            fontSize: 15, padding: '16px', width: '100%',
            cursor: (registering || isHost || hasApplied) ? 'not-allowed' : 'pointer',
          }}
        >
          {isHost ? 'You are the host' : hasApplied ? 'Already done' : registering ? 'Registering…' : isPaidEvent ? 'Get tickets' : 'Register to attend'}
        </button>
      )}
    </div>
  );
}

function EventDetailView({
  event,
  onBack,
  onApply,
  onGetTickets,
  registering,
  compact,
  isHost,
  hasApplied,
}: {
  event: EventRecord;
  onBack: () => void;
  onApply: () => void;
  onGetTickets?: () => void;
  registering?: boolean;
  compact?: boolean;
  isHost?: boolean;
  hasApplied?: boolean;
}) {
  const f = event.form;

  const [galleryIdx, setGalleryIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const referralLink = getReferralLink(event);
  const trustScore = Math.min(99, 72 + Math.min(event.attendees.length, 20) + (event.thirdPartyTags.length * 2) + (f.faqEntries.length > 0 ? 4 : 0));

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  }

  const content = (
    <>
      {/* Hero */}
      {f.coverImage && (
        <div style={{ width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', background: `url(${f.coverImage}) center/cover` }} />
      )}

      {/* Gallery */}
      {f.galleryImages.length > 0 && (
        <div>
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', height: 160, background: 'rgba(15,23,42,0.6)' }}>
            <img
              src={f.galleryImages[galleryIdx]}
              alt="Gallery"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {f.galleryImages.length > 1 && (
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#fff' }}>
                {galleryIdx + 1} / {f.galleryImages.length}
              </div>
            )}
          </div>
          {f.galleryImages.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {f.galleryImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setGalleryIdx(i)}
                  style={{
                    width: 48, height: 48, borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    border: i === galleryIdx ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                    padding: 0, background: 'none',
                    opacity: i === galleryIdx ? 1 : 0.5,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{f.eventName}</h2>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 14 }}>
            Hosted by {event.hostName}
          </p>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 14px', borderRadius: 18, background: C.accentBg, color: '#bae6fd', minWidth: 80 }}>
          <div style={{ fontWeight: 800 }}>
            {new Date(f.eventDate + 'T' + (f.startTime || '00:00')).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ fontSize: 12 }}>{f.startTime} - {f.endTime}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge>{f.eventCategory}</Badge>
        <Badge>{f.eventType.replace('-', ' ')}</Badge>
        <Badge>{f.eventVisibility}</Badge>
        <Badge>{f.indoorOutdoor}</Badge>
        {f.ticketingModel === 'free' ? <Badge>Free</Badge> : <Badge>Paid</Badge>}
        {f.ageRestriction > 0 && <Badge>{f.ageRestriction.toString()}+</Badge>}
        <GenderEntryBadge genderRule={f.genderRule} entryApprovalRequired={f.entryApprovalRequired} />
        <BagSecurityBadge bagPolicy={f.bagPolicy} />
        <TableSeatingBadge sections={f.tableSections} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{trustScore}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' }}>Trust Score</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{event.attendees.length}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' }}>Interested</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{f.waitlistEnabled ? 'On' : 'Off'}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' }}>Waitlist</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{f.calendarAdminCount || 5}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' }}>Calendar Admins</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setSaved((prev) => !prev)} style={{ ...btnBase, background: 'rgba(148,163,184,0.12)', color: C.text, padding: '10px 18px', fontSize: 13 }}>
          {saved ? 'Saved' : 'Save event'}
        </button>
        <button onClick={handleShare} style={{ ...btnBase, background: C.accentBg, color: C.accent, padding: '10px 18px', fontSize: 13 }}>
          {shareCopied ? 'Link copied' : 'Copy share link'}
        </button>
      </div>

      {f.oneLineSummary && (
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>{f.oneLineSummary}</p>
      )}
      {f.fullDescription && (
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-wrap' }}>{f.fullDescription}</p>
      )}

      {f.tags.length > 0 && (
        <div>
          <SectionLabel>Tags</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {f.tags.map(t => <span key={t} style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(148,163,184,0.1)', color: C.textMuted, fontSize: 12 }}>{t}</span>)}
          </div>
        </div>
      )}

      <DetailRow icon="When" label={
        f.doorsOpenTime
          ? `${f.eventDate} | Doors ${f.doorsOpenTime} | ${f.startTime}-${f.endTime}`
          : `${f.eventDate} | ${f.startTime}-${f.endTime}`
      } />

      <div>
        <SectionLabel>Location</SectionLabel>
        <p style={{ margin: '4px 0 2px', color: '#cbd5e1', fontSize: 14 }}>{f.venueName}</p>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{f.fullAddress}</p>
        {f.landmark && <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: 13 }}>Near {f.landmark}</p>}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.parkingAvailable && <MiniBadge>Parking</MiniBadge>}
          {f.valetAvailable && <MiniBadge>Valet</MiniBadge>}
          {f.publicTransportNearby && <MiniBadge>Public transit</MiniBadge>}
        </div>
      </div>

      <DetailRow icon="Capacity" label={`${f.maxAttendees} max` + (f.waitlistEnabled ? ' | Waitlist enabled' : '')} />

      <div>
        <SectionLabel>Booking confidence</SectionLabel>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
            Refund policy: {f.refundAllowed ? f.refundPolicy : 'No refunds'}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
            Cancellation policy: {f.cancellationPolicy || 'Standard host cancellation terms'}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
            Referral link: <span style={{ color: C.accent }}>{referralLink}</span>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
            Guest capture: {f.collectGuestNamesSeparately ? 'Separate first and last names' : 'Single full-name field'}
          </div>
        </div>
      </div>

      {f.ticketingModel === 'paid' && f.ticketTiers.length > 0 && (
        <div>
          <SectionLabel>Ticket tiers</SectionLabel>
          <div style={{ display: 'grid', gap: 8 }}>
            {f.ticketTiers.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name || t.type}</div>
                  {t.description && <div style={{ fontSize: 12, color: C.textMuted }}>{t.description}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.accent }}>{(t.priceCents / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Vibe</SectionLabel>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: C.textMuted }}>
          {f.dressCode && <span>Dress code: {f.dressCode}</span>}
          {f.eventVibe && <span>Vibe: {f.eventVibe}</span>}
          {f.musicGenre && <span>Music: {f.musicGenre}</span>}
          <span>Energy: {f.energyLevel}</span>
          <span>Networking: {f.networkingLevel}</span>
        </div>
      </div>

      {event.thirdPartyTags.length > 0 && (
        <div>
          <SectionLabel>Featured people</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {event.thirdPartyTags.map(t => (
              <span key={t.id} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(249, 115, 22, 0.15)', color: '#fdba74', fontSize: 12, fontWeight: 600 }}>
                {t.name}
                {t.role && <> ({t.role})</>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Host trust</SectionLabel>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)', display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{event.hostName}</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            Verified organizer profile, event operations enabled, and attendee support channel configured.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MiniBadge>Verified host</MiniBadge>
            <MiniBadge>Support ready</MiniBadge>
            <MiniBadge>Audience-owned CRM</MiniBadge>
          </div>
        </div>
      </div>

      {(f.idRequired || !f.reentryAllowed || f.alcoholRules || f.guestRules || f.photographyRules || f.prohibitedItems.length > 0 || f.securityRules) && (
        <div>
          <SectionLabel>Rules</SectionLabel>
          <div style={{ display: 'grid', gap: 4, fontSize: 13, color: C.textMuted }}>
            {f.idRequired && <span>ID required for entry</span>}
            {!f.reentryAllowed && <span>No re-entry</span>}
            {f.alcoholRules && <span>{f.alcoholRules}</span>}
            {f.guestRules && <span>{f.guestRules}</span>}
            {f.photographyRules && <span>{f.photographyRules}</span>}
            {f.prohibitedItems.length > 0 && <span>Prohibited: {f.prohibitedItems.join(', ')}</span>}
            {f.securityRules && <span>{f.securityRules}</span>}
          </div>
        </div>
      )}

      {f.faqEntries.length > 0 && (
        <div>
          <SectionLabel>FAQ</SectionLabel>
          <div style={{ display: 'grid', gap: 10 }}>
            {f.faqEntries.map(e => (
              <div key={e.id}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>{e.question}</p>
                <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{e.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(f.hostContact || f.supportContact || f.emergencyContact) && (
        <div>
          <SectionLabel>Contact</SectionLabel>
          <div style={{ display: 'grid', gap: 4, fontSize: 13, color: C.textMuted }}>
            {f.hostContact && <span>Host: {f.hostContact}</span>}
            {f.supportContact && <span>Support: {f.supportContact}</span>}
            {f.emergencyContact && <span>Emergency: {f.emergencyContact}</span>}
            {f.checkInManagers?.length > 0 && <span>Check-in managers: {f.checkInManagers.join(', ')}</span>}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Automation</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MiniBadge>Shortened URL ready to share</MiniBadge>
        </div>
      </div>

      {(f.eventChatEnabled || f.attendeeVisibilityEnabled || f.photoSharingEnabled || f.networkingEnabled || f.followUpsEnabled) && (
        <div>
          <SectionLabel>After the event</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {f.eventChatEnabled && <MiniBadge>Event chat</MiniBadge>}
            {f.attendeeVisibilityEnabled && <MiniBadge>Attendee list</MiniBadge>}
            {f.photoSharingEnabled && <MiniBadge>Photo sharing</MiniBadge>}
            {f.networkingEnabled && <MiniBadge>Networking</MiniBadge>}
            {f.followUpsEnabled && <MiniBadge>Follow-ups</MiniBadge>}
          </div>
        </div>
      )}

      {f.schedule.length > 0 && (
        <div>
          <SectionLabel>Schedule</SectionLabel>
          <div style={{ display: 'grid', gap: 8 }}>
            {f.schedule.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 14, padding: '10px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
                <div style={{ minWidth: 64, fontWeight: 700, fontSize: 14, color: C.accent }}>{item.time}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                  {item.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(f.whatToBring.length > 0 || f.foodAndDrink || f.accessibility || f.weatherContingency || f.socialLinks.length > 0 || f.eventWebsite || f.language) && (
        <div>
          <SectionLabel>Logistics</SectionLabel>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: C.textMuted }}>
            {f.whatToBring.length > 0 && <div><strong style={{ color: '#cbd5e1' }}>Bring:</strong> {f.whatToBring.join(', ')}</div>}
            {f.foodAndDrink && <div><strong style={{ color: '#cbd5e1' }}>Food & drink:</strong> {f.foodAndDrink}</div>}
            {f.accessibility && <div><strong style={{ color: '#cbd5e1' }}>Accessibility:</strong> {f.accessibility}</div>}
            {f.weatherContingency && <div><strong style={{ color: '#cbd5e1' }}>Weather:</strong> {f.weatherContingency}</div>}
            {f.socialLinks.length > 0 && <div><strong style={{ color: '#cbd5e1' }}>Social:</strong> {f.socialLinks.join(' | ')}</div>}
            {f.eventWebsite && <div><strong style={{ color: '#cbd5e1' }}>Website:</strong> {f.eventWebsite}</div>}
            {f.language && <div><strong style={{ color: '#cbd5e1' }}>Language:</strong> {f.language}</div>}
          </div>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={card}>{content}</div>
        <button
          onClick={f.ticketingModel === 'paid' ? (onGetTickets || onApply) : onApply}
          disabled={registering || isHost || hasApplied}
          style={{
            ...btnBase, background: (registering || isHost || hasApplied) ? 'rgba(148,163,184,0.2)' : C.accent, color: (registering || isHost || hasApplied) ? C.textMuted : '#082f49',
            fontSize: 15, padding: '16px', width: '100%',
            cursor: (registering || isHost || hasApplied) ? 'not-allowed' : 'pointer',
          }}
        >
          {isHost ? 'You are the host' : hasApplied ? 'Already done' : registering ? 'Registering…' : f.ticketingModel === 'paid' ? 'Get tickets' : 'Register to attend'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: 28, display: 'grid', gap: 20 }}>
      <BackButton onClick={onBack} />
      {content}
      <button
        onClick={f.ticketingModel === 'paid' ? (onGetTickets || onApply) : onApply}
        disabled={registering}
        style={{
          ...btnBase, background: registering ? 'rgba(148,163,184,0.2)' : C.accent, color: '#082f49',
          fontSize: 15, padding: '16px', marginTop: 8,
          cursor: registering ? 'not-allowed' : 'pointer',
        }}
      >
        {registering ? 'Registering…' : f.ticketingModel === 'paid' ? 'Get tickets' : 'Apply to attend'}
      </button>
    </div>
  );
}
