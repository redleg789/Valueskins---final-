'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { EventAnnouncement } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', warning: '#fbbf24', orange: '#fb923c',
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

const typeColors: Record<string, string> = {
  info: C.accent, warning: C.warning, emergency: C.error, schedule_change: C.orange,
};

export default function AnnouncementsBar({ eventId, isHost }: { eventId: string; isHost?: boolean }) {
  const [anns, setAnns] = useState<EventAnnouncement[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState('info');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/event-os/announcements/event/${eventId}`);
      if (!res.ok) throw new Error('Failed');
      setAnns((await res.json()).announcements || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, [eventId]);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  async function createAnn() {
    if (!newTitle.trim() || !newBody.trim()) return;
    await fetch('/api/event-os/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, title: newTitle, body: newBody, type: newType }),
    });
    setNewTitle('');
    setNewBody('');
    setShowNew(false);
    load();
  }

  async function togglePin(id: string) {
    await fetch(`/api/event-os/announcements/${id}/pin`, { method: 'PUT' });
    load();
  }

  async function deleteAnn(id: string) {
    await fetch(`/api/event-os/announcements/${id}`, { method: 'DELETE' });
    load();
  }

  const pinned = anns.filter(a => a.isPinned);
  const rest = anns.filter(a => !a.isPinned);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Announcements</div>
        {isHost && <button onClick={() => setShowNew(!showNew)} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 11 }}>+ New</button>}
      </div>

      {showNew && (
        <div style={{ display: 'grid', gap: 8, padding: 12, marginBottom: 12, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" style={inp} />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Message" style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
          <select value={newType} onChange={e => setNewType(e.target.value)} style={inp}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="emergency">Emergency</option>
            <option value="schedule_change">Schedule change</option>
          </select>
          <button onClick={createAnn} disabled={!newTitle.trim() || !newBody.trim()} style={{ ...btnBase, background: newTitle.trim() && newBody.trim() ? C.accent : C.border, color: '#fff' }}>Send announcement</button>
        </div>
      )}

      {status === 'loading' ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>Loading...</p>
      ) : anns.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No announcements yet.</p>
      ) : (
        <>
          {pinned.map(a => <AnnouncementItem key={a.id} ann={a} isHost={isHost} onPin={togglePin} onDelete={deleteAnn} />)}
          {rest.map(a => <AnnouncementItem key={a.id} ann={a} isHost={isHost} onPin={togglePin} onDelete={deleteAnn} />)}
        </>
      )}
    </div>
  );
}

function AnnouncementItem({ ann, isHost, onPin, onDelete }: {
  ann: EventAnnouncement;
  isHost?: boolean;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const color = typeColors[ann.type] || C.accent;
  return (
    <div style={{
      padding: 14, borderRadius: 16, marginBottom: 8,
      background: `${color}10`, borderLeft: `3px solid ${color}`,
      display: 'grid', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color }}>{ann.title}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: `${color}22`, color, textTransform: 'capitalize' }}>{ann.type}</span>
          {ann.isPinned && <span style={{ fontSize: 10, color: C.warning }}>Pinned</span>}
        </div>
      </div>
      <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>{ann.body}</p>
      <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(ann.createdAt).toLocaleString()}</div>
      {isHost && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button onClick={() => onPin(ann.id)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11, padding: 0 }}>{ann.isPinned ? 'Unpin' : 'Pin'}</button>
          <button onClick={() => onDelete(ann.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 11, padding: 0 }}>Delete</button>
        </div>
      )}
    </div>
  );
}
