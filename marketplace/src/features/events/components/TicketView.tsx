'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { Ticket } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 24, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '12px 24px', fontSize: 13,
};

export default function TicketView({ ticketCode, onBack = () => {} }: { ticketCode?: string; onBack?: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [transferEmail, setTransferEmail] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const code = ticketCode || 'VS-EVT-DEMO-001';
      const res = await fetch(`/api/event-os/tickets/${code}`);
      if (!res.ok) throw new Error('Not found');
      setTicket(await res.json());
      setStatus('success');
    } catch { setStatus('error'); }
  }, [ticketCode]);

  useEffect(() => { load(); }, [load]);

  async function handleTransfer() {
    if (!ticket || !transferEmail.trim()) return;
    const res = await fetch(`/api/event-os/tickets/${ticket.id}/transfer`, { method: 'POST' });
    if (res.ok) {
      setTicket(await res.json());
      setShowTransfer(false);
      setTransferEmail('');
    }
  }

  async function handleCancel() {
    if (!ticket || !confirm('Cancel this ticket?')) return;
    const res = await fetch(`/api/event-os/tickets/${ticket.id}/cancel`, { method: 'POST' });
    if (res.ok) setTicket(await res.json());
  }

  async function handleWallet() {
    if (!ticket) return;
    const res = await fetch(`/api/event-os/tickets/${ticket.id}/wallet`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      window.open(data.walletUrl, '_blank');
    }
  }

  if (status === 'loading') return <div style={{ color: C.textMuted, padding: 40, textAlign: 'center' }}>Loading ticket...</div>;
  if (status === 'error' || !ticket) return <div style={{ ...card, textAlign: 'center', padding: 40 }}><p style={{ color: C.error }}>Ticket not found.</p><button onClick={onBack} style={{ ...btnBase, background: C.accent, color: '#082f49' }}>Back</button></div>;

  const isActive = ticket.status === 'active';
  const statusColor = ticket.status === 'active' ? C.success : ticket.status === 'used' ? C.accent : C.error;

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      <div style={card}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0 }}>Back</button>
      </div>

      {/* Ticket Card */}
      <div style={{
        ...card, padding: 0, overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        border: `2px solid ${isActive ? C.accent : C.border}`,
      }}>
        {/* Header */}
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>ValueSkins Events</div>
          <div style={{ fontSize: 22, fontWeight: 800, margin: '8px 0', color: isActive ? C.accent : C.text }}>VIP ACCESS</div>
          <div style={{
            width: 160, height: 160, margin: '20px auto',
            background: '#fff', borderRadius: 16, padding: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center' }}>
              {isActive ? (
                <>
                  <div style={{ fontSize: 80, lineHeight: 1, color: '#000', fontFamily: 'monospace', fontWeight: 800, letterSpacing: -2 }}>
                    {ticket.ticketCode.slice(-4)}
                  </div>
                  <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>VS·EVT</div>
                </>
              ) : (
                <div style={{ color: '#999', fontSize: 14, fontWeight: 700 }}>{ticket.status.toUpperCase()}</div>
              )}
            </div>
          </div>
           <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
             Code: {ticket.ticketCode}
           </div>
           {ticket.userName && (
             <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
               Holder: {ticket.userName}
             </div>
           )}
        </div>

        {/* Details */}
        <div style={{ padding: '0 24px 24px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Status</span>
            <span style={{ color: statusColor, fontWeight: 700, fontSize: 13 }}>{ticket.status.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Ticket type</span>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{ticket.ticketType}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Price</span>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>${(ticket.priceCents / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Scans</span>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{ticket.scanCount}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Actions</div>

        {isActive && (
          <>
            <button onClick={handleWallet} style={{ ...btnBase, background: C.accentBg, color: C.accent, width: '100%' }}>
              Save to Wallet (Apple / Google)
            </button>

            <button onClick={() => setShowTransfer(!showTransfer)} style={{ ...btnBase, background: 'rgba(148,163,184,0.1)', color: C.text, width: '100%' }}>
              {showTransfer ? 'Cancel' : 'Transfer ticket'}
            </button>

            {showTransfer && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={transferEmail} onChange={e => setTransferEmail(e.target.value)} placeholder="Transfer to email..." style={{
                  flex: 1, borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.88)',
                  color: C.text, padding: '10px 14px', fontSize: 14, outline: 'none',
                }} />
                <button onClick={handleTransfer} disabled={!transferEmail.trim()} style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 12 }}>Send</button>
              </div>
            )}

            <button onClick={handleCancel} style={{ ...btnBase, background: 'rgba(252,165,165,0.12)', color: C.error, width: '100%' }}>
              Cancel ticket
            </button>
          </>
        )}

        {!isActive && (
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0, textAlign: 'center' }}>
            This ticket is {ticket.status}. No actions available.
          </p>
        )}
      </div>

      {/* Entry Instructions */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Entry instructions</div>
        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 4px' }}>Present this QR code at the venue entrance.</p>
          <p style={{ margin: '0 0 4px' }}>Have a valid ID ready for verification.</p>
          <p style={{ margin: 0, color: C.textMuted }}>VIP entrance is on the right side of the main gate.</p>
        </div>
      </div>
    </div>
  );
}
