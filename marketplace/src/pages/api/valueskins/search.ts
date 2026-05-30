import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Valueskin code is required' });
  }

  try {
    const result = await query(
      `SELECT
        us.id,
        us.valueskin_code,
        us.tier,
        us.created_at,
        us.is_active,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        p.name as profession_name,
        p.category as profession_category
       FROM user_stickers us
       JOIN users u ON us.user_id = u.id
       JOIN professions p ON us.profession_id = p.id
       WHERE us.valueskin_code = $1 AND us.is_active = TRUE`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valueskin not found' });
    }

    const sticker = result.rows[0];
    return res.status(200).json({
      id: sticker.id,
      valueskinCode: sticker.valueskin_code,
      tier: sticker.tier,
      createdAt: sticker.created_at,
      creator: {
        id: sticker.user_id,
        username: sticker.username,
        displayName: sticker.display_name,
        avatarUrl: sticker.avatar_url,
      },
      profession: {
        name: sticker.profession_name,
        category: sticker.profession_category,
      },
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Failed to search valueskin' });
  }
}
