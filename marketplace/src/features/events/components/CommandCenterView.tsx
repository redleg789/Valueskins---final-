'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CommandCenterData, AttendanceMetrics } from '../data/types';

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
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '10px 20px', fontSize: 13,
};

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.accent }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function PercentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span style={{ color: C.textMuted }}>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.12)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function CommandCenterView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [metrics, setMetrics] = useState<AttendanceMetrics | null>(null);
  const [tab, setTab] = useState<'overview' | 'demographics' | 'sources' | 'heatmap'>('overview');

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`/api/event-os/command-center/${eventId}`),
      fetch(`/api/event-os/analytics/${eventId}/metrics`),
    ]);
    if (r1.ok) setData(await r1.json());
    if (r2.ok) setMetrics(await r2.json());
  }, [eventId]);

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, [load]);

  const topSources = data?.conversionSources
    ? data.conversionSources.map(s => [s.source, s.count] as const).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Command Center</div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {(['overview', 'demographics', 'sources', 'heatmap'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...btnBase, flex: 1, padding: '8px', fontSize: 11, textTransform: 'capitalize',
            background: tab === t ? C.accent : 'transparent',
            color: tab === t ? '#082f49' : C.textMuted,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatBox label="Checked In" value={metrics?.totalCheckIns ?? data?.liveAttendeeCount ?? '--'} color={C.success} />
            <StatBox label="Scan Rate" value={data?.scanRate ? `${data.scanRate}/min` : '--'} color={C.accent} />
            <StatBox label="Capacity" value={metrics?.totalCheckIns ? `${metrics.totalCheckIns}` : '--'} color={C.warning} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatBox label="Tickets Sold" value={data?.totalTicketsSold ?? '--'} color={C.orange} />
            <StatBox label="Revenue" value={data?.totalRevenueCents ? `$${(data.totalRevenueCents / 100).toFixed(2)}` : '--'} color={C.warning} />
            <StatBox label="Attendees" value={data?.liveAttendeeCount ?? metrics?.uniqueAttendees ?? '--'} color={C.success} />
          </div>
        </div>
      )}

      {tab === 'demographics' && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Attendee demographics</div>
          {data?.demographics ? (
            <div style={{ display: 'grid', gap: 0 }}>
              {Object.entries(data.demographics).map(([k, v]) => (
                typeof v === 'number' && <PercentBar key={k} label={k} pct={v} color={C.accent} />
              ))}
            </div>
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No demographic data yet.</p>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Conversion sources</div>
          {topSources.length > 0 ? (
            topSources.map(([src, count]) => (
              <PercentBar key={src} label={src} pct={count} color={C.accent} />
            ))
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No source data yet.</p>
          )}
        </div>
      )}

      {tab === 'heatmap' && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Check-in heatmap (hourly)</div>
          {data?.heatmap ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {data.heatmap.map(({ hour, count }, i: number) => {
                const maxCount = Math.max(...data.heatmap.map(h => h.count));
                const intensity = Math.min(1, count / (maxCount || 1));
                return (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: 8,
                    background: `rgba(56,189,248,${0.1 + intensity * 0.7})`,
                    border: intensity > 0.5 ? `1px solid ${C.accent}40` : `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: C.textMuted,
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{count}</div>
                      <div>{hour}h</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No heatmap data yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
