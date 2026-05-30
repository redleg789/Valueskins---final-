'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { C } from '@/theme/colors';

const MODULE_DETAILS: Record<string, { label: string; icon: string; desc: string; features: string[] }> = {
  explorer: {
    label: 'Explorer',
    icon: '🧭',
    desc: 'Browse events, discover people, join communities',
    features: ['Browse & attend events', 'Discover people', 'Join communities', 'Purchase tickets'],
  },
  host: {
    label: 'Host',
    icon: '🎤',
    desc: 'Create and manage events',
    features: ['Create events', 'Manage attendees', 'Configure tickets', 'View event analytics'],
  },
  valueskin: {
    label: 'ValueSkin',
    icon: '⭐',
    desc: 'Creator profile and marketplace',
    features: ['Create ValueSkin profile', 'Browse marketplace', 'Apply to brand deals', 'Connect with brands'],
  },
  brand: {
    label: 'Brand',
    icon: '🏢',
    desc: 'Discover and collaborate with creators',
    features: ['Brand profile', 'Discover creators', 'Create campaigns', 'Negotiate deals'],
  },
  community: {
    label: 'Community',
    icon: '👥',
    desc: 'Create and moderate communities',
    features: ['Create communities', 'Manage members', 'Moderate content', 'Flag for review'],
  },
};

export default function Modules() {
  const router = useRouter();
  const [modules, setModules] = useState<Array<{ code: string; is_active: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchModules = () => {
    fetch('/api/account/modules', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setModules(data.modules || []))
      .catch(() => router.push('/auth/login'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchModules(); }, [router]);

  const handleToggle = async (code: string, active: boolean) => {
    const endpoint = active ? '/api/account/modules/deactivate' : '/api/account/modules/activate';
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ module_code: code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle');
      }
      fetchModules();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
        <div style={{ color: C.textSecondary }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: '8px' }}>
          <Link href="/account/settings" style={{ color: C.textSecondary, fontSize: '13px', textDecoration: 'none' }}>← Back to settings</Link>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Modules</h1>
        <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '32px' }}>
          Enable or disable platform capabilities. Your account stays the same — no separate signups needed.
        </p>

        {error && <div style={{ padding: '10px 14px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #fecaca' }}>{error}</div>}

        {Object.entries(MODULE_DETAILS).map(([code, details]) => {
          const active = modules.find(m => m.code === code)?.is_active ?? false;
          return (
            <div key={code} style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}`, marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ fontSize: '32px', flexShrink: 0 }}>{details.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text }}>{details.label}</h3>
                  <button
                    onClick={() => handleToggle(code, active)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '20px',
                      border: active ? 'none' : `1px solid ${C.border}`,
                      background: active ? C.primary : C.bg,
                      color: active ? '#fff' : C.text,
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {active ? 'Active' : 'Activate'}
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '8px' }}>{details.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {details.features.map(f => (
                    <span key={f} style={{ fontSize: '12px', color: active ? C.primary : C.textSecondary, background: active ? '#eff6ff' : C.surface, padding: '2px 8px', borderRadius: '4px' }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
