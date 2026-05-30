'use client';
import { useState, CSSProperties } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = {
  primary: '#2563EB',
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  border: '#334155',
  error: '#ef4444',
  success: '#22c55e',
};

export default function DealsFeedPage() {
  const router = useRouter();

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '32px 20px',
  };

  const innerContainerStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: '700',
  };

  const rankingButtonStyle: CSSProperties = {
    padding: '10px 24px',
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  };

  const cardStyle: CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const titleCardStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '12px',
  };

  const descriptionStyle: CSSProperties = {
    fontSize: '14px',
    color: C.textSecondary,
    marginBottom: '16px',
  };

  const badgeStyle = (status: string): CSSProperties => {
    const colors: Record<string, [string, string]> = {
      active: ['#dbeafe', '#0284c7'],
      completed: ['#dcfce7', '#16a34a'],
      pending: ['#fef3c7', '#d97706'],
    };
    const [bg, text] = colors[status] || colors.pending;
    return {
      display: 'inline-block',
      padding: '4px 8px',
      background: bg,
      color: text,
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
    };
  };

  const placeholderStyle: CSSProperties = {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    color: C.textSecondary,
  };

  return (
    <>
      <Head>
        <title>Deals Feed - ValueSkins</title>
      </Head>

      <div style={containerStyle}>
        <div style={innerContainerStyle}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>💼 Deals Feed</h1>
            <button
              onClick={() => router.push('/deals/rankings')}
              style={rankingButtonStyle}
            >
              🏆 View Rankings
            </button>
          </div>

          <div style={gridStyle}>
            <div style={placeholderStyle}>
              <p style={{ margin: 0 }}>Deals will appear here once they are created and matched.</p>
              <p style={{ margin: '12px 0 0 0', fontSize: '12px' }}>
                Check back soon for active opportunities!
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
