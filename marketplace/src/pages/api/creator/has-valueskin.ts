import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.headers.cookie || '';
  const userId = await getSessionUserId(cookie);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      'SELECT 1 FROM user_stickers WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [userId]
    );

    const hasValueskin = result.rows.length > 0;
    return res.status(200).json({ hasValueskin, userId });
  } catch (err: any) {
    console.error('Error checking value scheme:', err);
    return res.status(500).json({ error: 'Failed to check value scheme' });
  }
}
