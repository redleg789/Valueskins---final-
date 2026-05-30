'use client';

import { useRouter } from 'next/router';

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

const skinDetails: Record<string, any> = {
  '1': {
    name: 'Nebula Wrap #024',
    price: 420,
    eth: '1.2',
    rarity: 'Rare',
    category: 'VFX Texture',
    image: 'https://images.unsplash.com/photo-1614850523296-e8c0a0c8686f?q=80&w=800',
    description: 'An ethereal digital texture featuring soft, flowing gradients of lavender and periwinkle with subtle crystalline structures catching diffused light.',
    specs: ['High resolution 4K', 'Animated variants', 'Customizable colors', 'Realtime preview'],
    designer: 'Cosmic Studios',
    views: '12.4K',
    likes: '3.2K',
  },
};

export default function SkinDetail() {
  const router = useRouter();
  const { id } = router.query;
  const skin = id ? skinDetails[id as string] || skinDetails['1'] : skinDetails['1'];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.onSurface, fontFamily: 'Inter, sans-serif', paddingTop: 64 }}>
      {/* TopNav */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255, 247, 251, 0.7)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', height: 64, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>ValueSkins</div>
          <div style={{ display: 'flex', gap: 32 }}>
            <a href="/valueskins/store" style={{ fontSize: 14, color: C.primary, fontWeight: 600 }}>Store</a>
            <a href="/valueskins/my-collection" style={{ fontSize: 14, color: C.textMuted }}>Collection</a>
            <a href="/valueskins/customize" style={{ fontSize: 14, color: C.textMuted }}>Customizer</a>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
        {/* Preview */}
        <section>
          <div style={{
            aspectRatio: '1',
            borderRadius: 24,
            overflow: 'hidden',
            background: `linear-gradient(135deg, #f8e7f2 0%, #fff7fb 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            border: `1px solid rgba(240, 230, 255, 0.7)`,
          }}>
            <img src={skin.image} alt={skin.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Thumbnail gallery */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 12, background: C.surface, border: i === 0 ? `2px solid ${C.primary}` : `1px solid ${C.outlineVariant}`, cursor: 'pointer' }}>
                <img src={skin.image} alt="variant" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
              </div>
            ))}
          </div>
        </section>

        {/* Details */}
        <section>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 400, marginBottom: 8, lineHeight: '40px' }}>{skin.name}</h1>
                <p style={{ fontSize: 16, color: C.textMuted }}>by {skin.designer}</p>
              </div>
              <button style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}>♡</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <span style={{ padding: '4px 12px', background: C.primaryContainer, color: '#736670', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{skin.rarity}</span>
              <span style={{ padding: '4px 12px', background: C.surface, color: C.outline, border: `1px solid ${C.outlineVariant}`, borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{skin.category}</span>
            </div>
          </div>

          {/* Price */}
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>Price</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p style={{ fontSize: 36, fontWeight: 700, color: C.primary }}>${skin.price}</p>
              <p style={{ fontSize: 14, color: C.textMuted }}>{skin.eth} ETH</p>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: '28px' }}>{skin.description}</p>
          </div>

          {/* Specs */}
          <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 24, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: C.onSurface }}>Specifications</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {skin.specs.map((spec: string, i: number) => (
                <div key={i} style={{ fontSize: 14, color: C.textMuted }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, background: C.primary, borderRadius: '50%', marginRight: 8 }}></span>
                  {spec}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.outline, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Views</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>{skin.views}</p>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.outlineVariant}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.outline, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Favorites</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>{skin.likes}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{
              flex: 1,
              background: C.primaryContainer,
              color: '#5C565B',
              padding: '16px 24px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0e0ec')} onMouseLeave={(e) => (e.currentTarget.style.background = C.primaryContainer)}>
              Add to Cart
            </button>
            <button style={{
              flex: 1,
              background: 'transparent',
              color: C.primary,
              padding: '16px 24px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 600,
              border: `1px solid ${C.outlineVariant}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              Make Offer
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
