'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
    };
  }
}

const C = {
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  error: '#fca5a5',
  success: '#86efac',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '12px 24px',
  fontSize: 13,
};

function formatMoney(amountCents: number, currency: string): string {
  const normalizedCurrency = currency || 'INR';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${normalizedCurrency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export interface BrandRegistrationPaymentProps {
  registrationFeeCents: number;
  currency?: string;
  title?: string;
  description?: string;
  onPaymentSuccess?: () => void;
}

export default function BrandRegistrationPayment({
  registrationFeeCents,
  currency = 'INR',
  title = 'Brand Registration',
  description = 'Complete your brand registration to access premium features.',
  onPaymentSuccess,
}: BrandRegistrationPaymentProps) {
  const { account } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{
    registered: boolean;
    status?: string;
    activatedAt?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const checkRegistrationStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/brand/register/status');
      if (!res.ok) throw new Error('Failed to check registration status');
      const data = await res.json();
      setRegistrationStatus(data);
    } catch {
      setRegistrationStatus({ registered: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkRegistrationStatus();
  }, [checkRegistrationStatus]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setCheckoutReady(true);
    script.onerror = () => {
      setCheckoutReady(false);
      setPaymentError('Could not load Razorpay checkout');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function handleRegistration() {
    setIsProcessing(true);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      if (!checkoutReady || !window.Razorpay) {
        throw new Error('Razorpay checkout is not ready yet');
      }

      // Step 1: Create order
      const orderRes = await fetch('/api/brand/register/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationFeeCents,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Could not create payment order');
      }

      // Step 2: Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const razorpay = new window.Razorpay!({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'ValueSkins',
          description: `${title} - ${formatMoney(registrationFeeCents, currency)}`,
          order_id: orderData.order.id,
          prefill: {
            name: account?.display_name || 'ValueSkins User',
            email: account?.email || '',
            contact: account?.phone || '',
          },
          notes: orderData.order.notes,
          theme: { color: C.accent },
          handler: async (response: Record<string, string>) => {
            try {
              // Step 3: Confirm payment
              const confirmRes = await fetch('/api/brand/register/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...response,
                }),
              });

              const result = await confirmRes.json();
              if (!confirmRes.ok) {
                throw new Error(result.error || 'Payment completed, but registration confirmation failed');
              }

              setPaymentSuccess(
                `Payment verified! Your brand registration is being activated. Welcome to ValueSkins! 🎉`
              );
              await checkRegistrationStatus();
              onPaymentSuccess?.();
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Checkout closed before payment completed')),
          },
        });

        razorpay.open();
      });
    } catch (e: unknown) {
      setPaymentError(e instanceof Error ? e.message : 'Could not complete registration');
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return <div style={{ ...card, textAlign: 'center', color: C.textMuted }}>Loading registration status...</div>;
  }

  if (registrationStatus?.registered) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 32, display: 'grid', gap: 16 }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.success }}>
            Brand Registration Active
          </h2>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
            Your brand account is fully registered and active. You can now access all premium features.
          </p>
        </div>
        {registrationStatus.activatedAt && (
          <p style={{ margin: 0, color: C.textMuted, fontSize: 12 }}>
            Activated: {new Date(registrationStatus.activatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...card, display: 'grid', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>{description}</p>
      </div>

      {paymentError && <p style={{ margin: 0, color: C.error, fontSize: 13 }}>{paymentError}</p>}

      {paymentSuccess && (
        <div style={{ margin: 0, color: C.success, fontSize: 13, padding: 12, background: 'rgba(134, 239, 172, 0.1)', borderRadius: 12 }}>
          {paymentSuccess}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gap: 12,
          padding: '16px',
          borderRadius: 16,
          background: 'rgba(15,23,42,0.6)',
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>One-Time Registration Fee</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Activate your brand account and unlock premium features
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.accent }}>
              {formatMoney(registrationFeeCents, currency)}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              2% platform fee applies
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          if (!account) {
            window.location.href = '/auth/login?redirect=/account/settings';
            return;
          }
          handleRegistration();
        }}
        disabled={isProcessing || !checkoutReady}
        style={{
          ...btnBase,
          background: !isProcessing && checkoutReady ? C.accent : 'rgba(148,163,184,0.2)',
          color: !isProcessing && checkoutReady ? '#082f49' : C.textMuted,
          cursor: !isProcessing && checkoutReady ? 'pointer' : 'not-allowed',
          padding: '14px 28px',
          width: '100%',
          fontSize: 15,
        }}
      >
        {!account
          ? 'Login to Register'
          : isProcessing
            ? 'Processing...'
            : `Complete Registration - ${formatMoney(registrationFeeCents, currency)}`}
      </button>

      <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
        ℹ️ Your payment is securely processed by Razorpay. We'll activate your account immediately after verification.
      </div>
    </div>
  );
}
