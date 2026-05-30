'use client';

import { useState, useEffect } from 'react';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  success: '#86efac',
};

export default function PromoterAnalyticsSection({ eventId }: { eventId?: string }) {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetchAnalytics();
  }, [eventId]);

  async function fetchAnalytics() {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/promoters/analytics`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data.analytics || []);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ color: C.textMuted }}>Loading analytics...</div>;

  if (analytics.length === 0) {
    return <div style={{ color: C.textMuted, fontSize: 14 }}>No promoter activity yet</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {analytics.map((promo) => (
        <div key={promo.promoterId} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{promo.name} (@{promo.username})</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
                Code: <span style={{ fontFamily: 'monospace', color: C.accent }}>{promo.promoCode}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 12, borderRadius: 8 }}>
              <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>TICKETS SOLD</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{promo.ticketsSold}</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 12, borderRadius: 8 }}>
              <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>REVENUE GENERATED</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>₹{(promo.totalRevenueCents / 100).toFixed(0)}</div>
            </div>

            <div style={{ background: 'rgba(134, 239, 172, 0.1)', padding: 12, borderRadius: 8 }}>
              <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>COMMISSION EARNED</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.success }}>₹{(promo.estimatedCommissionCents / 100).toFixed(0)}</div>
              <div style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>
                {promo.commissionType === 'percentage' ? `${promo.commissionValue}%` : `₹${promo.commissionValue}/ticket`}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
