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
      `SELECT
        us.id,
        us.valueskin_code,
        us.tier,
        us.created_at,
        p.name as profession_name,
        p.category as profession_category
       FROM user_stickers us
       JOIN professions p ON us.profession_id = p.id
       WHERE us.user_id = $1 AND us.is_active = TRUE
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active ValueSkin found' });
    }

    const skin = result.rows[0];
    return res.status(200).json({
      valueskin: {
        id: skin.id,
        valueskinCode: skin.valueskin_code,
        tier: skin.tier,
        createdAt: skin.created_at,
        profession: {
          name: skin.profession_name,
          category: skin.profession_category,
        },
      },
    });
  } catch (err: any) {
    console.error('Error fetching ValueSkin:', err);
    return res.status(500).json({ error: 'Failed to fetch ValueSkin' });
  }
}
