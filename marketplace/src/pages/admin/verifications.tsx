import React, { useState, useEffect } from 'react';

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/verification-queue')
      .then(r => r.json())
      .then(d => {
        setVerifications(d.verifications || []);
        setLoading(false);
      });
  }, []);

  const handleVerify = async (brandId: string, action: string) => {
    await fetch('/api/admin/verify-brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, action }),
    });
    setVerifications(verifications.filter(v => v.brand_id !== brandId));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px' }}>
        Brand Verification Queue
      </h1>

      {verifications.length === 0 ? (
        <div style={{ color: '#6b7280' }}>No pending verifications</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {verifications.map(v => (
            <div
              key={v.brand_id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{v.brand_id}</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>{v.email}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Domain: {v.domain}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleVerify(v.brand_id, 'approve')}
                  style={{
                    padding: '8px 16px',
                    background: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleVerify(v.brand_id, 'reject')}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
