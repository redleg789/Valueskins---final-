'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { CSSProperties } from 'react';
import { C } from '@/theme/colors';

// Note: Using unified ValueSkins theme - same functionality, consistent styling

export default function MarketplacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

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

  const secondaryButtonStyle: CSSProperties = {
    padding: '12px 24px',
    background: 'transparent',
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
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
            Verifying your ValueSkin...
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
          {/* Header */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>ValueSkins Marketplace</h1>
            <p style={subtitleStyle}>
              Connect with creators and brands. Complete deals. Build reputation.
            </p>
          </div>

          {/* Main Features Grid */}
          <div style={gridStyle}>
            {/* Deals Feed Card */}
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

            {/* Creator Rankings Card */}
            <div
              style={cardStyle}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
            >
              <span style={badgeStyle}>FEATURED</span>
              <div style={cardTitleStyle}>Top Creators</div>
              <p style={cardDescStyle}>
                See creators ranked by completed deals and customer reviews. Build trust through transparency.
              </p>
              <button
                onClick={() => router.push('/deals/rankings')}
                style={buttonStyle}
              >
                View Rankings
              </button>
            </div>

          </div>

          {/* Key Features Section */}
          <div style={{ marginTop: '48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px', textAlign: 'center' }}>
               What's Included
            </h2>

            <div style={featuresGridStyle}>
              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>Review System</span>
                <span>Leave & view reviews after completed deals</span>
              </div>

              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>3-D Ratings</span>
                <span>Rate quality, communication, professionalism</span>
              </div>

              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>Smart Ranking</span>
                <span>Creators ranked by deals + quality</span>
              </div>

              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>Comments</span>
                <span>Add optional feedback on each review</span>
              </div>

              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>Reputation</span>
                <span>Build your creator score with every deal</span>
              </div>

              <div style={featureItemStyle}>
                <span style={featureLabelStyle}>Geo Search</span>
                <span>Find creators by location with Haversine distance</span>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div style={{ marginTop: '48px', padding: '40px', background: 'rgba(37, 99, 235, 0.08)', borderRadius: '12px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', textAlign: 'center' }}>
              How It Works
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>1</div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>Find a Deal</div>
                <p style={{ color: C.textSecondary, fontSize: '14px' }}>
                  Browse active opportunities in deals feed or search by location
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>2</div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>Complete Work</div>
                <p style={{ color: C.textSecondary, fontSize: '14px' }}>
                  Collaborate with brands and complete your deliverables
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>3</div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>Get Reviewed</div>
                <p style={{ color: C.textSecondary, fontSize: '14px' }}>
                  Both parties leave reviews with 1-5 ratings
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>4</div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>Build Reputation</div>
                <p style={{ color: C.textSecondary, fontSize: '14px' }}>
                  Climb rankings and get more opportunities
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div style={{ marginTop: '48px', padding: '40px', textAlign: 'center', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
              Ready to Get Started?
            </h2>
            <p style={{ color: C.textSecondary, marginBottom: '24px', fontSize: '16px' }}>
              Start by viewing the creator leaderboard or browsing active deals.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/deals/rankings')}
                style={buttonStyle}
              >
                View Top Creators
              </button>
              <button
                onClick={() => router.push('/deals/feed')}
                style={secondaryButtonStyle}
              >
                Browse Deals
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
