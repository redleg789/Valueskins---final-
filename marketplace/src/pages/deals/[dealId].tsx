import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DealRoomChat from '@/components/DealRoomChat';
import BrandVerificationBadge from '@/components/BrandVerificationBadge';

export default function DealPage() {
  const router = useRouter();
  const { dealId } = router.query;
  const [deal, setDeal] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agreementPhase, setAgreementPhase] = useState(false);

  useEffect(() => {
    if (!dealId) return;

    fetch(`/api/deals/${dealId}`)
      .then(r => r.json())
      .then(d => {
        setDeal(d.deal);
        setMessages(d.messages || []);
        setLoading(false);
      });
  }, [dealId]);

  const handleAgree = async () => {
    if (!deal) return;

    const res = await fetch('/api/deals/agree-with-escrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, amount: deal.budget }),
    });

    if (res.ok) {
      setAgreementPhase(true);
    }
  };

  const handleComplete = async () => {
    const res = await fetch('/api/deals/complete-with-release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId }),
    });

    if (res.ok) {
      router.push(`/deals/${dealId}/review`);
    }
  };

  const handleSendMessage = (text: string) => {
    fetch(`/api/deals/${dealId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
  };

  if (loading) return <div>Loading...</div>;
  if (!deal) return <div>Deal not found</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
            {deal.title}
          </h1>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                STATUS
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {deal.status}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                PHASE
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {deal.phase}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                VALUE SKIN
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {deal.value_skin}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                BUDGET
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                ${deal.budget}
              </div>
            </div>

            {deal.brand_verified && (
              <BrandVerificationBadge status="verified" brandName={deal.brand_name} />
            )}

            <div style={{ display: 'grid', gap: '8px' }}>
              {!agreementPhase && (
                <button
                  onClick={handleAgree}
                  style={{
                    padding: '10px 16px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Agree and Create Escrow
                </button>
              )}

              {agreementPhase && !deal.completed_at && (
                <button
                  onClick={handleComplete}
                  style={{
                    padding: '10px 16px',
                    background: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Mark Complete and Release Payment
                </button>
              )}

              <a
                href={`/api/deals/export-proof?dealId=${dealId}`}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                Download Proof
              </a>
            </div>
          </div>
        </div>

        <DealRoomChat
          dealId={dealId as string}
          brandName={deal.brand_name}
          initialMessages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
