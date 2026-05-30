import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const userId = parseInt(id as string);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const result = await query(
      `SELECT
        user_id as "userId",
        events_hosted as "eventsHosted",
        events_attended as "eventsAttended",
        COALESCE(avg_host_professionalism, 0) as "avgHostProfessionalism",
        COALESCE(avg_event_quality, 0) as "avgEventQuality",
        COALESCE(avg_overall_experience, 0) as "avgOverallExperience",
        COALESCE(avg_rating, 0) as "avgRating",
        total_reviews as "totalReviews",
        deals_completed as "dealsCompleted",
        COALESCE(avg_deal_rating, 0) as "avgDealRating",
        trust_score as "trustScore",
        last_updated_at as "lastUpdatedAt"
      FROM user_reputation
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default reputation if user doesn't have reputation entry yet
      return res.json({
        userId,
        eventsHosted: 0,
        eventsAttended: 0,
        avgHostProfessionalism: 0,
        avgEventQuality: 0,
        avgOverallExperience: 0,
        avgRating: 0,
        totalReviews: 0,
        dealsCompleted: 0,
        avgDealRating: 0,
        trustScore: 0,
        lastUpdatedAt: new Date().toISOString(),
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching reputation:', error);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
}
