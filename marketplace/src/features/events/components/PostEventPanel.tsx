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

type Tab = 'rate' | 'connections' | 'suggestions';

export default function PostEventPanel({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<Tab>('rate');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [connections, setConnections] = useState<string[]>([]);
  const [requests, setRequests] = useState<{ id: string; from: string; status: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggInput, setSuggInput] = useState('');

  useEffect(() => {
    fetch(`/api/event-os/ratings/${eventId}/user`).then(r => r.ok && r.json().then(d => { if (d.rating) { setRating(d.rating); setReview(d.review || ''); setSubmitted(true); } }));
    fetch(`/api/event-os/ratings/${eventId}/suggestions`).then(r => r.ok && r.json().then(d => setSuggestions(d.suggestions || [])));
    fetch(`/api/event-os/connections/${eventId}/requests`).then(r => r.ok && r.json().then(d => setRequests(d.requests || [])));
  }, [eventId]);

  async function submitRating() {
    if (rating === 0) return;
    await fetch(`/api/event-os/ratings/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, review }),
    });
    setSubmitted(true);
  }

  async function sendRequest(userId: string) {
    await fetch(`/api/event-os/connections/${eventId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    });
  }

  async function respond(id: string, accept: boolean) {
    await fetch(`/api/event-os/connections/${eventId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, accept }),
    });
    setRequests(prev => prev.filter(r => r.id !== id));
    if (accept) setConnections(prev => [...prev, id]);
  }

  async function submitSuggestion() {
    if (!suggInput.trim()) return;
    await fetch(`/api/event-os/ratings/${eventId}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion: suggInput.trim() }),
    });
    setSuggInput('');
    fetch(`/api/event-os/ratings/${eventId}/suggestions`).then(r => r.ok && r.json().then(d => setSuggestions(d.suggestions || [])));
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {(['rate', 'connections', 'suggestions'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...btnBase, flex: 1, padding: '10px', fontSize: 12, textTransform: 'capitalize',
            background: tab === t ? C.accent : 'transparent',
            color: tab === t ? '#082f49' : C.textMuted,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'rate' && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{submitted ? 'Your rating' : 'Rate this event'}</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <button key={v} onClick={() => !submitted && setRating(v)} style={{
                width: 40, height: 40, borderRadius: 999, border: 'none', fontSize: 20, cursor: submitted ? 'default' : 'pointer',
                background: v <= rating ? C.warning : 'rgba(148,163,184,0.1)',
                color: v <= rating ? '#0f172a' : C.textMuted,
                transition: 'all 0.15s',
              }}>{v}</button>
            ))}
          </div>
          {!submitted ? (
            <>
              <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Write a review..." style={{ ...inp, minHeight: 80, resize: 'vertical', marginBottom: 10 }} />
              <button onClick={submitRating} disabled={rating === 0} style={{
                ...btnBase, width: '100%',
                background: rating === 0 ? C.border : C.accent,
                color: '#fff', cursor: rating === 0 ? 'not-allowed' : 'pointer',
              }}>Submit rating</button>
            </>
          ) : (
            review && <p style={{ color: '#cbd5e1', fontSize: 13 }}>{review}</p>
          )}
        </>
      )}

      {tab === 'connections' && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Connections</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input id="connect-user" placeholder="User ID to connect with" style={inp} />
            <button onClick={() => { const inp = document.getElementById('connect-user') as HTMLInputElement; if (inp.value) { sendRequest(inp.value); inp.value = ''; } }} style={{ ...btnBase, background: C.accent, color: '#fff' }}>Send connection request</button>
          </div>
          {requests.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Pending requests ({requests.length})</div>
              {requests.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13 }}>{r.from}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => respond(r.id, true)} style={{ ...btnBase, padding: '4px 12px', fontSize: 11, background: C.success, color: '#0f172a' }}>Accept</button>
                    <button onClick={() => respond(r.id, false)} style={{ ...btnBase, padding: '4px 12px', fontSize: 11, background: C.error, color: '#fff' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'suggestions' && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Suggestions for the host</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={suggInput} onChange={e => setSuggInput(e.target.value)} placeholder="What could be better?" style={{ ...inp, flex: 1 }} />
            <button onClick={submitSuggestion} disabled={!suggInput.trim()} style={{
              ...btnBase, background: suggInput.trim() ? C.accent : C.border, color: '#fff',
              cursor: suggInput.trim() ? 'pointer' : 'not-allowed',
            }}>Send</button>
          </div>
          {suggestions.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 12, background: 'rgba(15,23,42,0.6)', color: '#cbd5e1', fontSize: 13 }}>{s}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
