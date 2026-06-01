'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

export default function OnboardingEnhanced() {
  const router = useRouter();
  const { userId: userIdParam } = router.query;
  const [role, setRole] = useState<'creator' | 'brand' | null>(null);

  useEffect(() => {
    if (userIdParam) {
      localStorage.setItem('user_id', userIdParam as string);
    }
  }, [userIdParam]);

  const handleRoleSelect = (selectedRole: 'creator' | 'brand') => {
    setRole(selectedRole);
    setTimeout(() => {
      if (selectedRole === 'creator') {
        router.push(`/auth/onboarding-creator?userId=${userIdParam || localStorage.getItem('user_id')}`);
      } else {
        router.push(`/auth/onboarding-brand?userId=${userIdParam || localStorage.getItem('user_id')}`);
      }
    }, 300);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, marginBottom: '12px', textAlign: 'center' }}>Welcome to ValueSkins</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px', textAlign: 'center', fontSize: '16px' }}>
          What's your role?
        </p>

        <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
          {[
            { value: 'creator' as const, label: 'I\'m a Creator', desc: 'Showcase my work and find brand deals', icon: '' },
            { value: 'brand' as const, label: 'I\'m a Brand', desc: 'Find creators for my campaigns', icon: '' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => handleRoleSelect(option.value)}
              style={{
                padding: '24px',
                border: `2px solid ${role === option.value ? C.primary : C.border}`,
                background: role === option.value ? 'rgba(0,102,204,0.15)' : C.surface,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.3s',
                transform: role === option.value ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{option.icon}</div>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: '6px', fontSize: '18px' }}>{option.label}</div>
              <div style={{ fontSize: '14px', color: C.textSecondary }}>{option.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px', background: C.surface, borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: C.textSecondary }}>
          You can change your role anytime in settings
        </div>
      </div>
    </div>
  );
}
