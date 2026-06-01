'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { C } from '@/theme/colors';

// Note: Using unified ValueSkins theme - same functionality, consistent styling

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
  }, [account, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: C.primary, marginBottom: '8px' }}>ValueSkins</div>
          <div style={{ fontSize: '14px', color: C.textSecondary }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!account) return null;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/auth/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, margin: '0' }}>
            Welcome back, {account.display_name.split(' ')[0]}!
          </h1>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
        <p style={{ color: C.textSecondary, fontSize: '16px', marginBottom: '40px' }}>
          Where would you like to go today?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>

          <DashboardCard
            title="Your ValueSkin"
            desc="View your unique ValueSkin ID"
            link="/valueskin/my-skin"
            color="#f59e0b"
          />

          <DashboardCard
            title="ValuSkins Store"
            desc="Unlock profession-based skins"
            link="/valueskins/store"
            color="#06b6d4"
          />

          <DashboardCard
            title="Marketplace"
            desc="Discover brands, creators & deals"
            link="/marketplace"
            color="#8b5cf6"
          />

          <DashboardCard
            title="Events"
            desc="Host, explore, and manage events"
            link="/events"
            color="#ec4899"
          />

          <DashboardCard
            title="Profile"
            desc="Manage your account & settings"
            link="/profile/me"
            color="#10b981"
          />

          <DashboardCard
            title="Settings"
            desc="Configure your preferences"
            link="/account/settings"
            color="#6366f1"
          />

        </div>

      </div>
    </div>
  );
}

function DashboardCard({ title, desc, link, color }: { title: string, desc: string, link: string, color: string }) {
  return (
    <Link href={link} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: '16px',
        padding: '24px',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'transform 0.15s, boxShadow 0.15s',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800, marginBottom: '16px' }}>
          {title[0]}
        </div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: C.text }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSecondary, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </Link>
  );
}
