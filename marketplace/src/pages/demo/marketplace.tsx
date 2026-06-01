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

  // After onboarding completes, role might not be in modules yet - just show marketplace directly
  return <MarketplaceDemoPage />;
}
