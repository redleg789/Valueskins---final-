'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import MarketplaceDemoPage from '@/features/marketplace/demo/MarketplaceDemoPage';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  border: '#334155',
};

export default function DemoWrapper() {
  const router = useRouter();
  const { account, loading } = useAuth();
  const [view, setView] = useState<'role-selector' | 'marketplace'>('role-selector');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        Loading...
      </div>
    );
  }

  if (!account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ maxWidth: '500px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '16px' }}>Sign in required</h1>
          <p style={{ color: C.textMuted, marginBottom: '24px' }}>Please sign in to access the marketplace.</p>
          <button
            onClick={() => router.push('/auth/login')}
            style={{ padding: '12px 24px', background: C.accent, color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const isBrand = account.modules?.some(m => m.code === 'brand' && m.is_active);
  const isCreator = account.modules?.some(m => m.code === 'valueskin' && m.is_active);

  if (!isBrand && !isCreator) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ maxWidth: '500px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '16px' }}>Role Not Selected</h1>
          <p style={{ color: C.textMuted, marginBottom: '24px' }}>Please complete your onboarding to select a role.</p>
          <button
            onClick={() => router.push('/auth/onboarding-enhanced')}
            style={{ padding: '12px 24px', background: C.accent, color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Complete Onboarding
          </button>
        </div>
      </div>
    );
  }

  if (view === 'marketplace') {
    return <MarketplaceDemoPage />;
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.bg} 0%, #111827 100%)`, padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{ color: C.accent, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginBottom: '32px' }}
        >
          ← Back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {isBrand && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>Create Campaign</h2>
              <p style={{ color: C.textMuted, marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                Launch a brand campaign and collaborate with creators to build your presence.
              </p>
              <button
                onClick={() => setView('marketplace')}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: C.accent,
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Start a New Campaign
              </button>
            </div>
          )}

          {isCreator && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>Browse Campaigns</h2>
              <p style={{ color: C.textMuted, marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                Explore brand campaigns in real-time and apply to opportunities that match your niche.
              </p>
              <button
                onClick={() => setView('marketplace')}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: C.accent,
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                View All Campaigns
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
