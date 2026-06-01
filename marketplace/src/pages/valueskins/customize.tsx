'use client';

import { useState } from 'react';

const C = {
  bg: '#fff7fb',
  surface: '#ffffff',
  primary: '#675b64',
  primaryContainer: '#f8e7f2',
  outline: '#7d757a',
  outlineVariant: '#cec4c9',
  onSurface: '#1e1a1e',
  textMuted: '#4b4549',
  success: '#86efac',
};

const colorVariants = [
  { name: 'lavender', hex: '#e8def7' },
  { name: 'rose', hex: '#f8e7f2' },
  { name: 'dawn', hex: '#fff7fb' },
  { name: 'void', hex: '#342f33' },
];

export default function ValueSkinsCustomizer() {
  const [selectedColor, setSelectedColor] = useState('rose');
  const [saturation, setSaturation] = useState(80);
  const [previewImage, setPreviewImage] = useState('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800');

  const changeSkin = (variant: string) => {
    setSelectedColor(variant);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.onSurface, fontFamily: 'Inter, sans-serif', paddingTop: 64 }}>
      {/* TopNav */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255, 247, 251, 0.7)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', height: 64, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>ValueSkins</div>
          <div style={{ display: 'flex', gap: 32 }}>
            <a href="/valueskins/store" style={{ fontSize: 14, color: C.textMuted }}>Store</a>
            <a href="/valueskins/my-collection" style={{ fontSize: 14, color: C.textMuted }}>Collection</a>
            <a href="/valueskins/customize" style={{ fontSize: 14, color: C.primary, fontWeight: 600, borderBottom: '2px solid ' + C.primary }}>Customizer</a>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px', display: 'grid', gridTemplateColumns: '1fr 350px', gap: 32, alignItems: 'start' }}>
        {/* Preview Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{
            aspectRatio: '4/5',
            borderRadius: 24,
            overflow: 'hidden',
            background: `linear-gradient(135deg, #f8e7f2 0%, #fff7fb 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 32px 64px -16px rgba(216, 197, 225, 0.2)',
            border: `1px solid rgba(240, 230, 255, 0.7)`,
          }}>
            <img
              src={previewImage}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: `saturate(${saturation / 100 + 0.5})`,
                transition: 'all 0.3s ease',
              }}
            />
            <div style={{ position: 'absolute', bottom: 24, left: 24, display: 'flex', gap: 16 }}>
              <button style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255, 251, 254, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid #F0E6FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                
              </button>
              <button style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255, 251, 254, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid #F0E6FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                360°
              </button>
            </div>
            <div style={{ position: 'absolute', top: 24, right: 24, padding: '8px 16px', background: 'rgba(255, 251, 254, 0.7)', backdropFilter: 'blur(12px)', borderRadius: 999, fontSize: 12, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rare Edition
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 400, marginBottom: 8, lineHeight: '40px' }}>Etheric Bloom v.2</h1>
              <p style={{ fontSize: 16, color: C.textMuted }}>Premium skin collection • Designer Series</p>
            </div>
            <span style={{ background: C.primaryContainer, color: '#736670', padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 500 }}>Level 42</span>
          </div>
        </section>

        {/* Controls */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Color Variants */}
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 24 }}>Color Variants</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {colorVariants.map(variant => (
                <button
                  key={variant.name}
                  onClick={() => changeSkin(variant.name)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 16,
                    background: variant.hex,
                    border: selectedColor === variant.name ? `3px solid ${C.primary}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: 'scale(1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>

            {/* Saturation Control */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>
                <span>Saturation</span>
                <span>{saturation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={saturation}
                onChange={(e) => setSaturation(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: C.primary }}
              />
            </div>
          </div>

          {/* Customization Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <button style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.onSurface }}>Texture Finish</span>
            </button>
            <button style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8def7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.onSurface }}>Glow Effects</span>
            </button>
          </div>

          {/* Status */}
          <div style={{ background: 'rgba(248, 231, 242, 0.3)', border: `1px solid ${C.primaryContainer}`, borderRadius: 24, padding: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 20 }}>ℹ</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.onSurface }}>Changes Pending</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>You have selected 'Rose Quartz' with high saturation. Preview is active.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button style={{ width: '100%', background: C.primaryContainer, color: '#5C565B', padding: '16px', borderRadius: 16, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0e0ec')} onMouseLeave={(e) => (e.currentTarget.style.background = C.primaryContainer)}>
              Apply Changes
            </button>
            <button style={{ width: '100%', background: 'transparent', color: C.primary, padding: '16px', borderRadius: 16, fontSize: 14, fontWeight: 600, border: `1px solid ${C.outlineVariant}`, cursor: 'pointer', transition: 'all 0.2s' }}>
              Revert to Default
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
