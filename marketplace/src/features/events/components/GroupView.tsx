// @ts-nocheck
'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { AttendeeGroup, GroupMember } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac',
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

export default function GroupView({ eventId, isHost }: { eventId: string; isHost?: boolean }) {
  const [groups, setGroups] = useState<AttendeeGroup[]>([]);
  const [myGroup, setMyGroup] = useState<AttendeeGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSize, setCreateSize] = useState(4);
  const [joinCode, setJoinCode] = useState('');

  const load = useCallback(async () => {
    const rg = await fetch(`/api/event-os/groups/event/${eventId}`);
    if (rg.ok) setGroups((await rg.json()).groups || []);
    const rm = await fetch(`/api/event-os/groups/event/${eventId}/my-group`);
    if (rm.ok) setMyGroup((await rm.json()).group || null);
  }, [eventId]);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  async function createGroup() {
    if (!createName.trim()) return;
    const res = await fetch(`/api/event-os/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, name: createName.trim(), maxSize: createSize }),
    });
    if (res.ok) { setShowCreate(false); setCreateName(''); load(); }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    const res = await fetch(`/api/event-os/groups/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, inviteCode: joinCode.trim() }),
    });
    if (res.ok) { setJoinCode(''); load(); }
  }

  async function leaveGroup(id: string) {
    await fetch(`/api/event-os/groups/${id}/leave`, { method: 'POST' });
    load();
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Groups & Plus-Ones</div>
        {!myGroup && <button onClick={() => setShowCreate(!showCreate)} style={{ ...btnBase, background: C.accent, color: '#082f49', padding: '6px 14px', fontSize: 11 }}>Create group</button>}
      </div>

      {!myGroup && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code" style={{ ...inp, flex: 1 }} />
          <button onClick={joinGroup} disabled={!joinCode.trim()} style={{
            ...btnBase, background: joinCode.trim() ? C.accent : C.border, color: '#fff',
            cursor: joinCode.trim() ? 'pointer' : 'not-allowed',
          }}>Join</button>
        </div>
      )}

      {showCreate && !myGroup && (
        <div style={{ display: 'grid', gap: 8, padding: 12, marginBottom: 12, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Group name" style={inp} />
          <input type="number" value={createSize} onChange={e => setCreateSize(Math.max(2, parseInt(e.target.value) || 4))} min={2} max={20} placeholder="Max size" style={inp} />
          <button onClick={createGroup} disabled={!createName.trim()} style={{ ...btnBase, background: createName.trim() ? C.accent : C.border, color: '#fff' }}>Create group</button>
        </div>
      )}

      {myGroup && (
        <div style={{ padding: 12, borderRadius: 16, background: C.accentBg, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.accent }}>{myGroup.name}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{myGroup.size}/{myGroup.maxSize} members | Code: <span style={{ color: C.accent, fontFamily: 'monospace', letterSpacing: '0.08em' }}>{myGroup.inviteCode}</span></div>
            </div>
            <button onClick={() => leaveGroup(myGroup.id)} style={{ ...btnBase, padding: '4px 12px', fontSize: 11, background: C.error, color: '#fff' }}>Leave</button>
          </div>
          {myGroup.members?.map((m: GroupMember) => (
            <div key={m.userId} style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
              {m.userId} {m.role === 'lead' ? '(Lead)' : ''}
            </div>
          ))}
        </div>
      )}

      {groups.filter(g => !myGroup || g.id !== myGroup.id).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>All groups ({groups.length})</div>
          {groups.filter(g => !myGroup || g.id !== myGroup.id).map(g => (
            <div key={g.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{g.size}/{g.maxSize}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
