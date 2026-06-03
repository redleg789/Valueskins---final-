import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/user/profile
 * Fetch complete user profile with stats, metrics, and earnings
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionToken = req.cookies.valueskins_session;
  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true AND expires_at > NOW()',
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const userId = sessionResult.rows[0].user_id;

    const [userResult, dealsResult, ratingsResult] = await Promise.all([
      query(
        `SELECT id, display_name, bio, email, role, followers_count, engagement_rate, profile_image_url
         FROM users WHERE id = $1`,
        [userId]
      ),
      query(
        `SELECT
          COUNT(*) as deal_count,
          COALESCE(SUM(amount), 0) as total_earned,
          COALESCE(AVG(amount), 0) as avg_deal_value
         FROM deals WHERE (creator_id = $1 OR brand_id = $1) AND status = 'completed'`,
        [userId]
      ),
      query(
        `SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as rating_count
         FROM ratings WHERE rated_user_id = $1`,
        [userId]
      ),
    ]);

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deals = dealsResult.rows[0] || {};
    const ratings = ratingsResult.rows[0] || {};

    const profile = {
      id: user.id,
      displayName: user.display_name,
      bio: user.bio,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profile_image_url,
      metrics: {
        followers: parseInt(user.followers_count) || 0,
        engagement: parseFloat(user.engagement_rate) || 0,
      },
      financial: {
        totalEarned: parseInt(deals.total_earned) || 0,
        avgDealValue: parseInt(deals.avg_deal_value) || 0,
        dealsCount: parseInt(deals.deal_count) || 0,
      },
      reputation: {
        avgRating: parseFloat(ratings.avg_rating) || 0,
        ratingCount: parseInt(ratings.rating_count) || 0,
      },
    };

    return res.status(200).json(profile);
  } catch (err: any) {
    console.error('User profile API error:', err);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}
