import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/deals/earnings
 * Fetch completed deals with earnings for the current user
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

    const dealsResult = await query(
      `SELECT
        id, title, amount, status, completed_at,
        CASE WHEN creator_id = $1 THEN brand_id ELSE creator_id END as partner_id,
        CASE WHEN creator_id = $1 THEN 'creator' ELSE 'brand' END as user_role
       FROM deals
       WHERE (creator_id = $1 OR brand_id = $1) AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 100`,
      [userId]
    );

    const deals = await Promise.all(
      dealsResult.rows.map(async (deal: any) => {
        const partnerResult = await query('SELECT display_name FROM users WHERE id = $1', [deal.partner_id]);
        return {
          id: deal.id,
          title: deal.title,
          amount: parseInt(deal.amount) || 0,
          partnerName: partnerResult.rows[0]?.display_name || 'Unknown',
          userRole: deal.user_role,
          status: deal.status,
          completedAt: deal.completed_at,
        };
      })
    );

    const totalEarnings = deals.reduce((sum, deal) => sum + deal.amount, 0);

    return res.status(200).json({
      deals,
      totalEarnings,
      dealCount: deals.length,
    });
  } catch (err: any) {
    console.error('Earnings API error:', err);
    return res.status(500).json({ error: 'Failed to fetch earnings data' });
  }
}
