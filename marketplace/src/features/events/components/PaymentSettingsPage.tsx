'use client';

import type { CSSProperties } from 'react';
import PaymentDashboard from './PaymentDashboard';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)', text: '#f8fafc',
  textMuted: '#94a3b8',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 24, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

export default function PaymentSettingsPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
          Payments
        </h1>
        <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
          Platform fee configuration, provider overrides, transaction dashboard, and the visible test revenue bank.
        </p>
      </div>
      <PaymentDashboard />
    </div>
  );
}
