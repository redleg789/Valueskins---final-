'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = async (role: 'brand' | 'creator') => {
    setLoading(true);
    setError('');
    try {
      // Save role + complete onboarding in one call
      const res = await fetch('/api/auth/onboarding-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }

      // Hard redirect to home — AuthContext will re-fetch account with new role
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '12px' }}>Welcome to ValueSkins</div>
          <div style={{ fontSize: '16px', color: C.textSecondary }}>How do you want to use ValueSkins?</div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <button
            onClick={() => handleSelect('creator')}
            disabled={loading}
            style={{ padding: '32px 20px', border: `2px solid ${C.border}`, borderRadius: '16px', background: C.surface, cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.2s', opacity: loading ? 0.6 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎨</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>I'm a Creator</div>
            <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5 }}>Apply to brand campaigns, showcase your content, and get paid for your influence.</div>
          </button>

          <button
            onClick={() => handleSelect('brand')}
            disabled={loading}
            style={{ padding: '32px 20px', border: `2px solid ${C.border}`, borderRadius: '16px', background: C.surface, cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.2s', opacity: loading ? 0.6 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏢</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>I'm a Brand</div>
            <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5 }}>Create campaigns, find the right creators, and grow your brand through authentic content.</div>
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: C.textMuted }}>
          {loading ? 'Setting up your account...' : 'You can always contact support to change this later.'}
        </div>
      </div>
    </div>
  );
}
