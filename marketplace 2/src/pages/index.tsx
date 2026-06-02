'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { account, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!account) {
      router.replace('/auth/login');
      return;
    }

    if (account.onboarding_stage !== 'complete') {
      router.replace('/auth/onboarding');
      return;
    }

    // Route to the right experience based on active modules
    const modules = account.modules?.filter(m => m.is_active).map(m => m.code) || [];

    if (modules.includes('valueskin')) {
      router.replace('/marketplace');
    } else if (modules.includes('brand')) {
      router.replace('/explore');
    } else {
      router.replace('/explore');
    }
  }, [account, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#2563EB', marginBottom: '8px' }}>ValueSkins</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return null;
}
