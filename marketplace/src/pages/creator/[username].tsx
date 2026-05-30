'use client';
import { useState, useEffect, CSSProperties } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = {
  primary: '#2563EB',
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  border: '#334155',
  success: '#22c55e',
  accent: '#f59e0b',
};

interface Creator {
  id: number;
  realName: string;
  username: string;
  valueSkinsId?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  totalReviews: number;
  avgOverallRating: number;
  avgQualityRating: number;
  avgCommunicationRating: number;
  avgProfessionalismRating: number;
  dealsCompleted: number;
  rankScore: number;
  rankPosition: number;
}

interface WorkItem {
  id: number;
  title: string;
  type: 'content' | 'event';
  status: 'completed' | 'in-progress' | 'pending';
  completedAt?: string;
  rating?: number;
  partnerId: number;
  partnerName: string;
}

export default function CreatorProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const [creator, setCreator] = useState<Creator | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'events' | 'reviews'>('content');

  useEffect(() => {
    if (username) {
      fetchCreatorProfile();
    }
  }, [username]);

  const fetchCreatorProfile = async () => {
    try {
      // Fetch creator profile
      const res = await fetch(`/api/creators/profile/${username}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Creator not found');
      const data = await res.json();
      setCreator(data.creator);

      // Fetch work history
      try {
        const workRes = await fetch(`/api/creators/${data.creator.id}/work`, {
          credentials: 'include',
        });

        if (workRes.status === 404) {
          // No work history found - this is fine, just empty
          setWorkItems([]);
        } else if (workRes.ok) {
          const workData = await workRes.json();
          setWorkItems(workData.workItems || []);
        } else if (workRes.status >= 500) {
          setError('Server not working. Please try again later.');
        } else {
          setError('Unable to load work history');
        }
      } catch (workErr: any) {
        setError('Server not working. Please try again later.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    maxWidth: '1000px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    gap: '32px',
    marginBottom: '48px',
    padding: '32px',
    background: C.surface,
    borderRadius: '12px',
    border: `1px solid ${C.border}`,
  };

  const avatarStyle: CSSProperties = {
    width: '150px',
    height: '150px',
    borderRadius: '12px',
    background: C.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '64px',
    flexShrink: 0,
  };

  const infoStyle: CSSProperties = {
    flex: 1,
  };

  const nameStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  };

  const usernameStyle: CSSProperties = {
    fontSize: '16px',
    color: C.textSecondary,
    marginBottom: '16px',
  };

  const bioStyle: CSSProperties = {
    fontSize: '14px',
    color: C.textSecondary,
    marginBottom: '16px',
    lineHeight: '1.6',
  };

  const idBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '6px 12px',
    background: 'rgba(34, 197, 94, 0.1)',
    color: C.success,
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    marginRight: '12px',
    marginBottom: '12px',
  };

  const statsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  };

  const statCardStyle: CSSProperties = {
    padding: '16px',
    background: 'rgba(37, 99, 235, 0.1)',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
  };

  const statLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: C.textSecondary,
    textTransform: 'uppercase',
    marginBottom: '8px',
  };

  const statValueStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    color: C.text,
  };

  const tabsStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: '12px',
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '12px 24px',
    background: 'transparent',
    color: active ? C.primary : C.textSecondary,
    border: 'none',
    borderBottom: active ? `2px solid ${C.primary}` : 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const workGridStyle: CSSProperties = {
    display: 'grid',
    gap: '12px',
  };

  const workItemStyle: CSSProperties = {
    padding: '16px',
    background: C.surface,
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const workTitleStyle: CSSProperties = {
    fontWeight: '600',
    marginBottom: '4px',
  };

  const workTypeStyle: CSSProperties = {
    fontSize: '12px',
    color: C.textSecondary,
  };

  const statusBadgeStyle = (status: string): CSSProperties => {
    const colors: Record<string, [string, string]> = {
      completed: ['rgba(34, 197, 94, 0.1)', C.success],
      'in-progress': ['rgba(245, 158, 11, 0.1)', C.accent],
      pending: ['rgba(148, 163, 184, 0.1)', C.textSecondary],
    };
    const [bg, color] = colors[status] || colors.pending;
    return {
      padding: '4px 8px',
      background: bg,
      color: color,
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'capitalize',
    };
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>Loading creator profile...</div>
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          <div style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#fca5a5',
            borderRadius: '8px',
            border: '1px solid #dc2626',
            marginBottom: '24px',
          }}>
            {error || 'Creator not found'}
          </div>
          <button
            onClick={() => router.push('/marketplace')}
            style={{
              padding: '10px 24px',
              background: C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            ← Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const contentWork = workItems.filter(w => w.type === 'content');
  const eventWork = workItems.filter(w => w.type === 'event');

  return (
    <>
      <Head>
        <title>{creator.realName} - ValueSkins Creator</title>
      </Head>

      <div style={containerStyle}>
        <div style={innerStyle}>
          {/* Profile Header */}
          <div style={headerStyle}>
            <div style={avatarStyle}>
              {creator.realName.charAt(0).toUpperCase()}
            </div>
            <div style={infoStyle}>
              <div style={nameStyle}>{creator.realName}</div>
              <div style={usernameStyle}>@{creator.username}</div>
              {creator.bio && <p style={bioStyle}>{creator.bio}</p>}
              {creator.location && (
                <div style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '12px' }}>
                  {creator.location}
                </div>
              )}
              <div>
                {creator.valueSkinsId && (
                  <span style={idBadgeStyle}>
                    ValueSkins ID: {creator.valueSkinsId}
                  </span>
                )}
                {creator.rankPosition && (
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: C.accent,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    Rank #{creator.rankPosition}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Reviews</div>
              <div style={statValueStyle}>{creator.totalReviews}</div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Deals Completed</div>
              <div style={statValueStyle}>{creator.dealsCompleted}</div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Overall Rating</div>
              <div style={statValueStyle}>
                {creator.avgOverallRating.toFixed(2)}
                <span style={{ fontSize: '16px', marginLeft: '4px' }}>⭐</span>
              </div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Rank Score</div>
              <div style={statValueStyle}>{creator.rankScore.toFixed(0)}</div>
            </div>
          </div>

          {/* Rating Breakdown */}
          <div style={{
            padding: '24px',
            background: C.surface,
            borderRadius: '12px',
            border: `1px solid ${C.border}`,
            marginBottom: '40px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
              Rating Breakdown
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              {[
                { label: 'Quality', value: creator.avgQualityRating },
                { label: 'Communication', value: creator.avgCommunicationRating },
                { label: 'Professionalism', value: creator.avgProfessionalismRating },
              ].map((rating) => (
                <div key={rating.label} style={{
                  padding: '12px',
                  background: 'rgba(37, 99, 235, 0.05)',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '8px' }}>
                    {rating.label}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700' }}>
                    {rating.value.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Work History */}
          {(contentWork.length > 0 || eventWork.length > 0) && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
                Work They've Done
              </h2>

              <div style={tabsStyle}>
                <button
                  onClick={() => setActiveTab('content')}
                  style={tabStyle(activeTab === 'content')}
                >
                  Content ({contentWork.length})
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  style={tabStyle(activeTab === 'events')}
                >
                  Events ({eventWork.length})
                </button>
              </div>

              <div style={workGridStyle}>
                {activeTab === 'content' && (
                  <>
                    {contentWork.length === 0 ? (
                      <div style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: C.textSecondary,
                        background: C.surface,
                        borderRadius: '8px',
                      }}>
                        No content deals yet
                      </div>
                    ) : (
                      contentWork.map((item) => (
                        <div key={item.id} style={workItemStyle}>
                          <div>
                            <div style={workTitleStyle}>{item.title}</div>
                            <div style={workTypeStyle}>
                              With {item.partnerName} • {new Date(item.completedAt || '').toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {item.rating && (
                              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                                {item.rating}⭐
                              </div>
                            )}
                            <div style={statusBadgeStyle(item.status)}>
                              {item.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === 'events' && (
                  <>
                    {eventWork.length === 0 ? (
                      <div style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: C.textSecondary,
                        background: C.surface,
                        borderRadius: '8px',
                      }}>
                        No events hosted yet
                      </div>
                    ) : (
                      eventWork.map((item) => (
                        <div key={item.id} style={workItemStyle}>
                          <div>
                            <div style={workTitleStyle}>{item.title}</div>
                            <div style={workTypeStyle}>
                              {new Date(item.completedAt || '').toLocaleDateString()}
                            </div>
                          </div>
                          <div style={statusBadgeStyle(item.status)}>
                            {item.status}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Back Button */}
          <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => router.push('/marketplace')}
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
              ← Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
