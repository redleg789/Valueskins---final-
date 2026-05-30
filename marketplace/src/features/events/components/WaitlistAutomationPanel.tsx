'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { WaitlistEntry, WaitlistConfig, WaitlistAnalytics } from '../data/types';
import { defaultWaitlistConfig } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 20, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inp: CSSProperties = {
  width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)', color: C.text, padding: '10px 14px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', fontSize: 12,
};

export default function WaitlistAutomationPanel({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [analytics, setAnalytics] = useState<WaitlistAnalytics | null>(null);
  const [config, setConfig] = useState<WaitlistConfig>(defaultWaitlistConfig());
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    const [wr, ar] = await Promise.all([
      fetch(`/api/efficiency/waitlist/${eventId}`),
      fetch('/api/efficiency/waitlist/config'),
    ]);
    if (wr.ok) { const d = await wr.json(); setEntries(d.entries || []); setAnalytics(d.analytics || null); }
    if (ar.ok) setConfig((await ar.json()).config || defaultWaitlistConfig());
  }, [eventId]);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  async function inviteUser(id: string) {
    await fetch(`/api/efficiency/waitlist/${eventId}/invite/${id}`, { method: 'POST' });
    load();
  }

  async function reassign(id: string) {
    await fetch(`/api/efficiency/waitlist/${eventId}/reassign/${id}`, { method: 'POST' });
    load();
  }

  async function saveConfig() {
    await fetch('/api/efficiency/waitlist/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setShowConfig(false);
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Waitlist Automation</div>
        <button onClick={() => setShowConfig(!showConfig)} style={{ ...btnBase, background: C.accentBg, color: C.accent, padding: '6px 14px', fontSize: 11 }}>Config</button>
      </div>

      {showConfig && (
        <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 16, background: 'rgba(15,23,42,0.6)', marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 13 }}>
            <input type="checkbox" checked={config.autoInviteEnabled} onChange={e => setConfig({ ...config, autoInviteEnabled: e.target.checked })} />
            Auto-invite on cancellation
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>Invite expiry (hours)</span>
            <select value={config.inviteExpiryHours} onChange={e => setConfig({ ...config, inviteExpiryHours: parseInt(e.target.value) })} style={inp}>
              <option value={2}>2 hours</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 13 }}>
            <input type="checkbox" checked={config.notifyOnSlotAvailable} onChange={e => setConfig({ ...config, notifyOnSlotAvailable: e.target.checked })} />
            Notify when slot available
          </label>
          <button onClick={saveConfig} style={{ ...btnBase, background: C.accent, color: '#082f49' }}>Save config</button>
        </div>
      )}

      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{analytics.totalWaiting}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Waiting</div>
          </div>
          <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.success }}>{analytics.totalConverted}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Converted</div>
          </div>
          <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.warning }}>{analytics.totalExpired}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Expired</div>
          </div>
          <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{analytics.conversionRate}%</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Rate</div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>No waitlist entries.</p>
      ) : (
        entries.map(e => (
          <div key={e.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 12, marginBottom: 6,
            background: e.status === 'invited' ? `${C.success}10` : e.status === 'expired' ? `${C.error}10` : 'rgba(15,23,42,0.5)',
            border: `1px solid ${e.status === 'invited' ? C.success + '30' : e.status === 'expired' ? C.error + '30' : C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: 999,
                background: C.accentBg, color: C.accent, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{e.position}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{e.userName || e.userId}</div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>
                  {e.status} | {Math.round(e.waitTimeSeconds / 3600)}h wait
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {e.status === 'waiting' && <button onClick={() => inviteUser(e.id)} style={{ ...btnBase, padding: '4px 10px', fontSize: 10, background: C.accent, color: '#082f49' }}>Invite</button>}
              {e.status === 'invited' && e.inviteExpiresAt && (
                <span style={{ fontSize: 10, color: C.warning }}>Expires {new Date(e.inviteExpiresAt).toLocaleTimeString()}</span>
              )}
              {e.status === 'waiting' && <button onClick={() => reassign(e.id)} style={{ ...btnBase, padding: '4px 10px', fontSize: 10, background: C.error, color: '#fff' }}>Skip</button>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
