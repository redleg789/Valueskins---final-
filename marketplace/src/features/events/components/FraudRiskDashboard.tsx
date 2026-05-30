'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { FraudRiskScore, FraudEvent } from '../data/types';
import { FRAUD_TYPE_LABELS } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24', orange: '#fb923c',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 20, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', fontSize: 12,
};

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? C.error : score >= 30 ? C.warning : C.success;
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${color}22`, color }}>{score}</span>;
}

export default function FraudRiskDashboard() {
  const [scores, setScores] = useState<FraudRiskScore[]>([]);
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab] = useState<'scores' | 'events' | 'overview'>('overview');

  const load = useCallback(async () => {
    const [sr, dr] = await Promise.all([
      fetch('/api/efficiency/fraud/scores/event-1'),
      fetch('/api/efficiency/fraud/dashboard'),
    ]);
    if (sr.ok) setScores((await sr.json()).scores || []);
    if (dr.ok) setSummary(await dr.json());
    // Also load fraud events
    const er = await fetch('/api/efficiency/fraud/scores/event-1');
    if (er.ok) {
      // fraud events are in the dashboard
    }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [load]);

  async function reviewScore(id: string, action: string) {
    await fetch(`/api/efficiency/fraud/review/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionTaken: action }),
    });
    load();
  }

  const resolvedEvents = (summary?.recentFraudEvents || events) as FraudEvent[];

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Fraud & Risk Engine</div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {(['overview', 'scores', 'events'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...btnBase, flex: 1, padding: '8px', fontSize: 11,
            background: tab === t ? C.accent : 'transparent',
            color: tab === t ? '#082f49' : C.textMuted,
          }}>{t === 'overview' ? 'Overview' : t === 'scores' ? 'Risk Scores' : 'Fraud Events'}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.error }}>{summary?.highRiskCount || 0}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>High risk</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.warning }}>{summary?.blockedCount || 0}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Blocked</div>
            </div>
          </div>
          {summary?.riskDistribution?.map((r: any) => (
            <div key={r.level} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textMuted }}>
              <span>{r.level}</span>
              <span style={{ fontWeight: 700 }}>{r.count}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>Auto-refreshes every 15s</div>
        </div>
      )}

      {tab === 'scores' && (
        scores.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 13 }}>No risk scores yet.</p>
        ) : (
          scores.map(s => (
            <div key={s.id} style={{
              padding: 12, borderRadius: 16, marginBottom: 8,
              background: s.riskScore >= 70 ? `${C.error}10` : s.riskScore >= 30 ? `${C.warning}10` : 'rgba(15,23,42,0.6)',
              border: `1px solid ${s.riskScore >= 70 ? C.error + '30' : C.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.userName || s.userId}</div>
                  <RiskBadge score={s.riskScore} />
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6, textTransform: 'capitalize' }}>{s.actionTaken}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.actionTaken !== 'block' && <button onClick={() => reviewScore(s.id, 'block')} style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: C.error, color: '#fff' }}>Block</button>}
                  {s.actionTaken !== 'flag' && <button onClick={() => reviewScore(s.id, 'flag')} style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: C.warning, color: '#0f172a' }}>Flag</button>}
                  {s.actionTaken !== 'none' && <button onClick={() => reviewScore(s.id, 'none')} style={{ ...btnBase, padding: '4px 8px', fontSize: 10, background: 'rgba(148,163,184,0.2)', color: C.textMuted }}>Clear</button>}
                </div>
              </div>
              {s.riskFactors.map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {f.factor} (weight: {f.weight}) — {f.details}
                </div>
              ))}
            </div>
          ))
        )
      )}

      {tab === 'events' && (
        resolvedEvents.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 13 }}>No fraud events.</p>
        ) : (
          resolvedEvents.map(e => (
            <div key={e.id} style={{
              padding: 12, borderRadius: 16, marginBottom: 8,
              background: e.severity === 'critical' ? `${C.error}15` : `${C.warning}10`,
              border: `1px solid ${e.severity === 'critical' || e.severity === 'high' ? C.error + '30' : C.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{e.userName || e.userId}</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, textTransform: 'capitalize', background: `${e.severity === 'critical' ? C.error : C.warning}22`, color: e.severity === 'critical' ? C.error : C.warning }}>{e.severity}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{FRAUD_TYPE_LABELS[e.fraudType] || e.fraudType}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                {new Date(e.flaggedAt).toLocaleString()}
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}
