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
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', flexDirection: 'column', gap: '20px' }}>
        <div>Loading...</div>
        {isLocalhost && (
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: C.accent, border: 'none', borderRadius: '6px', color: '#000', fontWeight: '600', cursor: 'pointer' }}>
            Skip to Demo
          </button>
        )}
      </div>
    );
  }

  if (!account) {
    if (isLocalhost) {
      return (
        <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>Not logged in</div>
          <button onClick={() => router.push('/auth/login')} style={{ padding: '10px 20px', background: C.accent, border: 'none', borderRadius: '6px', color: '#000', fontWeight: '600', cursor: 'pointer' }}>
            Go to Login
          </button>
          <button onClick={() => router.push('/demo/instagram')} style={{ padding: '10px 20px', background: 'rgba(56, 189, 248, 0.2)', border: `1px solid ${C.accent}`, borderRadius: '6px', color: C.accent, fontWeight: '600', cursor: 'pointer' }}>
            Skip to Demo (Test Mode)
          </button>
        </div>
      );
    }
    router.replace('/auth/login');
    return null;
  }

  return <MarketplaceDemoPage />;
}
