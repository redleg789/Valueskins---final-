'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { FeeCalculationResult } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)', text: '#f8fafc',
  textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  success: '#86efac', error: '#fca5a5',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 24, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inp: CSSProperties = {
  width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)', color: C.text, padding: '12px 16px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
  padding: '10px 20px', fontSize: 13,
};

const providers = ['stripe', 'razorpay', 'meta_pay'];

export default function FeeCalculator() {
  const [amount, setAmount] = useState('10000');
  const [provider, setProvider] = useState('stripe');
  const [result, setResult] = useState<FeeCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: parseInt(amount) || 0, provider }),
      });
      const data = await res.json();
      setResult(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div style={card}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
        Platform Fee Calculator
      </h3>
      <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 16px' }}>
        Enter an amount to see the 2% platform fee applied.
      </p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Amount (cents)
          </label>
          <input style={inp} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000 = $100" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Provider
          </label>
          <select style={inp} value={provider} onChange={e => setProvider(e.target.value)}>
            {providers.map(p => (
              <option key={p} value={p} style={{ background: C.bg, color: C.text }}>
                {p.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button
            style={{ ...btnBase, background: C.accent, color: '#0f172a', padding: '11px 24px' }}
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
      </div>

      {result && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)', borderRadius: 16, padding: 16,
          marginTop: 8,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Gross Amount</div>
              <div style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>
                ${((result.netAmountCents + result.feeCents) / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Platform Fee</div>
              <div style={{ color: C.error, fontSize: 20, fontWeight: 700 }}>
                -${(result.feeCents / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Net to Payee</div>
              <div style={{ color: C.success, fontSize: 20, fontWeight: 700 }}>
                ${(result.netAmountCents / 100).toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: 12, fontSize: 12, color: C.textMuted,
          }}>
            Fee breakdown: ${(result.breakdown.flatComponent / 100).toFixed(2)} flat
            {(result.breakdown.percentageComponent > 0) && ` + $${(result.breakdown.percentageComponent / 100).toFixed(2)}`}
            {' '}— provider: {result.provider}
          </div>
        </div>
      )}
    </div>
  );
}
