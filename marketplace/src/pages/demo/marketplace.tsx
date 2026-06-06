'use client';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
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
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost');
  }, []);

  // On localhost, show skip button
  if (isLocalhost) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', flexDirection: 'column', gap: '20px' }}>
        <button onClick={() => router.push('/demo/instagram')} style={{ padding: '12px 24px', background: C.accent, border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', cursor: 'pointer', fontSize: '16px' }}>
          Skip to Demo
        </button>
        {account && <div style={{ fontSize: '12px', color: C.textMuted }}>Logged in as: {account.display_name}</div>}
      </div>
    );
  }

  // On production, normal flow
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        Loading...
      </div>
    );
  }

  if (!account) {
    router.replace('/auth/login');
    return null;
  }

  return <MarketplaceDemoPage />;
}
