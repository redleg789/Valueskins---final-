'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
  PaymentDashboardData, PlatformFeeConfig, ProviderFeeOverride,
  FeeType, PaymentProvider,
} from '../data/types';
import { FEE_TYPE_OPTIONS, PAYMENT_PROVIDER_OPTIONS, DEFAULT_PLATFORM_FEE_PERCENTAGE } from '../data/types';
import FeeCalculator from './FeeCalculator';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)', text: '#f8fafc',
  textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  success: '#86efac', error: '#fca5a5', warning: '#fbbf24',
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

const row: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 0', borderBottom: `1px solid ${C.border}`,
};

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16, textAlign: 'center',
    }}>
      <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function PaymentDashboard() {
  const [data, setData] = useState<PaymentDashboardData | null>(null);
  const [editingFee, setEditingFee] = useState(false);
  const [editFeeType, setEditFeeType] = useState<FeeType>('percentage');
  const [editFlatCents, setEditFlatCents] = useState(0);
  const [editPct, setEditPct] = useState(DEFAULT_PLATFORM_FEE_PERCENTAGE);
  const [editProvider, setEditProvider] = useState<PaymentProvider>('stripe');
  const [editOverrideCents, setEditOverrideCents] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/dashboard');
      const d: PaymentDashboardData = await res.json();
      setData(d);
      setEditFeeType(d.feeConfig?.feeType || 'percentage');
      setEditFlatCents(d.feeConfig?.flatFeeCents || 0);
      setEditPct(d.feeConfig?.percentageRate || DEFAULT_PLATFORM_FEE_PERCENTAGE);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveFeeConfig = async () => {
    await fetch('/api/payments/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeType: editFeeType,
        flatFeeCents: editFlatCents,
        percentageRate: editPct,
      }),
    });
    setEditingFee(false);
    load();
  };

  const saveProviderOverride = async () => {
    if (editOverrideCents === null) return;
    await fetch('/api/payments/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: editProvider,
        feeType: 'flat',
        flatFeeCents: editOverrideCents,
      }),
    });
    load();
  };

  if (!data) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 40 }}>
        <div style={{ color: C.textMuted }}>Loading payment data...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatBox label="Total Revenue" value={`$${(data.totalRevenueCents / 100).toFixed(2)}`} color={C.text} />
        <StatBox label="Platform Fees" value={`$${(data.totalFeesCents / 100).toFixed(2)}`} color={C.accent} />
        <StatBox label="Transactions" value={data.totalTransactions.toLocaleString()} color={C.success} />
        <StatBox label="Pending Fees" value={`$${(data.pendingFeesCents / 100).toFixed(2)}`} color={C.warning} />
      </div>

      {data.virtualBank && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Virtual Revenue Bank</h3>
              <p style={{ color: C.textMuted, fontSize: 13, margin: '6px 0 0' }}>
                This is the visible test settlement account where the 2% platform revenue accumulates.
              </p>
            </div>
            <div style={{ padding: '8px 14px', borderRadius: 999, background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 700 }}>
              {data.virtualBank.label}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16 }}>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Current Balance</div>
              <div style={{ color: C.accent, fontSize: 24, fontWeight: 800 }}>${(data.virtualBank.currentBalanceCents / 100).toFixed(2)}</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>2% fee revenue collected from ticket sales</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16 }}>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Bank Account</div>
              <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>{data.virtualBank.bankName}</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>
                {data.virtualBank.accountHolderName}
              </div>
              <div style={{ color: C.textMuted, fontSize: 12 }}>
                {data.virtualBank.accountNumberMasked} • {data.virtualBank.ifsc}
              </div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 16 }}>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Net To Hosts</div>
              <div style={{ color: C.success, fontSize: 24, fontWeight: 800 }}>${(data.virtualBank.netTicketSalesCents / 100).toFixed(2)}</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>
                {data.virtualBank.ticketsSoldCount} paid ticket sale{data.virtualBank.ticketsSoldCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {data.virtualBank.lastPaymentAt && (
            <div style={{ marginTop: 14, color: C.textMuted, fontSize: 12 }}>
              Last ticket payment recorded at {new Date(data.virtualBank.lastPaymentAt).toLocaleString()}.
            </div>
          )}
        </div>
      )}

      {/* Fee Config Editor */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Platform Fee Configuration</h3>
          <button
            style={{ ...btnBase, background: editingFee ? C.success : C.accent, color: '#0f172a' }}
            onClick={() => editingFee ? saveFeeConfig() : setEditingFee(true)}
          >
            {editingFee ? 'Save' : 'Edit'}
          </button>
        </div>

        {editingFee ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Fee Type
              </label>
              <select style={inp} value={editFeeType} onChange={e => setEditFeeType(e.target.value as FeeType)}>
                {FEE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} style={{ background: C.bg, color: C.text }}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Flat Fee (cents) {editFeeType !== 'percentage' ? '(active)' : '(inactive)'}
                </label>
                <input style={inp} type="number" value={editFlatCents} onChange={e => setEditFlatCents(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Percentage Rate {editFeeType !== 'flat' ? '(active)' : '(inactive)'}
                </label>
                <input style={inp} type="number" step="0.01" value={editPct} onChange={e => setEditPct(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={row}>
              <span style={{ color: C.textMuted, fontSize: 13 }}>Fee Type</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                {data.feeConfig?.feeType === 'flat' ? 'Flat fee' :
                 data.feeConfig?.feeType === 'percentage' ? 'Percentage' : 'Hybrid'}
              </span>
            </div>
            <div style={row}>
              <span style={{ color: C.textMuted, fontSize: 13 }}>Rate</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                {data.feeConfig?.percentageRate ?? DEFAULT_PLATFORM_FEE_PERCENTAGE}%
              </span>
            </div>
            <div style={row}>
              <span style={{ color: C.textMuted, fontSize: 13 }}>Type</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                {data.feeConfig?.feeType === 'flat' ? 'Flat fee' :
                 data.feeConfig?.feeType === 'percentage' ? 'Percentage of transaction' : 'Hybrid'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Provider Overrides */}
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Provider Overrides</h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 140 }}>
            <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Provider
            </label>
            <select style={inp} value={editProvider} onChange={e => setEditProvider(e.target.value as PaymentProvider)}>
              {PAYMENT_PROVIDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value} style={{ background: C.bg, color: C.text }}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Override Fee (cents)
            </label>
            <input style={inp} type="number" value={editOverrideCents ?? ''} onChange={e => setEditOverrideCents(parseInt(e.target.value) || null)} placeholder="Default" />
          </div>
          <button style={{ ...btnBase, background: C.accent, color: '#0f172a' }} onClick={saveProviderOverride}>
            Set Override
          </button>
        </div>
        {data.providerOverrides.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>
            No provider overrides configured. All providers use the global fee config.
          </div>
        ) : data.providerOverrides.map(o => (
          <div key={o.id} style={row}>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
              {o.provider.replace('_', ' ')}
            </span>
            <span style={{ color: C.accent, fontSize: 13 }}>
              {o.percentageRate ? `${o.percentageRate}%` : `${DEFAULT_PLATFORM_FEE_PERCENTAGE}%`}
              {o.flatFeeCents ? ` + $${(o.flatFeeCents / 100).toFixed(2)}` : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Fee Calculator */}
      <FeeCalculator />

      {/* Recent Transactions */}
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Recent Transactions</h3>
        {data.recentTransactions.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>
            No transactions yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>ID</th>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Amount</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Fee</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Net</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 4px', color: C.textMuted, fontFamily: 'monospace', fontSize: 11 }}>
                    {tx.id.slice(-10)}
                  </td>
                  <td style={{ padding: '8px 4px', color: C.text, textTransform: 'capitalize' }}>{tx.type}</td>
                  <td style={{ padding: '8px 4px', color: C.text, textAlign: 'right', fontWeight: 600 }}>
                    ${(tx.amountCents / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 4px', color: C.error, textAlign: 'right' }}>
                    {tx.feeCents !== null ? `-$${(tx.feeCents / 100).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '8px 4px', color: C.success, textAlign: 'right', fontWeight: 600 }}>
                    {tx.netAmountCents !== null ? `$${(tx.netAmountCents / 100).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: tx.status === 'succeeded' ? 'rgba(134, 239, 172, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: tx.status === 'succeeded' ? C.success : C.textMuted,
                    }}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
