'use client';
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
