'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { AttendeeCard } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24', gradient: 'linear-gradient(135deg, #f97316, #fb7185)',
};

const cardStyle: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 20, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', fontSize: 12,
};

export default function AttendeeCardView({ userId, isSelf, onBack }: {
  userId: string;
  isSelf?: boolean;
  onBack?: () => void;
}) {
  const [attendeeCard, setAttendeeCard] = useState<AttendeeCard | null>(null);
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [communities, setCommunities] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [showValueSkin, setShowValueSkin] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/event-os/cards/${userId}/card`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAttendeeCard(data);
      setBio(data.bio || '');
      setInterests((data.interests || []).join(', '));
      setCommunities((data.communities || []).join(', '));
      setPrivacy(data.privacyLevel || 'public');
      setShowValueSkin(data.showValueSkin || false);
      setStatus('success');
    } catch { setStatus('error'); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const res = await fetch(`/api/event-os/cards/${userId}/card`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio,
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        communities: communities.split(',').map(s => s.trim()).filter(Boolean),
        privacyLevel: privacy,
        showValueSkin,
      }),
    });
    if (res.ok) { setAttendeeCard(await res.json()); setEdit(false); }
  }

  if (status === 'loading') return <div style={{ color: C.textMuted, padding: 20, textAlign: 'center' }}>Loading...</div>;
  if (status === 'error' && !attendeeCard) return <div style={{ color: C.error, padding: 20 }}>Could not load profile.</div>;

  return (
    <div style={cardStyle}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12 }}>Back</button>}

      {!edit && attendeeCard && (
        <>
          {/* Photo */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999,
              background: attendeeCard.photoUrl ? `url(${attendeeCard.photoUrl}) center/cover` : C.gradient,
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{attendeeCard.userId}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {attendeeCard.privacyLevel === 'private' ? 'Private profile' : attendeeCard.privacyLevel === 'attendees_only' ? 'Visible to attendees' : 'Public profile'}
              </div>
            </div>
          </div>

          {attendeeCard.bio && <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: 13 }}>{attendeeCard.bio}</p>}

          {attendeeCard.interests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Interests</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {attendeeCard.interests.map(i => <span key={i} style={{ padding: '3px 8px', borderRadius: 999, background: C.accentBg, color: C.accent, fontSize: 11 }}>{i}</span>)}
              </div>
            </div>
          )}

          {attendeeCard.communities.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Communities</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {attendeeCard.communities.map(c => <span key={c} style={{ padding: '3px 8px', borderRadius: 999, background: `${C.success}22`, color: C.success, fontSize: 11 }}>{c}</span>)}
              </div>
            </div>
          )}

          {attendeeCard.badges.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Badges</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {attendeeCard.badges.map(b => <span key={b} style={{ padding: '3px 8px', borderRadius: 999, background: `${C.warning}22`, color: C.warning, fontSize: 11 }}>{b}</span>)}
              </div>
            </div>
          )}

          {isSelf && <button onClick={() => setEdit(true)} style={{ ...btnBase, background: C.accentBg, color: C.accent, marginTop: 12, width: '100%' }}>Edit profile</button>}
        </>
      )}

      {edit && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Edit your attendee card</div>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" style={{
            width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px',
            fontSize: 14, outline: 'none', minHeight: 60, resize: 'vertical', boxSizing: 'border-box',
          }} />
          <input value={interests} onChange={e => setInterests(e.target.value)} placeholder="Interests (comma separated)" style={{
            width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }} />
          <input value={communities} onChange={e => setCommunities(e.target.value)} placeholder="Communities (comma separated)" style={{
            width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }} />
          <select value={privacy} onChange={e => setPrivacy(e.target.value)} style={{
            width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}>
            <option value="public">Public</option>
            <option value="attendees_only">Visible to attendees only</option>
            <option value="private">Private</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 13 }}>
            <input type="checkbox" checked={showValueSkin} onChange={e => setShowValueSkin(e.target.checked)} />
            Show ValueSkin on card
          </label>
          <button onClick={save} style={{ ...btnBase, background: C.accent, color: '#082f49', width: '100%' }}>Save</button>
          <button onClick={() => setEdit(false)} style={{ ...btnBase, background: 'rgba(148,163,184,0.1)', color: C.textMuted, width: '100%' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
