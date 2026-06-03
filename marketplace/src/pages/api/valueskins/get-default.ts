import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/valueskins/get-default?userId=X
 * Fetch the default ValueSkin for any user (public endpoint)
 * Used to display sticker on profile pages
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId query parameter required' });
  }

  try {
    // Get user's role first
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Fetch default ValueSkin
    let defaultSkin;
    if (userRole === 'brand') {
      const skinResult = await query(
        `SELECT id, category, slot, xp, level, description, pitch_text, pitch_video, created_at, updated_at
         FROM brand_valueskins
         WHERE user_id = $1 AND is_default = true
         LIMIT 1`,
        [userId]
      );
      defaultSkin = skinResult.rows[0];
    } else {
      const skinResult = await query(
        `SELECT id, profession, slot, xp, level, about_me, pitch_text, pitch_video, created_at, updated_at
         FROM user_valueskins
         WHERE user_id = $1 AND is_default = true
         LIMIT 1`,
        [userId]
      );
      defaultSkin = skinResult.rows[0];
    }

    if (!defaultSkin) {
      return res.status(404).json({ error: 'Default ValueSkin not found' });
    }

    return res.status(200).json({
      success: true,
      defaultValueSkin: {
        id: defaultSkin.id,
        name: defaultSkin.profession || defaultSkin.category,
        description: defaultSkin.about_me || defaultSkin.description || '',
        pitch: defaultSkin.pitch_text || '',
        video: defaultSkin.pitch_video || '',
        xp: defaultSkin.xp || 0,
        level: defaultSkin.level || 1,
        isDefault: true,
        createdAt: defaultSkin.created_at,
        updatedAt: defaultSkin.updated_at,
      },
    });
  } catch (err: any) {
    console.error('Get default ValueSkin error:', err);
    return res.status(500).json({ error: 'Failed to fetch default ValueSkin' });
  }
}
