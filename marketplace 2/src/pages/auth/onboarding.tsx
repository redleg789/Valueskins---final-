'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

interface Preference {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const PREFERENCES: Preference[] = [
  { id: 'attend_events', label: 'Attend events', description: 'Browse and buy tickets to events near you', icon: '🎟️' },
  { id: 'host_events', label: 'Host events', description: 'Create and manage your own events', icon: '🎤' },
  { id: 'discover_people', label: 'Discover people', description: 'Network and connect with the community', icon: '🤝' },
  { id: 'build_valueskin', label: 'Build ValueSkin', description: 'Create a creator profile for brand deals', icon: '⭐' },
  { id: 'find_creators', label: 'Find creators', description: 'Discover creators for brand collaborations', icon: '🔍' },
  { id: 'explore', label: 'Explore', description: 'See what ValueSkins has to offer', icon: '🧭' },
];

export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if already completed
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.onboarding_stage === 'complete') {
          router.replace('/');
        }
      })
      .catch(() => {});
  }, [router]);

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch('/api/account/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save preferences');
      }

      router.push('/');
    } catch (err: any) {
      console.error(err);
      // Continue anyway
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>What brings you here?</div>
          <p style={{ fontSize: '15px', color: C.textSecondary }}>
            Pick what sounds interesting. You can change this later.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          {PREFERENCES.map(pref => {
            const isSelected = selected.includes(pref.id);
            return (
              <button
                key={pref.id}
                onClick={() => toggle(pref.id)}
                style={{
                  padding: '20px',
                  border: `2px solid ${isSelected ? C.primary : C.border}`,
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(103, 91, 100, 0.1)' : C.bg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{pref.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '4px' }}>{pref.label}</div>
                <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.4 }}>{pref.description}</div>
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px' }}>
            Selected {selected.length} of {PREFERENCES.length}. You can always change these later in settings.
          </p>
          <button
            onClick={handleContinue}
            disabled={loading || selected.length === 0}
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: '14px',
              background: selected.length === 0 ? C.border : C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
