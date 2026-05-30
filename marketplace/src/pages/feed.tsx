'use client';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { C } from '@/theme/colors';

// Note: Using unified ValueSkins theme - same functionality, consistent styling

export default function FeedPage() {
  const router = useRouter();

  const containerStyle = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '40px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const cardContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    maxWidth: '1200px',
    width: '100%',
  };

  const cardStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '32px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    textAlign: 'center' as const,
  };

  const titleStyle = {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '12px',
  };

  const descStyle = {
    fontSize: '14px',
    color: C.textSecondary,
    marginBottom: '24px',
    lineHeight: '1.6',
  };

  const buttonStyle = {
    padding: '12px 24px',
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  };

  return (
    <>
      <Head>
        <title>Feed - ValueSkins</title>
      </Head>

      <div style={containerStyle}>
        <div style={cardContainerStyle}>
          <div style={cardStyle}>
            <div style={titleStyle}>Deals Feed</div>
            <p style={descStyle}>
              Discover and manage brand-creator deals with built-in messaging and collaboration tools.
            </p>
            <button
              onClick={() => router.push('/deals/feed')}
              style={buttonStyle}
            >
              View Deals
            </button>
          </div>

          <div style={cardStyle}>
            <div style={titleStyle}>Creator Rankings</div>
            <p style={descStyle}>
              View top-rated creators ranked by reviews and deal completion. See who's leading the platform.
            </p>
            <button
              onClick={() => router.push('/deals/rankings')}
              style={buttonStyle}
            >
              View Rankings
            </button>
          </div>

          <div style={cardStyle}>
            <div style={titleStyle}>Deal Negotiation</div>
            <p style={descStyle}>
              Create deals, negotiate with creators, and collaborate with built-in messaging and workflow management.
            </p>
            <button
              onClick={() => router.push('/demo/marketplace')}
              style={buttonStyle}
            >
              Access Deals
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
