'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  success: '#86efac',
};

const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
};

export default function PromoterEarningsPage() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  async function fetchEarnings() {
    try {
      const res = await fetch('/api/events/promoter-earnings');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEarnings(data.earnings || []);
      setTotalEarnings(data.totalEarningsCents || 0);
    } catch (e) {
      console.error('Failed to fetch earnings:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: C.accent, fontSize: 14, cursor: 'pointer', marginBottom: 20 }}
        >
          ← Back
        </button>

        <div style={{ ...card, padding: 32, marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800 }}>Your Earnings</h1>
          <p style={{ margin: 0, color: C.textMuted }}>Track commissions from events you promoted</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24 }}>
            <div style={{ background: 'rgba(134, 239, 172, 0.1)', padding: 20, borderRadius: 12 }}>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>TOTAL EARNINGS</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.success }}>₹{(totalEarnings / 100).toFixed(0)}</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 20, borderRadius: 12 }}>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>EVENTS PROMOTED</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{earnings.length}</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 20, borderRadius: 12 }}>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>TICKETS DRIVEN</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>
                {earnings.reduce((sum, e) => sum + e.ticketsSold, 0)}
              </div>
            </div>
          </div>
        </div>

        {earnings.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>You haven't promoted any events yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {earnings.map((event) => (
              <div key={event.eventId} style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{event.eventName}</div>
                    <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
                      {event.commissionType === 'percentage' ? `${event.commissionValue}% commission` : `₹${event.commissionValue} per ticket`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>TICKETS SOLD</div>
                    <div style={{ fontWeight: 700 }}>{event.ticketsSold}</div>
                  </div>

                  <div>
                    <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>REVENUE GENERATED</div>
                    <div style={{ fontWeight: 700 }}>₹{(event.totalRevenueCents / 100).toFixed(0)}</div>
                  </div>

                  <div>
                    <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>YOUR COMMISSION</div>
                    <div style={{ fontWeight: 700, color: C.success }}>₹{(event.estimatedCommissionCents / 100).toFixed(0)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
