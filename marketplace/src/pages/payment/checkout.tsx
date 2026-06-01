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
  const imageUrl = searchParams?.get('imageUrl') || '';

  useEffect(() => {
    if (!account?.id) {
      router.push('/auth/login');
    }
  }, [account?.id, router]);

  const handlePayment = async () => {
    if (!account?.id) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/skins/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          userId: account.id, 
          valueSkin: profession,
          imageUrl: imageUrl,
        }),
      });

      if (res.ok) {
        router.push('/valueskins/store?purchased=true');
      } else {
        alert('Payment failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed');
    } finally {
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

        {imageUrl && (
          <div style={{ marginBottom: '32px', padding: '16px', background: C.bg, borderRadius: '8px' }}>
            <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '8px' }}>Your ValueSkin Image</p>
            <img 
              src={imageUrl} 
              alt="ValueSkin" 
              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }}
            />
          </div>
        )}

        <div style={{ marginBottom: '32px', padding: '16px', background: C.bg, borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '8px' }}>Amount</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: C.accent, margin: 0 }}>
            Free
          </p>
          <p style={{ fontSize: '12px', color: C.textSecondary, margin: '8px 0 0 0' }}>
            ValueSkins are free to create. Click below to unlock your profession.
          </p>
        </div>

        <button
          onClick={handlePayment}
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
          {processing ? 'Processing...' : 'Unlock ValueSkin'}
        </button>

        <button
          onClick={() => router.push('/valueskins/store')}
          style={{
            width: '100%',
            padding: '12px',
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.text,
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
