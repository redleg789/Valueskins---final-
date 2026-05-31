'use client';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

export default function Store() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '32px' }}>ValueSkins Store</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎭</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Creator ValueSkin</h2>
            <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>Complete your creator profile and join the marketplace</p>
            <button onClick={() => router.push('/auth/onboarding-creator')} style={{
              padding: '10px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}>
              Get Started
            </button>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏢</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Brand Account</h2>
            <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>Create campaigns and connect with creators</p>
            <button onClick={() => router.push('/auth/onboarding-brand')} style={{
              padding: '10px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}>
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
