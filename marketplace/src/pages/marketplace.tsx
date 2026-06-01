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

  useEffect(() => {
    if (!loading && account) {
      const isBrand = account.modules?.some(m => m.code === 'brand' && m.is_active);
      const isCreator = account.modules?.some(m => m.code === 'valueskin' && m.is_active);
      
      if (isBrand) setRole('brand');
      else if (isCreator) setRole('creator');
    }
  }, [account, loading]);

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

  const featuresGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginTop: '32px',
    padding: '32px',
    background: 'rgba(37, 99, 235, 0.05)',
    borderRadius: '12px',
    border: `1px solid ${C.border}`,
  };

  const featureItemStyle: CSSProperties = {
    fontSize: '14px',
  };

  const featureLabelStyle: CSSProperties = {
    color: C.textSecondary,
    display: 'block',
    marginBottom: '4px',
    fontSize: '12px',
    textTransform: 'uppercase',
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

          <div style={gridStyle}>
            {role === 'creator' && (
              <div
                style={cardStyle}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
              >
                <span style={badgeStyle}>NEW</span>
                <div style={cardTitleStyle}>Active Deals</div>
                <p style={cardDescStyle}>
                  Browse current brand opportunities and creator collaborations. Find your next project.
                </p>
                <button
                  onClick={() => router.push('/deals/feed')}
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
                    onClick={() => router.push('/deals/feed')}
                    style={buttonStyle}
                  >
                    View Campaigns
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: '48px', padding: '40px', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>How It Works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              {role === 'creator' ? (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>1</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Browse Deals</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Find campaigns that match your niche and values</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>2</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Apply & Negotiate</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Discuss terms and agree on deliverables</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>3</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Get Paid</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Funds held in escrow. Released after delivery.</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>1</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Create Campaign</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Define your deliverables and budget</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>2</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Find Creators</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Browse and match with creators by value skins</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>3</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Complete Deal</div>
                    <p style={{ color: C.textSecondary, fontSize: '14px' }}>Escrow holds funds. Released after approval.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
