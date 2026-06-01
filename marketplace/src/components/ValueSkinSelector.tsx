import React, { useState, useEffect } from 'react';

interface ValueSkinSelectorProps {
  userId: string;
  onSelect: (skin: string) => void;
  selectedSkin?: string;
}

export default function ValueSkinSelector({ userId, onSelect, selectedSkin }: ValueSkinSelectorProps) {
  const [skins, setSkins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skins/manage?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        setSkins(d.skins?.map((s: any) => s.value_skin) || []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Loading skins...</div>;
  if (skins.length === 0) return <div style={{ color: '#ef4444' }}>No value skins purchased</div>;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
        Select Value Skin for This Deal
      </label>
      <select
        value={selectedSkin || ''}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      >
        <option value="">-- Select Skin --</option>
        {skins.map(skin => (
          <option key={skin} value={skin}>{skin}</option>
        ))}
      </select>
      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        You own {skins.length}/3 skins. Only 1 skin can be used per deal.
      </p>
    </div>
  );
}
