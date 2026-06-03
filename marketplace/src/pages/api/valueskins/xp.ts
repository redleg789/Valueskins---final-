import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/valueskins/xp - Get XP data for all ValueSkins
 * POST /api/valueskins/xp - Add XP to a ValueSkin
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    if (req.method === 'GET') {
      // Fetch XP for all user's ValueSkins
      const skinsResult = await query(
        `SELECT id, profession, xp, level FROM user_valueskins WHERE user_id = $1`,
        [userId]
      );

      const xpData: Record<string, any> = {};
      skinsResult.rows.forEach((skin: any) => {
        xpData[skin.profession] = {
          id: skin.id,
          xp: parseInt(skin.xp) || 0,
          level: parseInt(skin.level) || 1,
        };
      });

      return res.status(200).json(xpData);
    }

    if (req.method === 'POST') {
      const { skinId, xpAmount } = req.body;

      if (!skinId || !xpAmount) {
        return res.status(400).json({ error: 'skinId and xpAmount required' });
      }

      // Verify ownership
      const skinResult = await query(
        'SELECT xp, level FROM user_valueskins WHERE id = $1 AND user_id = $2',
        [skinId, userId]
      );

      if (!skinResult.rows.length) {
        return res.status(404).json({ error: 'ValueSkin not found' });
      }

      const currentXp = parseInt(skinResult.rows[0].xp) || 0;
      const currentLevel = parseInt(skinResult.rows[0].level) || 1;
      const newXp = currentXp + xpAmount;

      // Simple level calculation: 100 XP per level
      const newLevel = Math.floor(newXp / 100) + 1;

      const updateResult = await query(
        `UPDATE user_valueskins SET xp = $1, level = $2, updated_at = NOW()
         WHERE id = $3 RETURNING xp, level`,
        [newXp, newLevel, skinId]
      );

      const updated = updateResult.rows[0];

      return res.status(200).json({
        skinId,
        xp: parseInt(updated.xp),
        level: parseInt(updated.level),
        xpAdded: xpAmount,
        previousXp: currentXp,
        previousLevel: currentLevel,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('ValueSkin XP API error:', err);
    return res.status(500).json({ error: 'Failed to manage XP' });
  }
}
