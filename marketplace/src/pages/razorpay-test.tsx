import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
    };
  }
}

type ConfigState = {
  keyId: string;
  hasKeyId: boolean;
  hasKeySecret: boolean;
  readyForOrders: boolean;
  mode: string;
  businessBank?: {
    label: string;
    bankName: string;
    accountHolderName: string;
    accountNumberLast4: string;
    ifsc: string;
  };
};

const C = {
  bg: '#0b1020',
  surface: '#121a30',
  border: 'rgba(148, 163, 184, 0.2)',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  success: '#86efac',
  warning: '#fbbf24',
  error: '#fca5a5',
};

export default function RazorpayTestPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [amountInRupees, setAmountInRupees] = useState('499');
  const [name, setName] = useState('Test Buyer');
  const [email, setEmail] = useState('testbuyer@example.com');
  const [phone, setPhone] = useState('9999999999');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/razorpay-test/config')
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {
        setMessage('Could not load Razorpay config');
      });

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function startPayment() {
    setLoading(true);
    setMessage('');

    try {
      const orderRes = await fetch('/api/razorpay-test/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInRupees }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout script did not load');
      }

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'ValueSkins',
        description: 'Razorpay test payment',
        order_id: orderData.order.id,
        prefill: { name, email, contact: phone },
        theme: { color: C.accent },
        handler: async function (response: Record<string, string>) {
          const verifyRes = await fetch('/api/razorpay-test/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          setMessage(
            verifyData.verified
              ? `Payment verified: ${response.razorpay_payment_id}`
              : 'Payment completed but signature verification failed'
          );
        },
        modal: {
          ondismiss: function () {
            setMessage('Checkout closed');
          },
        },
      });

      razorpay.open();
    } catch (error: any) {
      setMessage(error.message || 'Payment test failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 32 }}>Razorpay Test Environment</h1>
        <p style={{ margin: '0 0 28px', color: C.muted }}>
          Use this page to create a test order and open Razorpay Checkout in test mode.
        </p>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, display: 'grid', gap: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700 }}>Setup Status</div>
          <StatusRow label="Test key id" value={config?.hasKeyId ? 'Present' : 'Missing'} color={config?.hasKeyId ? C.success : C.error} />
          <StatusRow label="Test secret" value={config?.hasKeySecret ? 'Present' : 'Missing'} color={config?.hasKeySecret ? C.success : C.warning} />
          <StatusRow label="Order creation" value={config?.readyForOrders ? 'Ready' : 'Blocked until secret is added'} color={config?.readyForOrders ? C.success : C.warning} />
          <StatusRow label="Mode" value={config?.mode || 'Loading'} color={C.accent} />
          {config?.businessBank && (
            <StatusRow
              label="Revenue bank"
              value={`${config.businessBank.bankName} • • • • ${config.businessBank.accountNumberLast4}`}
              color={C.success}
            />
          )}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, display: 'grid', gap: 14 }}>
          <div style={{ fontWeight: 700 }}>Checkout Test</div>
          <Field label="Amount in INR">
            <input value={amountInRupees} onChange={(e) => setAmountInRupees(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </Field>

          <button
            onClick={startPayment}
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '14px 18px',
              background: C.accent,
              color: '#082f49',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Starting...' : 'Start Razorpay Test Payment'}
          </button>

          <div style={{ fontSize: 14, color: message.includes('verified') ? C.success : C.muted }}>
            {message || 'No payment attempted yet.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.08)' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: '#0f172a',
  color: C.text,
  padding: '12px 14px',
  boxSizing: 'border-box',
};
