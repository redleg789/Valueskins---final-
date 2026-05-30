'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

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
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '10px 20px', fontSize: 13,
};

type AutomationConfig = {
  id: string; eventId: string; trigger: string; action: string; params: Record<string, string>;
  enabled: boolean; lastRun?: string; status?: string;
};

export default function AutomationPanel({ eventId }: { eventId: string }) {
  const [jobs, setJobs] = useState<AutomationConfig[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [trigger, setTrigger] = useState('checkin_threshold');
  const [action, setAction] = useState('send_announcement');
  const [params, setParams] = useState('{}');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/event-os/automation/${eventId}`);
      if (!res.ok) throw new Error('Failed');
      setJobs((await res.json()).jobs || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  async function createAuto() {
    try {
      const parsed = JSON.parse(params);
      const res = await fetch('/api/event-os/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, trigger, action, params: parsed }),
      });
      if (res.ok) { setShowNew(false); setParams('{}'); load(); }
    } catch { alert('Invalid JSON params'); }
  }

  async function toggleJob(id: string, enabled: boolean) {
    await fetch(`/api/event-os/automation/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  }

  async function runNow(id: string) {
    await fetch(`/api/event-os/automation/${id}/execute`, { method: 'POST' });
    load();
  }

  async function deleteJob(id: string) {
    await fetch(`/api/event-os/automation/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Automation</div>
        <button onClick={() => setShowNew(!showNew)} style={{ ...btnBase, background: C.accent, color: '#082f49', padding: '6px 14px', fontSize: 11 }}>+ New rule</button>
      </div>

      {showNew && (
        <div style={{ display: 'grid', gap: 8, padding: 12, marginBottom: 12, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <select value={trigger} onChange={e => setTrigger(e.target.value)} style={inp}>
            <option value="checkin_threshold">When check-in count reaches target</option>
            <option value="time_before">When event is X minutes away</option>
            <option value="capacity_reached">When capacity is reached</option>
            <option value="new_announcement">When announcement is created</option>
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} style={inp}>
            <option value="send_announcement">Send announcement</option>
            <option value="send_chat_message">Send chat message</option>
            <option value="reveal_arrival_info">Reveal arrival info</option>
            <option value="enable_chat">Enable event chat</option>
          </select>
          <textarea value={params} onChange={e => setParams(e.target.value)} placeholder='{"message": "Welcome!", "threshold": 50}' style={{ ...inp, minHeight: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={createAuto} style={{ ...btnBase, background: C.accent, color: '#082f49' }}>Create automation rule</button>
        </div>
      )}

      {status === 'loading' ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>Loading...</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>No automation rules.</p>
      ) : (
        jobs.map(j => (
          <div key={j.id} style={{
            padding: 12, borderRadius: 16, marginBottom: 8,
            background: j.enabled ? C.accentBg : 'rgba(148,163,184,0.06)',
            border: `1px solid ${j.enabled ? C.accent + '30' : C.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{j.trigger.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Action: {j.action.replace(/_/g, ' ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: j.enabled ? C.success : C.textMuted,
                  display: 'inline-block',
                }} />
                <button onClick={() => toggleJob(j.id, j.enabled)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11 }}>{j.enabled ? 'Disable' : 'Enable'}</button>
                <button onClick={() => runNow(j.id)} style={{ background: 'none', border: 'none', color: C.warning, cursor: 'pointer', fontSize: 11 }}>Run now</button>
                <button onClick={() => deleteJob(j.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 11 }}>Delete</button>
              </div>
            </div>
            {j.lastRun && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Last run: {new Date(j.lastRun).toLocaleString()}</div>}
            {j.status && <div style={{
              fontSize: 10, marginTop: 2,
              color: j.status === 'success' ? C.success : j.status === 'failed' ? C.error : C.warning,
            }}>Status: {j.status}</div>}
          </div>
        ))
      )}
    </div>
  );
}
