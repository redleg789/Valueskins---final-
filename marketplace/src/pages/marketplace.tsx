'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { CSSProperties } from 'react';
import { C } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';

export default function MarketplacePage() {
  const router = useRouter();
  const { account, loading } = useAuth();
  const [role, setRole] = useState<'creator' | 'brand' | null>(null);
  const [hasValueskin, setHasValueskin] = useState(false);
  const [view, setView] = useState<'main' | 'deals'>('main');

  useEffect(() => {
    if (!loading && account) {
      const isBrand = account.modules?.some(m => m.code === 'brand' && m.is_active);
      const isCreator = account.modules?.some(m => m.code === 'valueskin' && m.is_active);
      
      if (isBrand) setRole('brand');
      else if (isCreator) setRole('creator');

      // Check if user has at least one valueskin
      checkValueskins();
    }
  }, [account, loading]);

  const checkValueskins = async () => {
    try {
      const res = await fetch('/api/valueskins/list');
      if (res.ok) {
        const data = await res.json();
        setHasValueskin(Array.isArray(data) && data.length > 0);
      }
    } catch (err) {
      console.error('Failed to check valueskins:', err);
    }
  };

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '40px 20px',
  };

  const innerStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    marginBottom: '48px',
    textAlign: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: '48px',
    fontWeight: '800',
    marginBottom: '12px',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: '20px',
    color: C.textSecondary,
    marginBottom: '32px',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginBottom: '48px',
  };

  const cardStyle: CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'all 0.3s',
  };

  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    borderColor: C.primary,
    transform: 'translateY(-4px)',
  };

  const cardTitleStyle: CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '12px',
  };

  const cardDescStyle: CSSProperties = {
    fontSize: '14px',
    color: C.textSecondary,
    marginBottom: '20px',
    lineHeight: '1.6',
  };

  const buttonStyle: CSSProperties = {
    padding: '12px 24px',
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    background: 'rgba(245, 158, 11, 0.1)',
    color: C.accent,
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '16px',
  };

  const warningStyle: CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  };

  const warningBoxStyle: CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '48px 32px',
    textAlign: 'center',
    maxWidth: '500px',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          <div style={{ textAlign: 'center', paddingTop: '60px', color: C.textSecondary }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!hasValueskin) {
    return (
      <div style={containerStyle}>
        <div style={warningStyle}>
          <div style={warningBoxStyle}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '16px' }}>
              ValuSkin Required
            </h1>
            <p style={{ color: C.textSecondary, marginBottom: '24px', fontSize: '16px' }}>
              You must have at least one valueskin to enter the marketplace.
            </p>
            <button
              onClick={() => router.push('/valueskins/store')}
              style={buttonStyle}
            >
              Go to ValuSkins Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Marketplace - ValueSkins</title>
      </Head>

      <div style={containerStyle}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>ValueSkins Marketplace</h1>
            <p style={subtitleStyle}>
              {role === 'brand' ? 'Launch campaigns and find creators' : 'Browse opportunities and collaborate with brands'}
            </p>
          </div>

          {view === 'main' && (
            <div style={gridStyle}>
              {role === 'creator' && (
                <div
                  style={cardStyle}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
                >
                  <span style={badgeStyle}>BROWSE</span>
                  <div style={cardTitleStyle}>Active Deals</div>
                  <p style={cardDescStyle}>
                    Browse current brand opportunities and creator collaborations. Find your next project.
                  </p>
                  <button
                    onClick={() => setView('deals')}
                    style={buttonStyle}
                  >
                    View Deals
                  </button>
                </div>
              )}

              {role === 'brand' && (
                <>
                  <div
                    style={cardStyle}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
                  >
                    <span style={badgeStyle}>CREATE</span>
                    <div style={cardTitleStyle}>Create Campaign</div>
                    <p style={cardDescStyle}>
                      Launch a new campaign and connect with creators who match your brand values.
                    </p>
                    <button
                      onClick={() => router.push('/deals/create')}
                      style={buttonStyle}
                    >
                      Create Campaign
                    </button>
                  </div>

                  <div
                    style={cardStyle}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
                  >
                    <span style={badgeStyle}>MANAGE</span>
                    <div style={cardTitleStyle}>Your Campaigns</div>
                    <p style={cardDescStyle}>
                      View and manage your existing campaigns. Track applications and progress.
                    </p>
                    <button
                      onClick={() => setView('deals')}
                      style={buttonStyle}
                    >
                      View Campaigns
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {view === 'deals' && (
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setView('main')}
                style={{
                  padding: '10px 16px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.text,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  marginBottom: '24px',
                }}
              >
                Back
              </button>
              <div style={{ background: C.surface, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                  {role === 'creator' ? 'Active Deals' : 'Your Campaigns'}
                </h2>
                <p style={{ color: C.textSecondary }}>
                  {role === 'creator'
                    ? 'Browse and apply to brand campaigns that match your valueskins.'
                    : 'Manage your active campaigns and track creator applications.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
