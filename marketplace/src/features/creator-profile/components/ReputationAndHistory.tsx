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

interface Props {
  userId: number;
}

const ReputationAndHistory: React.FC<Props> = ({ userId }) => {
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
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-200 text-sm">
        {error}
      </div>
    );
  }

  const getTrustTier = (score: number) => {
    if (score >= 80) return { label: 'Trusted', color: 'text-green-400' };
    if (score >= 60) return { label: 'Reliable', color: 'text-blue-400' };
    if (score >= 40) return { label: 'Standard', color: 'text-gray-400' };
    return { label: 'New', color: 'text-yellow-400' };
  };

  const trustTier = getTrustTier(reputation?.trustScore || 0);

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
    <div className="space-y-4">
      {/* Reputation Summary */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700">
        <button
          onClick={() => setExpandedSection(expandedSection === 'reputation' ? null : 'reputation')}
          className="w-full flex items-center justify-between hover:opacity-80 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h3 className="font-semibold text-white">Reputation & Trust</h3>
          </div>
          <span className="text-xl">{expandedSection === 'reputation' ? '▲' : '▼'}</span>
        </button>

        {expandedSection === 'reputation' && reputation && (
          <div className="mt-4 space-y-3">
            {/* Trust Score */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 flex items-center gap-2">
                <span>📈</span>
                Trust Score
              </span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                    style={{ width: `${Math.max(reputation.trustScore, 0)}%` }}
                  />
                </div>
                <span className={`font-bold ${trustTier.color} w-16 text-right`}>
                  {reputation.trustScore}/100
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-400">{trustTier.label} Member</div>

            {/* Event Stats */}
            {(reputation.eventsHosted > 0 || reputation.eventsAttended > 0) && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-700">
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-white">{reputation.eventsHosted}</div>
                  <div className="text-xs text-gray-400">Events Hosted</div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-white">{reputation.eventsAttended}</div>
                  <div className="text-xs text-gray-400">Events Attended</div>
                </div>
              </div>
            )}

            {/* Event Ratings */}
            {reputation.totalReviews > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-700 text-xs">
                <div className="bg-gray-700/30 rounded p-2">
                  <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                    <span>⭐</span>
                    {reputation.avgRating.toFixed(1)}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">Overall</div>
                </div>
                <div className="bg-gray-700/30 rounded p-2">
                  <div className="text-blue-400 font-semibold">{reputation.avgHostProfessionalism.toFixed(1)}</div>
                  <div className="text-gray-400 text-xs mt-1">Host Pro</div>
                </div>
                <div className="bg-gray-700/30 rounded p-2">
                  <div className="text-green-400 font-semibold">{reputation.avgEventQuality.toFixed(1)}</div>
                  <div className="text-gray-400 text-xs mt-1">Quality</div>
                </div>
              </div>
            )}

            {/* Deal Stats */}
            {reputation.dealsCompleted > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-gray-300 text-sm">Completed Deals</span>
                <span className="text-white font-semibold">{reputation.dealsCompleted}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity History */}
      {history.length > 0 && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700">
          <button
            onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
            className="w-full flex items-center justify-between hover:opacity-80 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">📅</span>
              <h3 className="font-semibold text-white">Recent Activity</h3>
            </div>
            <span className="text-xl">{expandedSection === 'history' ? '▲' : '▼'}</span>
          </button>

          {expandedSection === 'history' && (
            <div className="mt-4 space-y-3">
              {history.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 bg-gray-700/30 rounded-lg p-3">
                  <div className="text-lg flex-shrink-0">{formatActivityType(activity.activityType)}</div>
                  <div className="flex-1 min-w-0">
                    {activity.description && (
                      <p className="text-gray-300 text-sm truncate">{activity.description}</p>
                    )}
                    <p className="text-gray-500 text-xs mt-1">{formatDate(activity.activityDate)}</p>
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

export default ReputationAndHistory;
