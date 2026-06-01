import React, { useState, useEffect } from 'react';

interface SkinPurchaseModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_SKINS = ['technology', 'health', 'beauty', 'fitness', 'business', 'entertainment', 'lifestyle', 'finance'];

export default function SkinPurchaseModal({ userId, onClose, onSuccess }: SkinPurchaseModalProps) {
  const [ownedSkins, setOwnedSkins] = useState<string[]>([]);
  const [selectedSkin, setSelectedSkin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/skins/manage?userId=${userId}`)
      .then(r => r.json())
      .then(d => setOwnedSkins(d.skins?.map((s: any) => s.value_skin) || []));
  }, [userId]);

  const availableSkins = AVAILABLE_SKINS.filter(s => !ownedSkins.includes(s));
  const canPurchase = ownedSkins.length < 3;

  const handlePurchase = async () => {
    if (!selectedSkin) return;
    setLoading(true);
    try {
      const res = await fetch('/api/skins/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, valueSkin: selectedSkin }),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '500px',
        width: '90%',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 700 }}>
          Purchase Value Skin
        </h2>

        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          Owned: {ownedSkins.length}/3
        </p>

        {!canPurchase && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#991b1b', borderRadius: '6px', marginBottom: '24px', fontSize: '14px' }}>
            You have reached max 3 skins. Delete one to purchase another.
          </div>
        )}

        {canPurchase && (
          <>
            <select
              value={selectedSkin}
              onChange={(e) => setSelectedSkin(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '24px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              <option value="">-- Select Skin --</option>
              {availableSkins.map(skin => (
                <option key={skin} value={skin}>{skin}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePurchase}
                disabled={!selectedSkin || loading}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: selectedSkin && !loading ? '#2563eb' : '#d1d5db',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: selectedSkin && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                }}
              >
                {loading ? 'Purchasing...' : 'Purchase'}
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'transparent',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {!canPurchase && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
