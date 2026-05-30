import type { NextApiRequest, NextApiResponse } from 'next';

// ── In-memory mock store ──────────────────────────────────

const loyaltyPoints: Record<number, any[]> = {};

const pointsBalance: Record<number, number> = {};
const streaks: Record<number, any> = {};
const vipTiers: Record<number, any> = {};
const badges: Record<number, any[]> = {};
const reputationScores: Record<number, any> = {};
const repBadges: Record<number, any[]> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [resource, ...rest] = path;

  if (!resource) return res.status(400).json({ error: 'No resource specified' });

  const accountId = parseInt(rest[0]) || 1;

  switch (resource) {
    // ── Loyalty Points ────────────────────────────────
    case 'points': {
      if (req.method === 'GET') {
        const pts = pointsBalance[accountId] || 0;
        const history = loyaltyPoints[accountId] || [];
        return res.json({ accountId, points: pts, history });
      }
      if (req.method === 'POST') {
        const { points, reason, referenceType, referenceId } = req.body;
        if (!loyaltyPoints[accountId]) loyaltyPoints[accountId] = [];
        loyaltyPoints[accountId].push({ points, reason, referenceType, referenceId, createdAt: new Date().toISOString() });
        pointsBalance[accountId] = (pointsBalance[accountId] || 0) + points;
        return res.json({ success: true, balance: pointsBalance[accountId] });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Loyalty Streaks ───────────────────────────────
    case 'streaks': {
      const s = streaks[accountId] || { currentStreak: 0, longestStreak: 0, lastEventDate: null };
      return res.json({ accountId, ...s });
    }

    // ── VIP Tiers ─────────────────────────────────────
    case 'vip': {
      const v = vipTiers[accountId] || { tier: 'bronze', pointsThreshold: 0 };
      return res.json({ accountId, ...v });
    }

    // ── Badges ────────────────────────────────────────
    case 'badges': {
      const b = badges[accountId] || [];
      return res.json({ accountId, badges: b });
    }

    // ── Leaderboard ───────────────────────────────────
    case 'leaderboard': {
      const lb = Object.entries(pointsBalance).map(([id, p]) => ({
        accountId: parseInt(id), points: p,
      })).sort((a, b) => b.points - a.points).slice(0, 10);
      return res.json({ leaderboard: lb });
    }

    default:
      return res.status(404).json({ error: `Unknown resource: ${resource}` });
  }
}
