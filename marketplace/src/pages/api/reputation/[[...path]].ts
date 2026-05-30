import type { NextApiRequest, NextApiResponse } from 'next';

const reputationScores: Record<number, any> = {
  1: { score: 82, breakdown: { attendance_reliability: 25, on_time_check_in: 18, host_ratings: 15, account_age: 10, no_show_penalty: -10, late_arrival_penalty: -4 }, tier: 'Trusted' },
  2: { score: 65, breakdown: { attendance_reliability: 18, on_time_check_in: 12, host_ratings: 10, account_age: 6, no_show_penalty: -5, late_arrival_penalty: -2 }, tier: 'Reliable' },
  3: { score: 92, breakdown: { attendance_reliability: 30, on_time_check_in: 22, host_ratings: 18, account_age: 14, no_show_penalty: 0, late_arrival_penalty: 0 }, tier: 'Trusted' },
  4: { score: 35, breakdown: { attendance_reliability: 8, on_time_check_in: 5, host_ratings: 6, account_age: 4, no_show_penalty: -30, late_arrival_penalty: -8 }, tier: 'Standard' },
};

const repBadges: Record<number, any[]> = {
  1: [{ badgeType: 'trusted_attendee', scoreThreshold: 80, awardedAt: '2026-05-01T00:00:00Z' }],
  3: [
    { badgeType: 'trusted_attendee', scoreThreshold: 80, awardedAt: '2026-04-15T00:00:00Z' },
    { badgeType: 'vip_guest', scoreThreshold: 90, awardedAt: '2026-05-01T00:00:00Z' },
    { badgeType: 'top_reviewer', scoreThreshold: 85, awardedAt: '2026-05-10T00:00:00Z' },
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [resource, accountIdStr] = path;

  if (!resource) return res.status(400).json({ error: 'No resource specified' });

  const accountId = parseInt(accountIdStr) || 1;

  switch (resource) {
    case 'score': {
      const s = reputationScores[accountId] || { score: 50, breakdown: {}, tier: 'Standard' };
      return res.json({ accountId, ...s });
    }
    case 'badges': {
      const b = repBadges[accountId] || [];
      return res.json({ accountId, badges: b });
    }
    default:
      return res.status(404).json({ error: `Unknown resource: ${resource}` });
  }
}
