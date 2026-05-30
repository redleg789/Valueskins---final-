'use client';
import { useAuth } from '@/context/AuthContext';
import CreatorProfile from '@/features/profiles/CreatorProfile';

export default function ProfileMePage() {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  if (!account) return null;

  const isBrand = account.modules?.some(m => m.code === 'brand' && m.is_active);
  const isCreator = account.modules?.some(m => m.code === 'valueskin' && m.is_active);

  if (isCreator) {
    return <CreatorProfile />;
  }

  if (isBrand) {
    return <div>Brand Profile Coming Soon</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Complete Onboarding</h1>
        <p>Please complete your onboarding to set up your profile.</p>
      </div>
    </div>
  );
}
