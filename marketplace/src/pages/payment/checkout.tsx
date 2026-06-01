'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { C } from '@/theme/colors';

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuth();
  const [processing, setProcessing] = useState(false);

  const profession = searchParams?.get('profession') || '';

  useEffect(() => {
    if (!account?.id) {
      router.push('/auth/login');
    }
  }, [account?.id, router]);

  const handleCompletePayment = async () => {
    if (!account?.id || !profession) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/skins/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          userId: account.id, 
          valueSkin: profession,
        }),
      });

      if (res.ok) {
        router.push('/valueskins/store?success=true');
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
        setProcessing(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed');
      setProcessing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '500px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: C.text, marginBottom: '24px' }}>
          Checkout
        </h1>

        <div style={{ marginBottom: '32px', padding: '16px', background: C.bg, borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '8px' }}>Profession</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: C.text, margin: 0 }}>
            {profession}
          </p>
        </div>

        <div style={{ marginBottom: '32px', padding: '16px', background: C.bg, borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '8px' }}>Amount</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: C.accent, margin: 0 }}>
            Free
          </p>
          <p style={{ fontSize: '12px', color: C.textSecondary, margin: '8px 0 0 0' }}>
            ValueSkins are free to create. Click below to unlock your profession.
          </p>
        </div>

        <div style={{ marginBottom: '32px', padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600', margin: 0 }}>
            Demo Mode: Payment approved instantly
          </p>
        </div>

        <button
          onClick={handleCompletePayment}
          disabled={processing}
          style={{
            width: '100%',
            padding: '16px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: processing ? 'not-allowed' : 'pointer',
            marginBottom: '12px',
          }}
        >
          {processing ? 'Processing...' : 'Complete Purchase'}
        </button>

        <button
          onClick={() => router.push('/valueskins/store')}
          disabled={processing}
          style={{
            width: '100%',
            padding: '12px',
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.text,
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: processing ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
