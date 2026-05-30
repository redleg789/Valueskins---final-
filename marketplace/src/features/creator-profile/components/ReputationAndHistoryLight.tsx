import React, { useEffect, useState } from 'react';

interface UserReputation {
  userId: number;
  eventsHosted: number;
  eventsAttended: number;
  avgHostProfessionalism: number;
  avgEventQuality: number;
  avgOverallExperience: number;
  avgRating: number;
  totalReviews: number;
  dealsCompleted: number;
  avgDealRating: number;
  trustScore: number;
  lastUpdatedAt: string;
}

interface ActivityHistoryEntry {
  id: number;
  userId: number;
  activityType: string;
  entityId: number | null;
  entityType: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  activityDate: string;
}

const C = {
  primary: '#2563EB',
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  card: '#f3f4f6',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  success: '#00D46A',
  warning: '#FFAB00',
  danger: '#ED4956',
  accent: '#3B82F6',
};

interface Props {
  userId: number;
}

const ReputationAndHistoryLight: React.FC<Props> = ({ userId }) => {
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [history, setHistory] = useState<ActivityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'reputation' | 'history' | null>('reputation');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [repRes, histRes] = await Promise.all([
          fetch(`/api/user/${userId}/reputation`),
          fetch(`/api/user/${userId}/history?page=1&limit=5`),
        ]);

        if (!repRes.ok) throw new Error('Failed to fetch reputation');
        if (!histRes.ok) throw new Error('Failed to fetch history');

        const repData: UserReputation = await repRes.json();
        const histData = await histRes.json();

        setReputation(repData);
        setHistory(histData.activities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ height: '200px', background: C.surfaceAlt, borderRadius: '10px', animation: 'pulse 2s' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        marginBottom: '24px',
        padding: '14px',
        background: '#FEE2E2',
        borderRadius: '10px',
        color: '#991B1B',
        fontSize: '13px',
        border: `1px solid #FECACA`,
      }}>
        {error}
      </div>
    );
  }

  const getTrustTier = (score: number) => {
    if (score >= 80) return 'Trusted';
    if (score >= 60) return 'Reliable';
    if (score >= 40) return 'Standard';
    return 'New';
  };

  const formatActivityType = (type: string) => {
    const typeMap: Record<string, string> = {
      event_hosted: '🎪 Hosted Event',
      event_attended: '👥 Attended Event',
      event_reviewed: '⭐ Left Review',
      deal_completed: '🤝 Deal Completed',
      profile_updated: '✏️ Profile Updated',
      valueskin_added: '🎨 Valueskin Added',
      review_received: '💬 Review Received',
    };
    return typeMap[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Reputation Summary */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setExpandedSection(expandedSection === 'reputation' ? null : 'reputation')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px',
            background: C.surfaceAlt,
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            color: C.text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🏆</span>
            Reputation & Trust
          </div>
          <span style={{ fontSize: '18px', color: C.textMuted }}>
            {expandedSection === 'reputation' ? '▲' : '▼'}
          </span>
        </button>

        {expandedSection === 'reputation' && reputation && (
          <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
            {/* Trust Score */}
            <div style={{
              padding: '14px',
              background: C.surfaceAlt,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Trust Score</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                  {reputation.trustScore}/100 · {getTrustTier(reputation.trustScore)}
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.primary }}>
                {reputation.trustScore}%
              </div>
            </div>

            {/* Event Stats */}
            {(reputation.eventsHosted > 0 || reputation.eventsAttended > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div style={{
                  padding: '14px',
                  background: C.surfaceAlt,
                  borderRadius: '10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
                    {reputation.eventsHosted}
                  </div>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
                    Events Hosted
                  </div>
                </div>
                <div style={{
                  padding: '14px',
                  background: C.surfaceAlt,
                  borderRadius: '10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
                    {reputation.eventsAttended}
                  </div>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
                    Events Attended
                  </div>
                </div>
              </div>
            )}

            {/* Event Ratings */}
            {reputation.totalReviews > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ padding: '12px', background: C.surfaceAlt, borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: C.textMuted }}>Overall Rating</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.warning, marginTop: '4px' }}>
                    {'★'.repeat(Math.round(reputation.avgRating))}
                  </div>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>
                    {reputation.avgRating.toFixed(1)}/5
                  </div>
                </div>
                <div style={{ padding: '12px', background: C.surfaceAlt, borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: C.textMuted }}>Professionalism</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.primary, marginTop: '4px' }}>
                    {reputation.avgHostProfessionalism.toFixed(1)}
                  </div>
                </div>
                <div style={{ padding: '12px', background: C.surfaceAlt, borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: C.textMuted }}>Event Quality</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.success, marginTop: '4px' }}>
                    {reputation.avgEventQuality.toFixed(1)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity History */}
      {history.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              background: C.surfaceAlt,
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
              color: C.text,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📅</span>
              Recent Activity
            </div>
            <span style={{ fontSize: '18px', color: C.textMuted }}>
              {expandedSection === 'history' ? '▲' : '▼'}
            </span>
          </button>

          {expandedSection === 'history' && (
            <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
              {history.map((activity, i) => (
                <div
                  key={activity.id}
                  style={{
                    padding: '12px 14px',
                    background: C.surfaceAlt,
                    borderRadius: '10px',
                    borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '4px' }}>
                    {formatActivityType(activity.activityType)}
                  </div>
                  {activity.description && (
                    <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '4px' }}>
                      {activity.description}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: C.textMuted }}>
                    {formatDate(activity.activityDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReputationAndHistoryLight;
