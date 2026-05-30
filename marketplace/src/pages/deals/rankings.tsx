'use client';
import { useState, useEffect, CSSProperties } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const C = {
  primary: '#2563EB',
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  border: '#334155',
  error: '#ef4444',
  success: '#22c55e',
  accent: '#f59e0b',
};

interface CreatorRanking {
  rank: number;
  creatorId: number;
  name: string;
  avatar?: string;
  username: string;
  reviewCount: number;
  dealsCompleted: number;
  ratings: {
    overall: number;
    quality: number;
    communication: number;
    professionalism: number;
  };
  rankScore: number;
}

export default function CreatorRankings() {
  const router = useRouter();
  const [rankings, setRankings] = useState<CreatorRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchRankings();
  }, [limit, offset]);

  const fetchRankings = async () => {
    try {
      const res = await fetch(`/api/deals/rankings/creators?limit=${limit}&offset=${offset}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch rankings');
      const data = await res.json();
      setRankings(data.rankings || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return C.accent;
    if (rank === 2) return '#a78bfa';
    if (rank === 3) return '#f97316';
    return C.textSecondary;
  };

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '32px 20px',
  };

  const innerContainerStyle: CSSProperties = {
    maxWidth: '1000px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    marginBottom: '32px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  };

  const descriptionStyle: CSSProperties = {
    fontSize: '16px',
    color: C.textSecondary,
  };

  const tableContainerStyle: CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    overflow: 'hidden',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: CSSProperties = {
    padding: '16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: C.textSecondary,
    borderBottom: `1px solid ${C.border}`,
    textTransform: 'uppercase',
    backgroundColor: C.bg,
  };

  const tdStyle: CSSProperties = {
    padding: '16px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: '14px',
  };

  const rankCellStyle = (rank: number): CSSProperties => ({
    ...tdStyle,
    fontWeight: '700',
    color: getRankColor(rank),
    fontSize: '18px',
  });

  const creatorCellStyle: CSSProperties = {
    ...tdStyle,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  };

  const avatarStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: C.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    flexShrink: 0,
  };

  const creatorInfoStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const nameStyle: CSSProperties = {
    fontWeight: '600',
    color: C.text,
  };

  const usernameStyle: CSSProperties = {
    fontSize: '12px',
    color: C.textSecondary,
  };

  const ratingStyle: CSSProperties = {
    ...tdStyle,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const starStyle: CSSProperties = {
    fontSize: '14px',
    color: C.accent,
  };

  const noDataStyle: CSSProperties = {
    padding: '32px',
    textAlign: 'center',
    color: C.textSecondary,
  };

  const paginationStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '24px',
  };

  const buttonStyle = (disabled: boolean): CSSProperties => ({
    padding: '8px 16px',
    background: disabled ? C.border : C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    opacity: disabled ? 0.5 : 1,
  });

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={innerContainerStyle}>
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>Loading rankings...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Creator Rankings - ValueSkins</title>
      </Head>

      <div style={containerStyle}>
        <div style={innerContainerStyle}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>🏆 Creator Rankings</h1>
            <p style={descriptionStyle}>
              Top creators ranked by deal completion and customer reviews
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#7f1d1d',
              color: '#fecaca',
              borderRadius: '8px',
              marginBottom: '24px',
              border: `1px solid #dc2626`,
            }}>
              {error}
            </div>
          )}

          {rankings.length === 0 ? (
            <div style={tableContainerStyle}>
              <div style={noDataStyle}>
                No rankings available yet. Creators will appear here once they complete deals.
              </div>
            </div>
          ) : (
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '60px' }}>Rank</th>
                    <th style={thStyle}>Creator</th>
                    <th style={{ ...thStyle, width: '100px' }}>Reviews</th>
                    <th style={{ ...thStyle, width: '100px' }}>Deals</th>
                    <th style={{ ...thStyle, width: '120px' }}>Overall Rating</th>
                    <th style={{ ...thStyle, width: '80px' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((creator) => (
                    <tr key={creator.creatorId} style={{
                      background: creator.rank <= 3 ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
                    }}>
                      <td style={rankCellStyle(creator.rank)}>
                        {getMedalEmoji(creator.rank)}
                      </td>
                      <td
                        style={creatorCellStyle}
                        onClick={() => router.push(`/creator/${creator.username}`)}
                      >
                        <div style={avatarStyle}>
                          {creator.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={creatorInfoStyle}>
                          <div style={nameStyle}>{creator.name}</div>
                          <div style={usernameStyle}>@{creator.username}</div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <strong>{creator.reviewCount}</strong>
                      </td>
                      <td style={tdStyle}>
                        <strong>{creator.dealsCompleted}</strong>
                      </td>
                      <td style={ratingStyle}>
                        <span style={starStyle}>★</span>
                        <strong>{creator.ratings.overall.toFixed(2)}</strong>
                        <span style={{ fontSize: '12px', color: C.textSecondary }}>
                          ({creator.reviewCount})
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: C.accent }}>
                        {creator.rankScore.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > limit && (
            <div style={paginationStyle}>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                style={buttonStyle(offset === 0)}
              >
                ← Previous
              </button>
              <div style={{ alignSelf: 'center', color: C.textSecondary }}>
                Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
              </div>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                style={buttonStyle(offset + limit >= total)}
              >
                Next →
              </button>
            </div>
          )}

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => router.push('/demo/marketplace')}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              ← Back to Feed
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
