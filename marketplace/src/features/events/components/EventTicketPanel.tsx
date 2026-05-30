'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { EventRecord, TicketTier } from '../data/types';
import TicketView from './TicketView';

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

type OwnedTicket = {
  ticketCode: string;
  status: string;
};

function formatMoney(amountCents: number, currency: string): string {
  const normalizedCurrency = currency || 'USD';

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

function getPurchasableTiers(event: EventRecord): TicketTier[] {
  const f = event.form;
  if (f.ticketingModel === 'free') return [];

  if (f.ticketTiers.length > 0) {
    return f.ticketTiers.map((tier) => ({
      ...tier,
      quantity: tier.quantity > 0 ? tier.quantity : (f.unlimitedTickets ? 999999 : Math.max(f.maxAttendees, 1)),
      remaining:
        tier.remaining > 0
          ? tier.remaining
          : tier.quantity > 0
            ? tier.quantity
            : f.unlimitedTickets
              ? 999999
              : Math.max(f.maxAttendees, 1),
    }));
  }

  const qty = f.unlimitedTickets ? 999999 : Math.max(f.maxAttendees, 1);
  return [
    {
      id: 'general',
      name: 'General Admission',
      type: 'general',
      priceCents: 0,
      quantity: qty,
      remaining: qty,
      description: '',
      benefits: [],
      saleStartDate: '',
      saleEndDate: '',
    },
  ];
}

function tierCanPurchase(tier: TicketTier, unlimited: boolean): boolean {
  return unlimited || tier.remaining > 0;
}

export default function EventTicketPanel({
  event,
  onRegister,
}: {
  event: EventRecord;
  onRegister?: () => void;
}) {
  const { account } = useAuth();
  const f = event.form;
  const [ownedTicket, setOwnedTicket] = useState<OwnedTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [purchasingTierId, setPurchasingTierId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState('');

  const tiers = useMemo(() => getPurchasableTiers(event), [event]);
  const currencyCode = f.currency || 'USD';

  const loadOwnedTicket = useCallback(async () => {
    setLoading(true);
    setPurchaseError('');
    try {
      const res = await fetch(`/api/event-os/tickets/event/${event.id}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      const mine = (data.tickets || []).find((t: { status: string }) => t.status === 'active' || t.status === 'used');
      if (mine?.ticketCode) {
        setOwnedTicket({ ticketCode: mine.ticketCode, status: mine.status });
      } else {
        setOwnedTicket(null);
      }
    } catch {
      setOwnedTicket(null);
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    loadOwnedTicket();
  }, [loadOwnedTicket]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setCheckoutReady(true);
    script.onerror = () => {
      setCheckoutReady(false);
      setPurchaseError('Could not load Razorpay checkout');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function purchaseTier(tier: TicketTier) {
    setPurchasingTierId(tier.id);
    setPurchaseError('');
    setPurchaseSuccess('');

    try {
      if (tier.priceCents <= 0) {
        const res = await fetch('/api/event-os/tickets/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            ticketType: tier.type,
            priceCents: tier.priceCents,
            tierId: tier.id,
          }),
        });
        const ticket = await res.json();
        if (!res.ok) {
          throw new Error(ticket.error || 'Could not complete purchase');
        }
        setOwnedTicket({ ticketCode: ticket.ticketCode, status: ticket.status });
        setPurchaseSuccess('Ticket purchased. Your pass is ready below.');
        return;
      }

      if (!checkoutReady || !window.Razorpay) {
        throw new Error('Razorpay checkout is not ready yet');
      }

      const orderRes = await fetch('/api/event-os/tickets/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          tierId: tier.id,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Could not create payment order');
      }
      if (orderData.alreadyOwned && orderData.ticket?.ticketCode) {
        setOwnedTicket({ ticketCode: orderData.ticket.ticketCode, status: orderData.ticket.status });
        setPurchaseSuccess('You already own a ticket for this event.');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const razorpay = new window.Razorpay!({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'ValueSkins',
          description: `${orderData.event?.title || 'Event'} • ${orderData.ticketPricing?.tierName || tier.name}`,
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
              const confirmRes = await fetch('/api/event-os/tickets/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  eventId: event.id,
                  tierId: tier.id,
                  ...response,
                }),
              });
              const ticket = await confirmRes.json();
              if (!confirmRes.ok) {
                throw new Error(ticket.error || 'Payment completed, but ticket confirmation failed');
              }
              setOwnedTicket({ ticketCode: ticket.ticketCode, status: ticket.status });
              setPurchaseSuccess(
                `Payment verified. ${formatMoney(orderData.ticketPricing.platformFeeCents, orderData.ticketPricing.currency || currencyCode)} retained as platform revenue.`
              );
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
      setPurchaseError(e instanceof Error ? e.message : 'Could not complete purchase');
    } finally {
      setPurchasingTierId(null);
    }
  }

  if (loading) {
    return <div style={{ ...card, textAlign: 'center', color: C.textMuted }}>Loading tickets...</div>;
  }

  if (ownedTicket) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {purchaseSuccess && (
          <div style={{ ...card, padding: 14, color: C.success, fontSize: 13 }}>{purchaseSuccess}</div>
        )}
        <TicketView ticketCode={ownedTicket.ticketCode} />
      </div>
    );
  }

  if (f.ticketingModel === 'free') {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 32, display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
          This is a free event — no ticket purchase is required. Register below to attend.
        </p>
        {onRegister && (
          <button
            onClick={onRegister}
            style={{ ...btnBase, background: C.accent, color: '#082f49', fontSize: 15, padding: '14px 28px', width: '100%' }}
          >
            Register to attend
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...card, display: 'grid', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Get your ticket</h3>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          Select a tier below to complete your purchase through Razorpay.
        </p>
      </div>

      {purchaseError && (
        <p style={{ margin: 0, color: C.error, fontSize: 13 }}>{purchaseError}</p>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {tiers.map((tier) => {
          const canBuy = tierCanPurchase(tier, f.unlimitedTickets);
          const isHost = account && event.hostUserId === account.id.toString();

          return (
            <div
              key={tier.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(15,23,42,0.6)',
                border: `1px solid ${C.border}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tier.name || tier.type}</div>
                {tier.description && (
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tier.description}</div>
                )}
                {!f.unlimitedTickets && (
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    {tier.remaining} of {tier.quantity} left
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.accent }}>
                  {formatMoney(tier.priceCents, currencyCode)}
                </div>
                {tier.priceCents > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    2% platform revenue captured per sale
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!account) {
                      window.location.href = '/auth/login?redirect=/events';
                      return;
                    }
                    purchaseTier(tier);
                  }}
                  disabled={!canBuy || purchasingTierId === tier.id || Boolean(isHost)}
                  style={{
                    ...btnBase,
                    background: (canBuy && !isHost) ? C.accent : 'rgba(148,163,184,0.2)',
                    color: (canBuy && !isHost) ? '#082f49' : C.textMuted,
                    cursor: (canBuy && purchasingTierId !== tier.id && !isHost) ? 'pointer' : 'not-allowed',
                    padding: '10px 18px',
                    fontSize: 12,
                  }}
                >
                  {isHost ? 'You are the host' : purchasingTierId === tier.id ? 'Processing...' : 'Buy ticket'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
