import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const result = await query(
      `SELECT id, deal_id, type, reminder_date, reminded_at 
       FROM deal_reminders 
       WHERE user_id = $1 AND reminded_at IS NULL 
       ORDER BY reminder_date ASC`,
      [userId]
    );

    return res.status(200).json({ reminders: result.rows });
  } catch (error) {
    console.error('Get reminders error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
