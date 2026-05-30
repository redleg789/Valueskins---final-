'use client';

import { useState } from 'react';
import Link from 'next/link';

const C = {
  bg: '#fff7fb',
  surface: '#ffffff',
  primary: '#675b64',
  primaryContainer: '#f8e7f2',
  outline: '#7d757a',
  outlineVariant: '#cec4c9',
  onSurface: '#1e1a1e',
  textMuted: '#4b4549',
};

const ownedSkins = [
  { id: 1, name: 'Nebula Wrap #024', rarity: 'Rare', equipped: true, image: 'https://images.unsplash.com/photo-1614850523296-e8c0a0c8686f?q=80&w=800' },
  { id: 4, name: 'Frosted Ghost Shell', rarity: 'Common', equipped: false, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800' },
  { id: 5, name: 'Digital Silk Scarf', rarity: 'Rare', equipped: false, image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800' },
  { id: 6, name: 'Liquid Glass FX', rarity: 'Epic', equipped: false, image: 'https://images.unsplash.com/photo-1614850523296-e8c0a0c8686f?q=80&w=800' },
];

export default function MyCollection() {
  const [filter, setFilter] = useState('all');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.onSurface, fontFamily: 'Inter, sans-serif', paddingTop: 64 }}>
      {/* TopNav */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255, 247, 251, 0.7)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', height: 64, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>ValueSkins</div>
          <div style={{ display: 'flex', gap: 32 }}>
            <a href="/valueskins/store" style={{ fontSize: 14, color: C.textMuted }}>Store</a>
            <a href="/valueskins/my-collection" style={{ fontSize: 14, color: C.primary, fontWeight: 600, borderBottom: '2px solid ' + C.primary }}>Collection</a>
            <a href="/valueskins/customize" style={{ fontSize: 14, color: C.textMuted }}>Customizer</a>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 48, fontWeight: 300, marginBottom: 8, lineHeight: '56px' }}>My Collection</h1>
          <p style={{ fontSize: 18, color: C.textMuted }}>You own {ownedSkins.length} premium aesthetic skins</p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 48 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 32 }}>
            <p style={{ fontSize: 12, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 600 }}>Total Value</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: C.primary }}>$4,650</p>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 32 }}>
            <p style={{ fontSize: 12, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 600 }}>Equipped</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: C.primary }}>1</p>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 32 }}>
            <p style={{ fontSize: 12, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 600 }}>For Trade</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: C.primary }}>2</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {['all', 'rare', 'epic', 'legendary'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                border: filter === f ? 'none' : `1px solid ${C.outlineVariant}`,
                background: filter === f ? C.primaryContainer : 'transparent',
                color: filter === f ? '#736670' : C.textMuted,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
          {ownedSkins.map(skin => (
            <div key={skin.id} style={{ position: 'relative', cursor: 'pointer' }}>
              <div style={{
                aspectRatio: '4/5',
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 16,
                background: C.surface,
                border: skin.equipped ? `3px solid ${C.primary}` : `1px solid ${C.outlineVariant}`,
                position: 'relative',
              }}>
                <img src={skin.image} alt={skin.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {skin.equipped && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: C.primary,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    Equipped
                  </div>
                )}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{skin.name}</h3>
              <p style={{ fontSize: 12, color: C.outline, marginBottom: 12 }}>Tier: {skin.rarity}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!skin.equipped && (
                  <button style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: C.primaryContainer,
                    color: '#736670',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0e0ec')} onMouseLeave={(e) => (e.currentTarget.style.background = C.primaryContainer)}>
                    Equip
                  </button>
                )}
                <button style={{
                  flex: !skin.equipped ? 1 : 'auto',
                  padding: '8px 12px',
                  background: 'transparent',
                  color: C.primary,
                  border: `1px solid ${C.outlineVariant}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Trade
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
