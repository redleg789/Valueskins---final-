'use client';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import MarketplaceDemoPage from '@/features/marketplace/demo/MarketplaceDemoPage';

const C = {
  bg: '#0f172a',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
};

export default function DemoWrapper() {
  const router = useRouter();
  const { account, loading } = useAuth();
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalhost(host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168'));
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        Loading...
      </div>
    );
  }

  // On localhost: show skip button if not logged in, else go straight to marketplace
  if (isLocalhost && !account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600' }}>ValueSkins</div>
        <button
          onClick={() => router.push('/auth/login')}
          style={{ padding: '12px 24px', background: C.accent, border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', cursor: 'pointer', fontSize: '16px' }}
        >
          Login
        </button>
        <div style={{ fontSize: '11px', color: C.textMuted }}>localhost dev mode</div>
      </div>
    );
  }

  if (!account) {
    router.replace('/auth/login');
    return null;
  }

  return <MarketplaceDemoPage />;
}
