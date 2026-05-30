'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
  BusinessProfile, HostDashboardData, Promoter, EventTemplate,
  PromoterCommission, ReferralLink, PromoterPerformance,
} from '../data/types';

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
  orange: '#fb923c',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  padding: 20,
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

const inp: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)',
  color: C.text,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: C.accentBg,
  color: C.accent,
  fontSize: 11,
  fontWeight: 600,
};

type Tab = 'overview' | 'promoters' | 'templates' | 'payouts';

export default function HostDashboard({ profile, onBack, onEditProfile }: {
  profile: BusinessProfile;
  onBack: () => void;
  onEditProfile: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left' }}>
              Back
            </button>
            <h2 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 800 }}>{profile.businessName}</h2>
            <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{profile.address}, {profile.city}</p>
          </div>
          <button onClick={onEditProfile} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>Edit profile</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4 }}>
        {(['overview', 'promoters', 'templates', 'payouts'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...btnBase, flex: 1, padding: '10px',
            background: tab === t ? C.accent : 'transparent',
            color: tab === t ? '#082f49' : C.textMuted,
            fontSize: 12,
            textTransform: 'capitalize', fontWeight: tab === t ? 800 : 600,
          }}>
            {t === 'overview' ? 'Overview' : t === 'promoters' ? 'Promoters' : t === 'templates' ? 'Templates' : 'Payouts'}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab profile={profile} />}
      {tab === 'promoters' && <PromotersTab profileId={profile.id} />}
      {tab === 'templates' && <TemplatesTab profileId={profile.id} />}
      {tab === 'payouts' && <PayoutsTab profileId={profile.id} />}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────

function OverviewTab({ profile }: { profile: BusinessProfile }) {
  const [data, setData] = useState<HostDashboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/business-profiles/host-dashboard');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setData({
        totalTicketSales: d.totalTicketSales || 0,
        totalRevenueCents: d.totalRevenueCents || 0,
        totalFees: d.totalFees || 0,
        totalCommissions: d.totalCommissions || 0,
        netRevenueCents: d.netRevenueCents || 0,
        uniqueAttendees: d.uniqueAttendees || 0,
        repeatAttendees: d.repeatAttendees || 0,
        activePromoters: d.activePromoters || 0,
        upcomingEvents: d.upcomingEvents || 0,
        topPromoters: d.topPromoters || [],
        recentPayouts: d.recentPayouts || [],
      });
      setStatus('success');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (status === 'loading') return <div style={{ color: C.textMuted, padding: 20 }}>Loading...</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="Revenue" value={`$${(data?.totalRevenueCents ?? 0) / 100}`} color={C.accent} />
        <StatCard label="Tickets Sold" value={`${data?.totalTicketSales ?? 0}`} color={C.success} />
        <StatCard label="Active Promoters" value={`${data?.activePromoters ?? 0}`} color={C.orange} />
        <StatCard label="Net Revenue" value={`$${(data?.netRevenueCents ?? 0) / 100}`} color={C.success} />
      </div>

      {/* Top promoters */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Top Promoters</div>
        {data?.topPromoters && data.topPromoters.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.topPromoters.map(p => (
              <div key={p.promoterId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{p.promoterType.replace('_', ' ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.accent }}>${(p.revenueCents / 100).toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{p.ticketSales} tickets | {p.clicks} clicks</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No promoters yet. Add some to track performance.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...card, padding: 16, display: 'grid', gap: 2 }}>
      <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── Promoters Tab ─────────────────────────────────────────

function PromotersTab({ profileId }: { profileId: string }) {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [selectedPromoter, setSelectedPromoter] = useState<string | null>(null);
  const [commission, setCommission] = useState<PromoterCommission | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/business-profiles/promoters');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setPromoters(d.promoters || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function searchUsers() {
    if (!searchTerm.trim()) return;
    const res = await fetch('/api/business-profiles/promoters/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchTerm }),
    });
    const d = await res.json();
    setSearchResults(d.results || []);
  }

  async function addPromoter(user: any) {
    const res = await fetch('/api/business-profiles/promoters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        accountId: user.id,
        promoterType: user.type,
      }),
    });
    if (res.ok) {
      const p = await res.json();
      setPromoters(prev => [...prev, p]);
      setSearchResults([]);
      setSearchTerm('');
      setShowInvite(false);
    }
  }

  async function suspendPromoter(id: string) {
    await fetch(`/api/business-profiles/promoters/${id}/suspend`, { method: 'POST' });
    setPromoters(prev => prev.map(p => p.id === id ? { ...p, status: 'suspended' as const } : p));
  }

  async function removePromoter(id: string) {
    await fetch(`/api/business-profiles/promoters/${id}`, { method: 'DELETE' });
    setPromoters(prev => prev.filter(p => p.id !== id));
  }

  async function loadCommission(promoterId: string) {
    setSelectedPromoter(promoterId);
    const res = await fetch(`/api/business-profiles/commissions/promoter/${promoterId}`);
    const d = await res.json();
    const comms = d.commissions || [];
    setCommission(comms[0] || null);
  }

  if (selectedPromoter) {
    return (
      <CommissionEditor
        promoterId={selectedPromoter}
        initial={commission}
        onBack={() => setSelectedPromoter(null)}
        onSaved={c => setCommission(c)}
      />
    );
  }

  function statusBadge(s: string) {
    const colors: Record<string, string> = { active: C.success, suspended: C.warning, banned: C.error, deleted: C.textMuted };
    return <span style={{ padding: '2px 8px', borderRadius: 999, background: `${colors[s] || C.textMuted}22`, color: colors[s] || C.textMuted, fontSize: 11, fontWeight: 700 }}>{s}</span>;
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Promoters ({promoters.length})</div>
        <button onClick={() => setShowInvite(!showInvite)} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 12 }}>
          {showInvite ? 'Cancel' : '+ Add promoter'}
        </button>
      </div>

      {showInvite && (
        <div style={{ display: 'grid', gap: 12, padding: 16, marginBottom: 16, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} placeholder="Search by name..." style={{ ...inp, flex: 1 }} />
            <button onClick={searchUsers} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>Search</button>
          </div>
          {searchResults.map((u: any) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{u.handle} — {u.followers.toLocaleString()} followers</div>
              </div>
              <button onClick={() => addPromoter(u)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12 }}>Invite</button>
            </div>
          ))}
        </div>
      )}

      {status === 'loading' && <p style={{ color: C.textMuted, fontSize: 13 }}>Loading...</p>}

      {promoters.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No promoters yet. Invite your first one.</p>
      ) : (
        promoters.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                {statusBadge(p.status)}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{p.promoterType.replace(/_/g, ' ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => loadCommission(p.id)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 11 }}>Commission</button>
              {p.status === 'active' && <button onClick={() => suspendPromoter(p.id)} style={{ ...btnBase, background: 'rgba(251,191,36,0.12)', color: C.warning, fontSize: 11 }}>Suspend</button>}
              <button onClick={() => removePromoter(p.id)} style={{ ...btnBase, background: 'rgba(252,165,165,0.12)', color: C.error, fontSize: 11 }}>Remove</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Commission Editor ─────────────────────────────────────

function CommissionEditor({ promoterId, initial, onBack, onSaved }: {
  promoterId: string;
  initial: PromoterCommission | null;
  onBack: () => void;
  onSaved: (c: PromoterCommission) => void;
}) {
  const [type, setType] = useState(initial?.commissionType || 'percentage');
  const [fixed, setFixed] = useState(initial?.fixedAmountCents || 0);
  const [pct, setPct] = useState(initial?.percentageRate || 10);
  const [maxPayout, setMaxPayout] = useState(initial?.maxPayoutCents || 0);
  const [tiers, setTiers] = useState<{ min: number; rate: number }[]>(initial?.tierConfig.map((t: any) => ({ min: t.minTickets, rate: t.rate })) || [{ min: 0, rate: 5 }, { min: 50, rate: 10 }]);

  async function save() {
    const payload: any = { commissionType: type };
    if (type === 'fixed') payload.fixedAmountCents = fixed;
    else if (type === 'percentage') payload.percentageRate = pct;
    else if (type === 'tiered') payload.tierConfig = tiers.map(t => ({ minTickets: t.min, rate: t.rate }));
    payload.maxPayoutCents = maxPayout;
    const res = await fetch(`/api/business-profiles/promoters/${promoterId}/commission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const c = await res.json();
      onSaved(c);
      onBack();
    }
  }

  return (
    <div style={card}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left', marginBottom: 16 }}>Back to promoters</button>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Commission Settings</div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Type</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['percentage', 'fixed', 'tiered'] as const).map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                ...btnBase, padding: '8px 16px',
                background: type === t ? C.accent : 'rgba(148,163,184,0.1)',
                color: type === t ? '#082f49' : C.textMuted,
                fontSize: 12, textTransform: 'capitalize',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {type === 'fixed' && (
          <div>
            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Fixed amount per ticket ($)</div>
            <input type="number" step="0.01" value={fixed / 100} onChange={e => setFixed(Math.round(parseFloat(e.target.value || '0') * 100))} style={inp} />
          </div>
        )}

        {type === 'percentage' && (
          <div>
            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Percentage per ticket</div>
            <input type="number" min="0" max="100" step="0.5" value={pct} onChange={e => setPct(parseFloat(e.target.value || '0'))} style={inp} />
          </div>
        )}

        {type === 'tiered' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Tiers (min tickets → rate %)</div>
            {tiers.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: C.textMuted, fontSize: 12, minWidth: 20 }}>{i + 1}.</span>
                <input type="number" value={t.min} onChange={e => { const n = [...tiers]; n[i] = { ...n[i], min: parseInt(e.target.value) || 0 }; setTiers(n); }} placeholder="Min tickets" style={{ ...inp, flex: 1 }} />
                <input type="number" value={t.rate} onChange={e => { const n = [...tiers]; n[i] = { ...n[i], rate: parseFloat(e.target.value) || 0 }; setTiers(n); }} placeholder="Rate %" style={{ ...inp, flex: 1 }} />
                <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 16 }}>x</button>
              </div>
            ))}
            <button onClick={() => setTiers([...tiers, { min: 0, rate: 0 }])} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12, padding: '8px', width: '100%' }}>+ Add tier</button>
          </div>
        )}

        <div>
          <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Max payout ($) — 0 = unlimited</div>
          <input type="number" value={maxPayout / 100} onChange={e => setMaxPayout(Math.round(parseFloat(e.target.value || '0') * 100))} style={inp} />
        </div>

        <button onClick={save} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 14, padding: '14px', width: '100%', marginTop: 8 }}>Save commission</button>
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────

function TemplatesTab({ profileId }: { profileId: string }) {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurrenceType, setNewRecurrenceType] = useState('');
  const [newRecurrenceDay, setNewRecurrenceDay] = useState(5);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/business-profiles/${profileId}/templates`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setTemplates(d.templates || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  async function createTemplate() {
    if (!newName.trim()) return;
    const res = await fetch(`/api/business-profiles/${profileId}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        description: newDesc,
        category: newCategory,
        isRecurring: newRecurring,
        recurrenceType: newRecurrenceType,
        recurrenceConfig: newRecurrenceType === 'weekly' ? { dayOfWeek: newRecurrenceDay } : {},
        templateData: { eventName: newName, eventCategory: newCategory },
      }),
    });
    if (res.ok) {
      const tmpl = await res.json();
      setTemplates(prev => [...prev, tmpl]);
      setShowNew(false);
      setNewName('');
      setNewDesc('');
      setNewCategory('');
      setNewRecurring(false);
    }
  }

  async function deleteTmpl(id: string) {
    await fetch(`/api/business-profiles/templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  function recurrenceLabel(t: EventTemplate): string {
    if (!t.isRecurring) return '';
    const cfg = t.recurrenceConfig as any;
    if (t.recurrenceType === 'weekly') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Every ${days[cfg?.dayOfWeek || 0]}`;
    }
    if (t.recurrenceType === 'daily') return 'Daily';
    if (t.recurrenceType === 'monthly') return `Every month (week ${cfg?.weekOfMonth || 1})`;
    return `Every ${cfg?.intervalDays || 7} days`;
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Templates ({templates.length})</div>
        <button onClick={() => setShowNew(!showNew)} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 12 }}>
          {showNew ? 'Cancel' : '+ New template'}
        </button>
      </div>

      {showNew && (
        <div style={{ display: 'grid', gap: 12, padding: 16, marginBottom: 16, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name (e.g. Friday Techno Night)" style={inp} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" style={inp} />
          <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category (e.g. party)" style={inp} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} />
            Recurring event
          </label>
          {newRecurring && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newRecurrenceType} onChange={e => setNewRecurrenceType(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Select recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {newRecurrenceType === 'weekly' && (
                <select value={newRecurrenceDay} onChange={e => setNewRecurrenceDay(parseInt(e.target.value))} style={{ ...inp, flex: 1 }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <button onClick={createTemplate} disabled={!newName.trim()} style={{ ...btnBase, background: newName.trim() ? C.accent : C.border, color: '#fff', fontSize: 13, padding: '12px' }}>Create template</button>
        </div>
      )}

      {status === 'loading' && <p style={{ color: C.textMuted }}>Loading...</p>}

      {templates.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No templates yet. Create one to speed up event setup.</p>
      ) : (
        templates.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {t.isRecurring && <span style={tagStyle}>{recurrenceLabel(t)}</span>}
                {' '}{t.useCount > 0 ? `Used ${t.useCount} times` : 'Never used'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => deleteTmpl(t.id)} style={{ ...btnBase, background: 'rgba(252,165,165,0.12)', color: C.error, fontSize: 11 }}>Delete</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Payouts Tab ───────────────────────────────────────────

function PayoutsTab({ profileId }: { profileId: string }) {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/business-profiles/payouts');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setPayouts(d.payouts || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Payouts</div>
      {payouts.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>No payouts yet.</p>
      ) : (
        payouts.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>${(p.netAmountCents / 100).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: p.status === 'completed' ? `${C.success}22` : `${C.warning}22`, color: p.status === 'completed' ? C.success : C.warning, fontSize: 11, fontWeight: 700 }}>{p.status}</span>
          </div>
        ))
      )}
    </div>
  );
}
