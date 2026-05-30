'use client';

import { useState } from 'react';
import Link from 'next/link';

const C = {
  bg: '#fff7fb',
  surface: '#ffffff',
  primary: '#675b64',
  primaryContainer: '#f8e7f2',
  secondary: '#625b70',
  outline: '#7d757a',
  outlineVariant: '#cec4c9',
  onSurface: '#1e1a1e',
  onSurfaceVariant: '#4b4549',
  textMuted: '#4b4549',
};

const skins = [
  { id: 1, name: 'Nebula Wrap #024', category: 'VFX Texture', rarity: 'Rare', price: 420, image: 'https://images.unsplash.com/photo-1614850523296-e8c0a0c8686f?q=80&w=800' },
  { id: 2, name: 'Matte Chrome X', category: 'Wearable', rarity: 'Epic', price: 1150, image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800' },
  { id: 3, name: 'Aurora Bloom', category: 'Environment', rarity: 'Legendary', price: 2400, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800' },
  { id: 4, name: 'Frosted Ghost Shell', category: 'Avatar Base', rarity: 'Common', price: 85, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800' },
  { id: 5, name: 'Digital Silk Scarf', category: 'Wearable', rarity: 'Rare', price: 195, image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800' },
  { id: 6, name: 'Liquid Glass FX', category: 'Texture', rarity: 'Epic', price: 680, image: 'https://images.unsplash.com/photo-1614850523296-e8c0a0c8686f?q=80&w=800' },
];

export default function ValueSkinsStore() {
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(2500);
  const [selectedRarity, setSelectedRarity] = useState<string>('');
  const [sortBy, setSortBy] = useState('popularity');

  const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

  const filteredSkins = skins.filter(skin => {
    const priceOk = skin.price >= priceMin && skin.price <= priceMax;
    const rarityOk = !selectedRarity || skin.rarity === selectedRarity;
    return priceOk && rarityOk;
  });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.onSurface, fontFamily: 'Inter, sans-serif' }}>
      {/* TopNav */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255, 247, 251, 0.7)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', height: 64, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>ValueSkins</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <a href="/valueskins/store" style={{ fontSize: 14, color: C.primary, fontWeight: 600 }}>Store</a>
            <a href="/valueskins/my-collection" style={{ fontSize: 14, color: C.textMuted }}>Collection</a>
            <a href="/valueskins/customize" style={{ fontSize: 14, color: C.textMuted }}>Customizer</a>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 80px', display: 'grid', gridTemplateColumns: '250px 1fr', gap: 32 }}>
        {/* Filters Sidebar */}
        <aside style={{ paddingTop: 64 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.onSurface }}>Filters</div>
              <button style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Reset all</button>
            </div>

            {/* Price Range */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.outline, display: 'block', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Range</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input type="number" value={priceMin} onChange={(e) => setPriceMin(parseInt(e.target.value))} style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.outlineVariant}`, borderRadius: 8, fontSize: 12 }} />
                <span style={{ color: C.outlineVariant }}>—</span>
                <input type="number" value={priceMax} onChange={(e) => setPriceMax(parseInt(e.target.value))} style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.outlineVariant}`, borderRadius: 8, fontSize: 12 }} />
              </div>
              <input type="range" min="0" max="5000" value={priceMax} onChange={(e) => setPriceMax(parseInt(e.target.value))} style={{ width: '100%', accentColor: C.primary }} />
            </div>

            {/* Rarity */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.outline, display: 'block', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rarity</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rarities.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedRarity(selectedRarity === r ? '' : r)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 500,
                      border: selectedRarity === r ? 'none' : `1px solid ${C.outlineVariant}`,
                      background: selectedRarity === r ? C.primaryContainer : 'transparent',
                      color: selectedRarity === r ? '#736670' : C.textMuted,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Results */}
        <div style={{ paddingTop: 64 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 400, marginBottom: 8 }}>Discovery</h1>
            <p style={{ fontSize: 18, color: C.textMuted }}>Exploring {filteredSkins.length} premium aesthetic skins</p>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <button style={{ padding: '8px 16px', borderBottom: '2px solid ' + C.primary, fontSize: 14, fontWeight: 500, background: 'none', border: 'none', color: C.primary, cursor: 'pointer' }}>All Items</button>
              <button style={{ padding: '8px 16px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }}>Trending</button>
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px 16px', fontSize: 14, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <option value="popularity">Popularity</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 32 }}>
            {filteredSkins.map(skin => (
              <Link key={skin.id} href={`/valueskins/${skin.id}`}>
                <div style={{ cursor: 'pointer' }}>
                  <div style={{ aspectRatio: '4/5', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: C.surface, border: `1px solid ${C.outlineVariant}` }}>
                    <img src={skin.image} alt={skin.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: C.onSurface }}>{skin.name}</h3>
                  <p style={{ fontSize: 12, color: C.outline, marginBottom: 8 }}>{skin.rarity} • {skin.category}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>${skin.price.toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
