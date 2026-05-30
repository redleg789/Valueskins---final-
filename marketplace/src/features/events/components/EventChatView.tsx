'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', warning: '#fbbf24',
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

export default function EventChatView({ eventId, isHost }: { eventId: string; isHost?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/event-os/chat/event/${eventId}`);
      if (!res.ok) throw new Error('Failed');
      setMessages((await res.json()).messages || []);
      setStatus('success');
    } catch { setStatus('error'); }
  }, [eventId]);

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim()) return;
    await fetch('/api/event-os/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, message: input.trim() }),
    });
    setInput('');
    load();
  }

  async function moderate(id: string) {
    await fetch(`/api/event-os/chat/${id}/moderate`, { method: 'POST' });
    load();
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', height: 400 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, flexShrink: 0 }}>Event Chat</div>

      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gap: 8, alignContent: 'start', paddingRight: 4 }}>
        {status === 'loading' ? (
          <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>Loading...</p>
        ) : messages.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>No messages yet. Be the first!</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{
              display: 'grid', gap: 2,
              padding: '8px 12px', borderRadius: 16,
              background: msg.senderName === 'You' ? C.accentBg : 'rgba(15,23,42,0.6)',
              border: msg.isAnnouncement ? `1px solid ${C.warning}40` : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: msg.senderName === 'You' ? C.accent : C.text }}>
                  {msg.senderName}
                  {msg.isAnnouncement && <span style={{ color: C.warning, marginLeft: 6, fontSize: 10 }}>Announcement</span>}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {msg.isPinned && <span style={{ fontSize: 10, color: C.warning }}>Pinned</span>}
                  <span style={{ fontSize: 10, color: C.textMuted }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <p style={{ margin: 0, color: msg.isPinned ? C.warning : '#cbd5e1', fontSize: 13 }}>{msg.message}</p>
              {msg.isModerated && <span style={{ fontSize: 10, color: C.error, marginTop: 2 }}>Moderated</span>}
              {isHost && !msg.isModerated && (
                <button onClick={() => moderate(msg.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 10, padding: 0, textAlign: 'left', marginTop: 2 }}>Remove</button>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          style={{ ...inp, flex: 1 }}
        />
        <button onClick={send} disabled={!input.trim()} style={{
          ...btnBase, background: input.trim() ? C.accent : C.border, color: '#fff',
          cursor: input.trim() ? 'pointer' : 'not-allowed',
        }}>Send</button>
      </div>
    </div>
  );
}
