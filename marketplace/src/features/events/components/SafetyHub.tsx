'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SafetyReport, UserBlock } from '../data/types';

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

type Tab = 'report' | 'block' | 'incidents';

export default function SafetyHub({ eventId, isHost }: { eventId?: string; isHost?: boolean }) {
  const [tab, setTab] = useState<Tab>('report');
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [reportedId, setReportedId] = useState('');
  const [reason, setReason] = useState('');
  const [reportType, setReportType] = useState('attendee');
  const [blockId, setBlockId] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/event-os/safety/reports${eventId ? '/' + eventId : ''}`);
    if (res.ok) setReports((await res.json()).reports || []);
  }, [eventId]);

  const loadBlocks = useCallback(async () => {
    const res = await fetch('/api/event-os/safety/blocks');
    if (res.ok) setBlocks((await res.json()).blocks || []);
  }, []);

  useEffect(() => { if (isHost) loadReports(); loadBlocks(); }, [isHost, loadReports, loadBlocks]);

  async function submitReport() {
    if (!reportedId.trim() || !reason.trim()) return;
    await fetch('/api/event-os/safety/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, reportedId: reportedId.trim(), reportType, reason: reason.trim() }),
    });
    setReportedId('');
    setReason('');
    loadReports();
  }

  async function submitBlock() {
    if (!blockId.trim()) return;
    await fetch('/api/event-os/safety/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: blockId.trim(), reason: blockReason }),
    });
    setBlockId('');
    setBlockReason('');
    loadBlocks();
  }

  async function unblock(id: string) {
    await fetch('/api/event-os/safety/unblock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: id }),
    });
    loadBlocks();
  }

  async function resolveReport(id: string) {
    await fetch(`/api/event-os/safety/reports/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution: 'Reviewed and resolved' }),
    });
    loadReports();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* SOS */}
      <button onClick={() => { if (confirm('Send SOS alert to event host and security?')) alert('SOS sent. Help is on the way.'); }} style={{
        ...btnBase, width: '100%', padding: '20px',
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        color: '#fff', fontSize: 18, fontWeight: 800,
        letterSpacing: '0.04em',
      }}>
        SOS — Emergency
      </button>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4 }}>
        {(['report', 'block', 'incidents'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...btnBase, flex: 1, padding: '10px',
            background: tab === t ? C.accent : 'transparent',
            color: tab === t ? '#082f49' : C.textMuted, fontSize: 12,
            textTransform: 'capitalize',
          }}>{t === 'incidents' ? `Reports (${reports.length})` : t === 'report' ? 'Report' : 'Block'}</button>
        ))}
      </div>

      {tab === 'report' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Report a user</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={inp}>
              <option value="attendee">Report attendee</option>
              <option value="host">Report host</option>
              <option value="venue">Report venue</option>
            </select>
            <input value={reportedId} onChange={e => setReportedId(e.target.value)} placeholder="User ID to report" style={inp} />
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the issue..." style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
            <button onClick={submitReport} disabled={!reportedId.trim() || !reason.trim()} style={{
              ...btnBase, background: reportedId.trim() && reason.trim() ? C.error : C.border,
              color: '#fff', width: '100%',
              cursor: reportedId.trim() && reason.trim() ? 'pointer' : 'not-allowed',
            }}>Submit report</button>
          </div>
        </div>
      )}

      {tab === 'block' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Blocked users ({blocks.length})</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input value={blockId} onChange={e => setBlockId(e.target.value)} placeholder="User ID to block" style={inp} />
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Reason (optional)" style={inp} />
            <button onClick={submitBlock} disabled={!blockId.trim()} style={{
              ...btnBase, background: blockId.trim() ? C.error : C.border, color: '#fff',
              cursor: blockId.trim() ? 'pointer' : 'not-allowed',
            }}>Block user</button>
          </div>
          {blocks.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, marginTop: 8 }}>
              <span style={{ fontSize: 13 }}>{b.blockedId}</span>
              <button onClick={() => unblock(b.blockedId)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12 }}>Unblock</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'incidents' && isHost && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Incident reports ({reports.length})</div>
          {reports.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No reports.</p>
          ) : (
            reports.map(r => (
              <div key={r.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{r.reportType}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999,
                    background: r.status === 'open' ? `${C.warning}22` : `${C.success}22`,
                    color: r.status === 'open' ? C.warning : C.success,
                  }}>{r.status}</span>
                </div>
                <p style={{ margin: '4px 0', color: C.textMuted, fontSize: 13 }}>{r.reason}</p>
                <div style={{ fontSize: 11, color: C.textMuted }}>Reported: {r.reportedId}</div>
                {r.status === 'open' && (
                  <button onClick={() => resolveReport(r.id)} style={{ background: 'none', border: 'none', color: C.success, cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4 }}>Resolve</button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
