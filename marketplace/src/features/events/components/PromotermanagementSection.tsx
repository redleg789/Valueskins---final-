'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5',
  success: '#86efac',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
};

const inp: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)',
  color: C.text,
  padding: '12px 16px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function PromoterManagementSection({ eventId }: { eventId?: string }) {
  const [promoters, setPromoters] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    fetchPromoters();
  }, [eventId]);

  async function fetchPromoters() {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/promoters`);
      if (!res.ok) return;
      const data = await res.json();
      setPromoters(data.promoters || []);
    } catch (e) {
      console.error('Failed to fetch promoters:', e);
    }
  }

  async function addPromoter() {
    if (!newUsername.trim() || !commissionValue.trim() || !eventId) {
      setError('All fields required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/promoters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoterUsername: newUsername.trim(),
          commissionType,
          commissionValue: parseFloat(commissionValue),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to add promoter');
        return;
      }
      const data = await res.json();
      setPromoters(data.promoters || []);
      setNewUsername('');
      setCommissionValue('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removePromoter(promoterId: string) {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/promoters/${promoterId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      const data = await res.json();
      setPromoters(data.promoters || []);
    } catch (e) {
      console.error('Failed to remove promoter:', e);
    }
  }

  return (
    <div style={{ ...card, padding: 24 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Promoter Management</h3>

      {promoters.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>ACTIVE PROMOTERS</div>
          {promoters.map((p) => (
            <div key={p.id} style={{ ...card, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.name} (@{p.username})</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
                  Code: <span style={{ fontFamily: 'monospace', color: C.accent }}>{p.promoCode}</span> • {p.commissionType === 'percentage' ? `${p.commissionValue}%` : `₹${p.commissionValue}/ticket`}
                </div>
              </div>
              <button
                onClick={() => removePromoter(p.id)}
                style={{ background: 'rgba(252,165,165,0.12)', color: C.error, border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>ADD PROMOTER</div>
        {error && <div style={{ color: C.error, fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            type="text"
            placeholder="Promoter username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            style={inp}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <select
              value={commissionType}
              onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
              style={{ ...inp, background: 'rgba(15, 23, 42, 0.88)' } as any}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
            <input
              type="number"
              placeholder={commissionType === 'percentage' ? '15' : '100'}
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
              style={inp}
            />
          </div>
          <button
            onClick={addPromoter}
            disabled={loading}
            style={{
              background: C.accent,
              color: '#082f49',
              border: 'none',
              padding: '12px',
              borderRadius: 12,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Adding...' : 'Add Promoter'}
          </button>
        </div>
      </div>
    </div>
  );
}
