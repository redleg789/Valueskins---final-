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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalhost(host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168'));
    setMounted(true);
  }, []);

  // On localhost, show skip button - renders immediately
  if (mounted && isLocalhost) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>ValueSkins Demo</div>
        <button onClick={() => router.push('/demo/instagram')} style={{ padding: '12px 24px', background: C.accent, border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', cursor: 'pointer', fontSize: '16px' }}>
          Skip to Demo
        </button>
        {account && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '10px' }}>Logged in as: {account.display_name}</div>}
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '20px' }}>Host: {window.location.hostname}</div>
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
