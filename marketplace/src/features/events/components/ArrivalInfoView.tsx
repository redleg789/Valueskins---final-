'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ArrivalInfo } from '../data/types';

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

export default function ArrivalInfoView({ eventId, isHost }: { eventId: string; isHost?: boolean }) {
  const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [editArrival, setEditArrival] = useState(false);
  const [editData, setEditData] = useState<Partial<ArrivalInfo>>({});

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/event-os/arrival/${eventId}`);
      if (!res.ok) { setStatus('error'); return; }
      setArrival(await res.json());
      setStatus('success');
    } catch { setStatus('error'); }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  async function saveArrival() {
    const res = await fetch(`/api/event-os/arrival/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setArrival(await res.json()); setEditArrival(false); }
  }

  const revealPolicy = arrival?.locationRevealPolicy || 'purchase';
  const canSee = arrival && (revealPolicy === 'purchase' || (revealPolicy === 'time_threshold' && new Date(arrival.revealTime || '') < new Date()));
  const hidden = arrival && !canSee;

  if (status === 'loading') return <div style={{ color: C.textMuted, padding: 20, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Arrival Information</div>

      {status === 'error' && !arrival && (
        <p style={{ color: C.textMuted, fontSize: 13 }}>No arrival info set up yet.</p>
      )}

      {arrival && !editArrival && (
        <div style={{ display: 'grid', gap: 10 }}>
          {canSee && (
            <>
              {arrival.parkingDetails && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Parking</div>
                  <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>{arrival.parkingDetails}</p>
                </div>
              )}
              {arrival.gateNumber && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Entry gate</div>
                  <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>{arrival.gateNumber}</p>
                </div>
              )}
              {arrival.floorNumber && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Floor / Section</div>
                  <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>{arrival.floorNumber}</p>
                </div>
              )}
              {arrival.tableAssignment && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Table / Seat</div>
                  <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>{arrival.tableAssignment}</p>
                </div>
              )}
              {arrival.mapUrl && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Venue Map</div>
                  <img src={arrival.mapUrl} alt="Venue map" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: C.textMuted }}>
                Radius: {arrival.proximityRadiusMeters || 0}m
                {arrival.navigationDeeplink && <> | <a href={arrival.navigationDeeplink} style={{ color: C.accent }}>Navigate</a></>}
              </div>
            </>
          )}
          {hidden && (
            <p style={{ color: C.textMuted, fontSize: 13 }}>
              Arrival details are hidden until {arrival.revealTime ? new Date(arrival.revealTime).toLocaleString() : 'the host reveals them'}.
            </p>
          )}
          {isHost && (
            <button onClick={() => { setEditArrival(true); setEditData(arrival); }} style={{ ...btnBase, background: C.accentBg, color: C.accent, marginTop: 8 }}>
              Edit arrival info
            </button>
          )}
        </div>
      )}

      {editArrival && (
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={editData.parkingDetails || ''} onChange={e => setEditData(d => ({ ...d, parkingDetails: e.target.value }))} placeholder="Parking info" style={inp} />
          <input value={editData.gateNumber || ''} onChange={e => setEditData(d => ({ ...d, gateNumber: e.target.value }))} placeholder="Entry gate" style={inp} />
          <input value={editData.floorNumber || ''} onChange={e => setEditData(d => ({ ...d, floorNumber: e.target.value }))} placeholder="Floor / Section" style={inp} />
          <input value={editData.tableAssignment || ''} onChange={e => setEditData(d => ({ ...d, tableAssignment: e.target.value }))} placeholder="Table / Seat" style={inp} />
          <input value={editData.mapUrl || ''} onChange={e => setEditData(d => ({ ...d, mapUrl: e.target.value }))} placeholder="Venue map URL" style={inp} />
          <input value={editData.navigationDeeplink || ''} onChange={e => setEditData(d => ({ ...d, navigationDeeplink: e.target.value }))} placeholder="Navigation link (Google Maps)" style={inp} />
          <select value={editData.locationRevealPolicy || 'purchase'} onChange={e => setEditData(d => ({ ...d, locationRevealPolicy: e.target.value as ArrivalInfo['locationRevealPolicy'] }))} style={inp}>
            <option value="purchase">Always visible after purchase</option>
            <option value="approval">Visible after host approval</option>
            <option value="time_threshold">Visible after specific time</option>
          </select>
          {(editData.locationRevealPolicy || 'purchase') === 'time_threshold' && (
            <input type="datetime-local" value={editData.revealTime || ''} onChange={e => setEditData(d => ({ ...d, revealTime: e.target.value }))} style={inp} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveArrival} style={{ ...btnBase, background: C.accent, color: '#082f49', flex: 1 }}>Save</button>
            <button onClick={() => setEditArrival(false)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
