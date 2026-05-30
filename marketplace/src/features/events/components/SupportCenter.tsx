// @ts-nocheck
'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SupportTicket, SupportMessage, KnowledgeBaseArticle, TicketCategory, TicketPriority } from '../data/types';
import { TICKET_CATEGORY_OPTIONS } from '../data/types';

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
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '10px 18px', fontSize: 13,
};

type View = 'home' | 'new' | 'detail' | 'kb';

const PRIORITY_COLORS: Record<string, string> = {
  low: C.textMuted, normal: C.accent, high: C.warning, urgent: C.orange || '#fb923c', emergency: C.error,
};
const STATUS_COLORS: Record<string, string> = {
  open: C.error, investigating: C.accent, waiting_on_user: C.warning, resolved: C.success, closed: C.textMuted,
};

export default function SupportCenter({ eventId, minimized }: { eventId?: string; minimized?: boolean }) {
  const [view, setView] = useState<View>('home');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [kbQuery, setKbQuery] = useState('');

  const [newCategory, setNewCategory] = useState<TicketCategory>('general');
  const [newPriority, setNewPriority] = useState<TicketPriority>('normal');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const loadTickets = useCallback(async () => {
    const res = await fetch('/api/efficiency/support/tickets');
    if (res.ok) setTickets((await res.json()).tickets || []);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function searchKB(q: string) {
    setKbQuery(q);
    const res = await fetch(`/api/efficiency/support/kb?q=${encodeURIComponent(q)}`);
    if (res.ok) setArticles((await res.json()).articles || []);
  }

  async function createTicket() {
    if (!newSubject.trim() || !newDescription.trim()) return;
    const res = await fetch('/api/efficiency/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: eventId || null, category: newCategory, priority: newPriority, subject: newSubject, description: newDescription }),
    });
    if (res.ok) {
      setNewSubject(''); setNewDescription(''); setNewCategory('general'); setNewPriority('normal');
      setView('home');
      loadTickets();
    }
  }

  async function addMessage(ticketId: string, message: string) {
    if (!message.trim()) return;
    await fetch(`/api/efficiency/support/tickets/${ticketId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, isInternal: false }),
    });
    const res = await fetch(`/api/efficiency/support/tickets/${ticketId}`);
    if (res.ok) setSelectedTicket(await res.json());
  }

  async function updateStatus(ticketId: string, status: string) {
    await fetch(`/api/efficiency/support/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadTickets();
    const res = await fetch(`/api/efficiency/support/tickets/${ticketId}`);
    if (res.ok) setSelectedTicket(await res.json());
  }

  if (minimized) {
    return (
      <button onClick={() => setView('home')} style={{
        ...btnBase, position: 'fixed', bottom: 20, right: 20,
        background: C.accent, color: '#082f49', padding: '14px 24px',
        boxShadow: '0 8px 32px rgba(56,189,248,0.3)',
        zIndex: 999, fontSize: 14,
      }}>
        Need Help?
      </button>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {view === 'home' ? 'Support Center' : view === 'new' ? 'New Ticket' : view === 'detail' ? selectedTicket?.subject : 'Knowledge Base'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setView('kb'); searchKB(''); }} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, background: 'rgba(148,163,184,0.1)', color: C.textMuted }}>KB</button>
          <button onClick={() => setView('new')} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, background: C.accentBg, color: C.accent }}>+ New</button>
          {view !== 'home' && <button onClick={() => setView('home')} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, background: 'rgba(148,163,184,0.1)', color: C.textMuted }}>Back</button>}
        </div>
      </div>

      {view === 'home' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* KB Search */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={kbQuery} onChange={e => searchKB(e.target.value)} placeholder="Search help articles..." style={{ ...inp, flex: 1 }} />
            {kbQuery && <button onClick={() => { searchKB(''); setKbQuery(''); }} style={{ ...btnBase, padding: '6px 12px', fontSize: 11, background: 'rgba(148,163,184,0.1)', color: C.textMuted }}>Clear</button>}
          </div>
          {kbQuery && articles.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Suggested articles</div>
              {articles.slice(0, 3).map(a => (
                <div key={a.id} style={{
                  padding: '8px 12px', borderRadius: 12, background: C.accentBg, marginBottom: 4, cursor: 'pointer',
                }} onClick={() => { setView('kb'); setKbQuery(a.question); searchKB(a.question); }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{a.question}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tickets list */}
          {tickets.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Your tickets ({tickets.length})</div>
              {tickets.map(t => (
                <div key={t.id} onClick={async () => {
                  const res = await fetch(`/api/efficiency/support/tickets/${t.id}`);
                  if (res.ok) { setSelectedTicket(await res.json()); setView('detail'); }
                }} style={{
                  padding: '10px 12px', borderRadius: 12, marginBottom: 6, cursor: 'pointer',
                  background: t.status === 'open' ? `${C.error}08` : 'rgba(15,23,42,0.5)',
                  border: `1px solid ${t.status === 'open' ? C.error + '20' : C.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.subject}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, background: `${(PRIORITY_COLORS[t.priority] || C.textMuted)}22`, color: PRIORITY_COLORS[t.priority] || C.textMuted, textTransform: 'capitalize' }}>{t.priority}</span>
                      <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, background: `${(STATUS_COLORS[t.status] || C.textMuted)}22`, color: STATUS_COLORS[t.status] || C.textMuted, textTransform: 'capitalize' }}>{t.status}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{t.category} | {new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
          {tickets.length === 0 && !kbQuery && (
            <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
              No tickets yet. Search the knowledge base or create a new ticket.
            </p>
          )}
        </div>
      )}

      {view === 'new' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={lbl}>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Category</span>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value as TicketCategory)} style={inp}>
              {TICKET_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={lbl}>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Priority</span>
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as TicketPriority)} style={inp}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent" style={{ color: C.warning }}>Urgent</option>
              <option value="emergency" style={{ color: C.error }}>Emergency</option>
            </select>
          </div>
          <div style={lbl}>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Subject</span>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief summary" style={inp} />
          </div>
          <div style={lbl}>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Description</span>
            <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
              placeholder="Describe your issue in detail..." style={{ ...inp, minHeight: 120, resize: 'vertical' }} />
          </div>
          <button onClick={createTicket} disabled={!newSubject.trim() || !newDescription.trim()} style={{
            ...btnBase, width: '100%',
            background: newSubject.trim() && newDescription.trim() ? C.accent : C.border,
            color: '#fff', cursor: newSubject.trim() && newDescription.trim() ? 'pointer' : 'not-allowed',
          }}>Submit ticket</button>
        </div>
      )}

      {view === 'detail' && selectedTicket && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, background: `${(STATUS_COLORS[selectedTicket.status] || C.textMuted)}22`, color: STATUS_COLORS[selectedTicket.status] || C.textMuted, textTransform: 'capitalize' }}>{selectedTicket.status}</span>
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, background: `${(PRIORITY_COLORS[selectedTicket.priority] || C.textMuted)}22`, color: PRIORITY_COLORS[selectedTicket.priority] || C.textMuted, textTransform: 'capitalize', marginLeft: 4 }}>{selectedTicket.priority}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {selectedTicket.status === 'open' && <button onClick={() => updateStatus(selectedTicket.id, 'investigating')} style={{ ...btnBase, padding: '4px 10px', fontSize: 10, background: C.accent, color: '#082f49' }}>Investigate</button>}
              {selectedTicket.status !== 'resolved' && <button onClick={() => updateStatus(selectedTicket.id, 'resolved')} style={{ ...btnBase, padding: '4px 10px', fontSize: 10, background: C.success, color: '#0f172a' }}>Resolve</button>}
            </div>
          </div>

          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14 }}>{selectedTicket.description}</p>

          {/* Messages */}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {selectedTicket.messages?.map(m => (
              <div key={m.id} style={{
                padding: '10px 14px', borderRadius: 16,
                background: m.senderId === 'support-agent' ? C.accentBg : 'rgba(15,23,42,0.6)',
                alignSelf: m.senderId === 'support-agent' ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
              }}>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>{m.message}</p>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Reply */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input id={`msg-${selectedTicket.id}`} placeholder="Type your reply..." style={{ ...inp, flex: 1 }} />
            <button onClick={() => {
              const el = document.getElementById(`msg-${selectedTicket.id}`) as HTMLInputElement;
              if (el) { addMessage(selectedTicket.id, el.value); el.value = ''; }
            }} style={{ ...btnBase, background: C.accent, color: '#082f49' }}>Send</button>
          </div>
        </div>
      )}

      {view === 'kb' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={kbQuery} onChange={e => searchKB(e.target.value)} placeholder="Search articles..." style={inp} />
          {articles.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
              {kbQuery ? 'No matching articles.' : 'Type a question to search the knowledge base.'}
            </p>
          ) : (
            articles.map(a => (
              <details key={a.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: C.accent, padding: '8px 0' }}>{a.question}</summary>
                <p style={{ margin: '6px 0', color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>{a.answer}</p>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  Tags: {a.tags.join(', ')} | Helpful: {a.helpfulCount}
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const lbl: CSSProperties = { display: 'grid', gap: 4 };
