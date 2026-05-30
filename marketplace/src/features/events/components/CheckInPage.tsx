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

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '12px 24px', fontSize: 14,
};

const inp: CSSProperties = {
  width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)', color: C.text, padding: '12px 16px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

type Mode = 'scan' | 'manual' | 'history';

export default function CheckInPage({ eventId, onBack }: { eventId?: string; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('scan');
  const [ticketCode, setTicketCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [attendees, setAttendees] = useState<any[]>([]);

  const eid = eventId || '';

  const loadStats = useCallback(async () => {
    try {
      const [countRes, logRes] = await Promise.all([
        fetch(`/api/event-os/check-in/event/${eid}/count`),
        fetch(`/api/event-os/check-in/logs/${eid}`),
      ]);
      if (countRes.ok) { const d = await countRes.json(); setLiveCount(d.count); setTotalTickets(d.total); }
      if (logRes.ok) { const d = await logRes.json(); setLogs(d.checkIns || []); }
    } catch { /* ignore */ }
  }, [eid]);

  useEffect(() => { loadStats(); const iv = setInterval(loadStats, 5000); return () => clearInterval(iv); }, [loadStats]);

  async function scanTicket() {
    if (!ticketCode.trim()) return;
    setResult(null);
    try {
      const res = await fetch('/api/event-os/check-in/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode: ticketCode.trim() }),
      });
      setResult(await res.json());
      loadStats();
    } catch { setResult({ valid: false, rejectionReason: 'Server error' }); }
  }

  async function manualCheckIn() {
    if (!manualName.trim()) return;
    setResult(null);
    const res = await fetch('/api/event-os/check-in/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketCode: ticketCode || `MANUAL-${Date.now()}`, name: manualName, email: manualEmail }),
    });
    setResult(await res.json());
    loadStats();
  }

  async function loadAttendees() {
    const res = await fetch('/api/event-os/check-in/attendees');
    if (res.ok) setAttendees((await res.json()).attendees || []);
  }

  const scanRate = totalTickets > 0 ? Math.round((liveCount / totalTickets) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      <div style={card}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0 }}>Back</button>
        <h2 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 800 }}>Check-In</h2>
      </div>

      {/* Live count */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ ...card, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.success }}>{liveCount}</div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Checked in</div>
        </div>
        <div style={{ ...card, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{totalTickets}</div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Total tickets</div>
        </div>
        <div style={{ ...card, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: scanRate > 50 ? C.success : C.warning }}>{scanRate}%</div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Scan rate</div>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4 }}>
        {(['scan', 'manual', 'history'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            ...btnBase, flex: 1, padding: '10px',
            background: mode === m ? C.accent : 'transparent',
            color: mode === m ? '#082f49' : C.textMuted, fontSize: 12,
            textTransform: 'capitalize',
          }}>{m === 'scan' ? 'Scan QR' : m === 'manual' ? 'Manual entry' : 'History'}</button>
        ))}
      </div>

      {/* Scan mode */}
      {mode === 'scan' && (
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Scan QR Code</div>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>
            Enter the ticket code or scan using a QR reader.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ticketCode} onChange={e => setTicketCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scanTicket()}
              placeholder="Scan or enter ticket code (e.g. VS-EVT-DEMO-001)"
              style={{ ...inp, flex: 1, fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}
            />
            <button onClick={scanTicket} style={{ ...btnBase, background: C.accent, color: '#082f49', padding: '12px 28px' }}>Check</button>
          </div>

          {result && <ScanResult result={result} />}
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Manual Check-In</div>
          <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Full name" style={inp} />
          <input value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="Email (optional)" style={inp} />
          <input value={ticketCode} onChange={e => setTicketCode(e.target.value)} placeholder="Ticket code (optional)" style={inp} />
          <button onClick={manualCheckIn} disabled={!manualName.trim()} style={{
            ...btnBase, background: manualName.trim() ? C.accent : C.border,
            color: '#fff', width: '100%', cursor: manualName.trim() ? 'pointer' : 'not-allowed',
          }}>Check in</button>

          {result && <ScanResult result={result} />}

          <button onClick={loadAttendees} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 12, width: '100%' }}>
            Search attendees
          </button>
          {attendees.length > 0 && (
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {attendees.filter((a: any) => !searchTerm || a.ticketCode.toLowerCase().includes(searchTerm.toLowerCase())).map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13 }}>{a.ticketCode}</span>
                  <span style={{ fontSize: 12, color: a.status === 'used' ? C.success : C.textMuted }}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {mode === 'history' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Scan History ({logs.length})</div>
          {logs.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No check-ins yet.</p>
          ) : (
            logs.slice().reverse().map((log: any) => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{log.ticketId?.slice(0, 12) || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(log.entryTime).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{log.scanMethod}</span>
                  {log.reEntry && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: `${C.warning}22`, color: C.warning }}>Re-entry</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ScanResult({ result }: { result: any }) {
  if (result.valid) {
    return (
      <div style={{ padding: 16, borderRadius: 16, background: `${C.success}15`, border: `1px solid ${C.success}40` }}>
        <div style={{ color: C.success, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Entry approved</div>
        {result.isReEntry && <div style={{ color: C.warning, fontSize: 13 }}>Re-entry logged</div>}
        {result.ticket && (
          <div style={{ marginTop: 8, fontSize: 13, color: C.textMuted }}>
            <div>{result.ticket.ticketType} — {result.ticket.ticketCode}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 16, borderRadius: 16, background: `${C.error}15`, border: `1px solid ${C.error}40` }}>
      <div style={{ color: C.error, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Entry denied</div>
      <div style={{ color: C.textMuted, fontSize: 13 }}>{result.rejectionReason}</div>
      {result.isDuplicate && <div style={{ color: C.warning, fontSize: 12, marginTop: 4 }}>Duplicate scan detected</div>}
    </div>
  );
}
